// =============================================
// AI-Spec Language - Parser
// トークン列 → AST 変換
// =============================================

import type { Token } from "../lexer/tokens.js";
import { TokenType } from "../lexer/tokens.js";
import { ErrorReporter } from "../errors/reporter.js";
import * as E from "../errors/codes.js";
import type {
  AstNode,
  AiSpecFile,
  Directive,
  VersionStatement,
  LetStatement,
  ImportStatement,
  IncludeStatement,
  ExpressionNode,
} from "./ast.js";

export class Parser {
  private pos = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly filePath: string,
    private readonly reporter: ErrorReporter
  ) {}

  parse(): AiSpecFile {
    const directives: Directive[] = [];
    let body: AstNode | null = null;
    let version: string | undefined;

    while (!this.isAtEnd()) {
      const tok = this.peek();

      if (tok.type === TokenType.AtVersion) {
        const vs = this.parseVersion();
        if (version !== undefined) {
          this.reporter.addError(E.E013_DUPLICATE_VERSION, this.filePath, tok.line, tok.column);
        } else {
          version = vs.versionString;
        }
        directives.push(vs);
      } else if (tok.type === TokenType.AtLet) {
        directives.push(this.parseLet());
      } else if (tok.type === TokenType.AtImport) {
        directives.push(this.parseImport());
      } else if (tok.type === TokenType.AtInclude) {
        directives.push(this.parseInclude());
      } else {
        // Body (the main JSON value)
        body = this.parseValue();
        break;
      }
    }

    return { version, directives, body };
  }

  // --- ディレクティブ ---

  private parseLet(): LetStatement {
    const tok = this.advance(); // @let
    const nameTok = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
    this.expect(TokenType.Assign, E.E010_EXPECTED_ASSIGNMENT);
    const value = this.parseValue();
    return { kind: "let", name: nameTok.value, value, line: tok.line, column: tok.column };
  }

  private parseImport(): ImportStatement {
    const tok = this.advance(); // @import
    const names: string[] = [];

    if (this.peek().type === TokenType.LeftBrace) {
      // @import { Name1, Name2 } from "path"
      this.advance(); // {
      while (!this.isAtEnd() && this.peek().type !== TokenType.RightBrace) {
        const name = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
        names.push(name.value);
        if (this.peek().type === TokenType.Comma) {
          this.advance();
        }
      }
      this.expect(TokenType.RightBrace, E.E012_EXPECTED_BRACE);
    } else {
      // @import Name from "path"
      const name = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
      names.push(name.value);
    }

    this.expect(TokenType.From, E.E011_EXPECTED_FROM);
    const pathTok = this.expect(TokenType.String, E.E011_EXPECTED_FROM);

    return { kind: "import", names, path: pathTok.value, line: tok.line, column: tok.column };
  }

  private parseInclude(): IncludeStatement {
    const tok = this.advance(); // @include
    const pathTok = this.expect(TokenType.String, E.E006_EXPECTED_VALUE);
    return { kind: "include", path: pathTok.value, line: tok.line, column: tok.column };
  }

  private parseVersion(): VersionStatement {
    const tok = this.advance(); // @version
    const verTok = this.expect(TokenType.String, E.E006_EXPECTED_VALUE);
    return { kind: "version", versionString: verTok.value, line: tok.line, column: tok.column };
  }

  // --- 値パース ---

  parseValue(): AstNode {
    const tok = this.peek();

    switch (tok.type) {
      case TokenType.LeftBrace:
        return this.maybeParsemerge(this.parseObject());
      case TokenType.LeftBracket:
        return this.parseArray();
      case TokenType.String:
        this.advance();
        return { type: "literal", value: tok.value, line: tok.line, column: tok.column };
      case TokenType.Number:
        this.advance();
        return { type: "literal", value: Number(tok.value), line: tok.line, column: tok.column };
      case TokenType.Boolean:
        this.advance();
        return { type: "literal", value: tok.value === "true", line: tok.line, column: tok.column };
      case TokenType.Null:
        this.advance();
        return { type: "literal", value: null, line: tok.line, column: tok.column };

      // @variable reference
      case TokenType.AtIdentifier:
        this.advance();
        return this.maybeParsemerge({
          type: "variable_ref",
          name: tok.value,
          line: tok.line,
          column: tok.column,
        });

      // @type("string", ...)
      case TokenType.AtType:
        return this.parseTypeShorthand();

      // @ref(Name)
      case TokenType.AtRef:
        return this.parseRefShorthand();

      // @if
      case TokenType.AtIf:
        return this.parseConditional();

      default:
        this.reporter.addError(E.E006_EXPECTED_VALUE, this.filePath, tok.line, tok.column, tok.value);
        this.advance();
        return { type: "literal", value: null, line: tok.line, column: tok.column };
    }
  }

  // --- JSON オブジェクト ---

  private parseObject(): AstNode {
    const tok = this.advance(); // {
    const properties = new Map<string, AstNode>();

    while (!this.isAtEnd() && this.peek().type !== TokenType.RightBrace) {
      // Key must be a string
      const keyTok = this.peek();
      if (keyTok.type !== TokenType.String) {
        this.reporter.addError(E.E009_EXPECTED_PROPERTY_KEY, this.filePath, keyTok.line, keyTok.column, keyTok.value);
        this.advance();
        continue;
      }
      this.advance();
      this.expect(TokenType.Colon, E.E005_EXPECTED_COLON);
      const value = this.parseValue();
      properties.set(keyTok.value, value);

      if (this.peek().type === TokenType.Comma) {
        this.advance();
      }
    }

    this.expect(TokenType.RightBrace, E.E002_UNEXPECTED_TOKEN);
    return { type: "object", properties, line: tok.line, column: tok.column };
  }

  // --- JSON 配列 ---

  private parseArray(): AstNode {
    const tok = this.advance(); // [
    const elements: AstNode[] = [];

    while (!this.isAtEnd() && this.peek().type !== TokenType.RightBracket) {
      elements.push(this.parseValue());
      if (this.peek().type === TokenType.Comma) {
        this.advance();
      }
    }

    this.expect(TokenType.RightBracket, E.E002_UNEXPECTED_TOKEN);
    return { type: "array", elements, line: tok.line, column: tok.column };
  }

  // --- @type("string", format="email") ---

  private parseTypeShorthand(): AstNode {
    const tok = this.advance(); // @type
    this.expect(TokenType.LeftParen, E.E002_UNEXPECTED_TOKEN);

    // First positional arg: type name
    const typeNameTok = this.expect(TokenType.String, E.E006_EXPECTED_VALUE);
    const params = new Map<string, AstNode>();

    // Named params: key=value
    while (this.peek().type === TokenType.Comma) {
      this.advance(); // skip comma
      const paramName = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
      this.expect(TokenType.Assign, E.E010_EXPECTED_ASSIGNMENT);
      const paramValue = this.parseValue();
      params.set(paramName.value, paramValue);
    }

    this.expect(TokenType.RightParen, E.E002_UNEXPECTED_TOKEN);
    return {
      type: "type_shorthand",
      typeName: typeNameTok.value,
      params,
      line: tok.line,
      column: tok.column,
    };
  }

  // --- @ref(Name) ---

  private parseRefShorthand(): AstNode {
    const tok = this.advance(); // @ref
    this.expect(TokenType.LeftParen, E.E002_UNEXPECTED_TOKEN);
    const nameTok = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
    this.expect(TokenType.RightParen, E.E002_UNEXPECTED_TOKEN);
    return { type: "ref_shorthand", refName: nameTok.value, line: tok.line, column: tok.column };
  }

  // --- @if / @elif / @else ---

  private parseConditional(): AstNode {
    const tok = this.advance(); // @if
    const condition = this.parseExpression();
    this.expect(TokenType.LeftBrace, E.E012_EXPECTED_BRACE);
    const thenBranch = this.parseValue();
    this.expect(TokenType.RightBrace, E.E002_UNEXPECTED_TOKEN);

    const elifBranches: { condition: ExpressionNode; branch: AstNode }[] = [];
    while (this.peek().type === TokenType.AtElif) {
      this.advance(); // @elif
      const elifCondition = this.parseExpression();
      this.expect(TokenType.LeftBrace, E.E012_EXPECTED_BRACE);
      const elifBranch = this.parseValue();
      this.expect(TokenType.RightBrace, E.E002_UNEXPECTED_TOKEN);
      elifBranches.push({ condition: elifCondition, branch: elifBranch });
    }

    let elseBranch: AstNode | null = null;
    if (this.peek().type === TokenType.AtElse) {
      this.advance(); // @else
      this.expect(TokenType.LeftBrace, E.E012_EXPECTED_BRACE);
      elseBranch = this.parseValue();
      this.expect(TokenType.RightBrace, E.E002_UNEXPECTED_TOKEN);
    }

    return {
      type: "conditional",
      condition,
      thenBranch,
      elifBranches,
      elseBranch,
      line: tok.line,
      column: tok.column,
    };
  }

  // --- + マージ演算子 ---

  private maybeParsemerge(left: AstNode): AstNode {
    if (this.peek().type === TokenType.Plus) {
      this.advance(); // +
      const right = this.parseValue();
      return { type: "merge", left, right, line: left.line, column: left.column };
    }
    return left;
  }

  // --- 式パース (条件式用) ---

  parseExpression(): ExpressionNode {
    return this.parseOr();
  }

  private parseOr(): ExpressionNode {
    let left = this.parseAnd();
    while (this.peek().type === TokenType.Or) {
      this.advance();
      const right = this.parseAnd();
      left = { type: "logical_or", left, right };
    }
    return left;
  }

  private parseAnd(): ExpressionNode {
    let left = this.parseNot();
    while (this.peek().type === TokenType.And) {
      this.advance();
      const right = this.parseNot();
      left = { type: "logical_and", left, right };
    }
    return left;
  }

  private parseNot(): ExpressionNode {
    if (this.peek().type === TokenType.Not) {
      this.advance();
      const operand = this.parseNot();
      return { type: "logical_not", operand };
    }
    return this.parseComparison();
  }

  private parseComparison(): ExpressionNode {
    let left = this.parsePrimary();

    const compOps: Record<string, "==" | "!=" | ">" | "<" | ">=" | "<="> = {
      [TokenType.Equals]: "==",
      [TokenType.NotEquals]: "!=",
      [TokenType.Greater]: ">",
      [TokenType.Less]: "<",
      [TokenType.Gte]: ">=",
      [TokenType.Lte]: "<=",
    };

    const op = compOps[this.peek().type];
    if (op) {
      this.advance();
      const right = this.parsePrimary();
      left = { type: "comparison", left, operator: op, right };
    }

    return left;
  }

  private parsePrimary(): ExpressionNode {
    const tok = this.peek();

    // Parenthesized expression
    if (tok.type === TokenType.LeftParen) {
      this.advance();
      const inner = this.parseExpression();
      this.expect(TokenType.RightParen, E.E002_UNEXPECTED_TOKEN);
      return { type: "paren", inner };
    }

    // String literal
    if (tok.type === TokenType.String) {
      this.advance();
      return { type: "literal", value: tok.value };
    }

    // Number literal
    if (tok.type === TokenType.Number) {
      this.advance();
      return { type: "literal", value: Number(tok.value) };
    }

    // Boolean literal
    if (tok.type === TokenType.Boolean) {
      this.advance();
      return { type: "literal", value: tok.value === "true" };
    }

    // Null
    if (tok.type === TokenType.Null) {
      this.advance();
      return { type: "literal", value: null };
    }

    // Identifier (possibly dotted: a.b.c)
    if (tok.type === TokenType.Identifier) {
      this.advance();
      const parts = [tok.value];
      while (this.peek().type === TokenType.Dot) {
        this.advance(); // .
        const next = this.expect(TokenType.Identifier, E.E002_UNEXPECTED_TOKEN);
        parts.push(next.value);
      }
      return { type: "variable_ref", parts };
    }

    this.reporter.addError(E.E006_EXPECTED_VALUE, this.filePath, tok.line, tok.column, tok.value);
    this.advance();
    return { type: "literal", value: null };
  }

  // --- ヘルパー ---

  private peek(): Token {
    if (this.pos >= this.tokens.length) {
      return { type: TokenType.Eof, value: "", line: 0, column: 0 };
    }
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.peek();
    if (this.pos < this.tokens.length) this.pos++;
    return tok;
  }

  private expect(type: TokenType, errorTemplate: E.ErrorTemplate): Token {
    const tok = this.peek();
    if (tok.type !== type) {
      this.reporter.addError(
        errorTemplate,
        this.filePath,
        tok.line,
        tok.column,
        `expected ${type}, got ${tok.type} ("${tok.value}")`
      );
      // Return a synthetic token to allow parsing to continue
      return { type, value: "", line: tok.line, column: tok.column };
    }
    return this.advance();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.Eof;
  }
}

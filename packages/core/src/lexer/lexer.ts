// =============================================
// AI-Spec Language - Lexer
// =============================================

import { Scanner } from "./scanner.js";
import {
  type Token,
  TokenType,
  AT_KEYWORDS,
  PLAIN_KEYWORDS,
} from "./tokens.js";
import { ErrorReporter } from "../errors/reporter.js";
import * as E from "../errors/codes.js";

export class Lexer {
  private scanner: Scanner;
  private tokens: Token[] = [];

  constructor(
    private readonly source: string,
    private readonly filePath: string,
    private readonly reporter: ErrorReporter
  ) {
    this.scanner = new Scanner(source);
  }

  tokenize(): Token[] {
    while (!this.scanner.isAtEnd) {
      this.scanner.skipWhitespace();
      if (this.scanner.isAtEnd) break;
      this.scanToken();
    }
    this.tokens.push(this.makeToken(TokenType.Eof, ""));
    return this.tokens;
  }

  private scanToken(): void {
    const ch = this.scanner.peek();
    const line = this.scanner.line;
    const column = this.scanner.column;

    switch (ch) {
      case "{":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.LeftBrace, value: "{", line, column });
        return;
      case "}":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.RightBrace, value: "}", line, column });
        return;
      case "[":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.LeftBracket, value: "[", line, column });
        return;
      case "]":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.RightBracket, value: "]", line, column });
        return;
      case ":":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.Colon, value: ":", line, column });
        return;
      case ",":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.Comma, value: ",", line, column });
        return;
      case "(":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.LeftParen, value: "(", line, column });
        return;
      case ")":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.RightParen, value: ")", line, column });
        return;
      case ".":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.Dot, value: ".", line, column });
        return;
      case "+":
        this.scanner.advance();
        this.tokens.push({ type: TokenType.Plus, value: "+", line, column });
        return;

      // コメント or 除算
      case "/":
        this.scanner.advance();
        if (this.scanner.peek() === "/") {
          this.skipLineComment();
          return;
        }
        if (this.scanner.peek() === "*") {
          this.skipBlockComment(line, column);
          return;
        }
        // 単一の / は AI-Spec では未使用、エラー
        this.reporter.addError(E.E002_UNEXPECTED_TOKEN, this.filePath, line, column, "/");
        return;

      // 演算子
      case "=":
        this.scanner.advance();
        if (this.scanner.peek() === "=") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.Equals, value: "==", line, column });
        } else {
          this.tokens.push({ type: TokenType.Assign, value: "=", line, column });
        }
        return;
      case "!":
        this.scanner.advance();
        if (this.scanner.peek() === "=") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.NotEquals, value: "!=", line, column });
        } else {
          this.tokens.push({ type: TokenType.Not, value: "!", line, column });
        }
        return;
      case ">":
        this.scanner.advance();
        if (this.scanner.peek() === "=") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.Gte, value: ">=", line, column });
        } else {
          this.tokens.push({ type: TokenType.Greater, value: ">", line, column });
        }
        return;
      case "<":
        this.scanner.advance();
        if (this.scanner.peek() === "=") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.Lte, value: "<=", line, column });
        } else {
          this.tokens.push({ type: TokenType.Less, value: "<", line, column });
        }
        return;
      case "&":
        this.scanner.advance();
        if (this.scanner.peek() === "&") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.And, value: "&&", line, column });
        } else {
          this.reporter.addError(E.E002_UNEXPECTED_TOKEN, this.filePath, line, column, "&");
        }
        return;
      case "|":
        this.scanner.advance();
        if (this.scanner.peek() === "|") {
          this.scanner.advance();
          this.tokens.push({ type: TokenType.Or, value: "||", line, column });
        } else {
          this.reporter.addError(E.E002_UNEXPECTED_TOKEN, this.filePath, line, column, "|");
        }
        return;

      // 文字列
      case '"':
        this.scanString(line, column);
        return;

      // @ ディレクティブ
      case "@":
        this.scanAtToken(line, column);
        return;

      default:
        // 数値
        if (ch === "-" || isDigit(ch)) {
          this.scanNumber(line, column);
          return;
        }
        // 識別子 / キーワード (true, false, null, from)
        if (isAlpha(ch)) {
          this.scanIdentifier(line, column);
          return;
        }

        this.scanner.advance();
        this.reporter.addError(E.E002_UNEXPECTED_TOKEN, this.filePath, line, column, ch);
    }
  }

  // --- 文字列 ---
  private scanString(line: number, column: number): void {
    this.scanner.advance(); // skip opening "
    let value = "";
    while (!this.scanner.isAtEnd && this.scanner.peek() !== '"') {
      if (this.scanner.peek() === "\\") {
        this.scanner.advance();
        const esc = this.scanner.advance();
        switch (esc) {
          case '"':  value += '"'; break;
          case "\\": value += "\\"; break;
          case "/":  value += "/"; break;
          case "b":  value += "\b"; break;
          case "f":  value += "\f"; break;
          case "n":  value += "\n"; break;
          case "r":  value += "\r"; break;
          case "t":  value += "\t"; break;
          case "u": {
            let hex = "";
            for (let i = 0; i < 4; i++) hex += this.scanner.advance();
            value += String.fromCharCode(parseInt(hex, 16));
            break;
          }
          default:
            value += esc;
        }
      } else {
        value += this.scanner.advance();
      }
    }
    if (this.scanner.isAtEnd) {
      this.reporter.addError(E.E003_UNTERMINATED_STRING, this.filePath, line, column);
      return;
    }
    this.scanner.advance(); // skip closing "
    this.tokens.push({ type: TokenType.String, value, line, column });
  }

  // --- 数値 ---
  private scanNumber(line: number, column: number): void {
    let num = "";
    if (this.scanner.peek() === "-") {
      num += this.scanner.advance();
    }
    while (!this.scanner.isAtEnd && isDigit(this.scanner.peek())) {
      num += this.scanner.advance();
    }
    if (!this.scanner.isAtEnd && this.scanner.peek() === ".") {
      num += this.scanner.advance();
      while (!this.scanner.isAtEnd && isDigit(this.scanner.peek())) {
        num += this.scanner.advance();
      }
    }
    if (!this.scanner.isAtEnd && (this.scanner.peek() === "e" || this.scanner.peek() === "E")) {
      num += this.scanner.advance();
      if (!this.scanner.isAtEnd && (this.scanner.peek() === "+" || this.scanner.peek() === "-")) {
        num += this.scanner.advance();
      }
      while (!this.scanner.isAtEnd && isDigit(this.scanner.peek())) {
        num += this.scanner.advance();
      }
    }
    this.tokens.push({ type: TokenType.Number, value: num, line, column });
  }

  // --- 識別子 / キーワード ---
  private scanIdentifier(line: number, column: number): void {
    let name = "";
    while (!this.scanner.isAtEnd && isAlphaNumeric(this.scanner.peek())) {
      name += this.scanner.advance();
    }
    const kwType = PLAIN_KEYWORDS[name];
    if (kwType !== undefined) {
      this.tokens.push({ type: kwType, value: name, line, column });
    } else {
      this.tokens.push({ type: TokenType.Identifier, value: name, line, column });
    }
  }

  // --- @ トークン ---
  private scanAtToken(line: number, column: number): void {
    this.scanner.advance(); // skip @
    let name = "";
    while (!this.scanner.isAtEnd && isAlphaNumeric(this.scanner.peek())) {
      name += this.scanner.advance();
    }
    if (name === "") {
      this.reporter.addError(E.E002_UNEXPECTED_TOKEN, this.filePath, line, column, "@");
      return;
    }
    const kwType = AT_KEYWORDS[name];
    if (kwType !== undefined) {
      this.tokens.push({ type: kwType, value: `@${name}`, line, column });
    } else {
      this.tokens.push({ type: TokenType.AtIdentifier, value: name, line, column });
    }
  }

  // --- コメント ---
  private skipLineComment(): void {
    this.scanner.advance(); // skip second /
    while (!this.scanner.isAtEnd && this.scanner.peek() !== "\n") {
      this.scanner.advance();
    }
  }

  private skipBlockComment(line: number, column: number): void {
    this.scanner.advance(); // skip *
    while (!this.scanner.isAtEnd) {
      if (this.scanner.peek() === "*" && this.scanner.peekNext() === "/") {
        this.scanner.advance(); // *
        this.scanner.advance(); // /
        return;
      }
      this.scanner.advance();
    }
    this.reporter.addError(E.E004_UNTERMINATED_BLOCK_COMMENT, this.filePath, line, column);
  }

  // --- ヘルパー ---
  private makeToken(type: TokenType, value: string): Token {
    return { type, value, line: this.scanner.line, column: this.scanner.column };
  }
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function isAlpha(ch: string): boolean {
  return (ch >= "a" && ch <= "z") || (ch >= "A" && ch <= "Z") || ch === "_";
}

function isAlphaNumeric(ch: string): boolean {
  return isAlpha(ch) || isDigit(ch);
}

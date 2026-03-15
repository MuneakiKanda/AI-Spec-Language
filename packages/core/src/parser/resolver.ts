// =============================================
// AI-Spec Language - Resolver
// @import, @include, @let の解決
// 変数参照の展開
// =============================================

import type { JsonValue, JsonObject, FileResolver } from "../types.js";
import { ErrorReporter } from "../errors/reporter.js";
import * as E from "../errors/codes.js";
import { Lexer } from "../lexer/lexer.js";
import { Parser } from "./parser.js";
import type {
  AstNode,
  AiSpecFile,
  Directive,
  ImportStatement,
  IncludeStatement,
  LetStatement,
} from "./ast.js";

export class Resolver {
  private variables = new Map<string, AstNode>();
  private importStack: string[] = [];
  readonly includesResolved: string[] = [];

  constructor(
    private readonly filePath: string,
    private readonly reporter: ErrorReporter,
    private readonly fileResolver: FileResolver | null
  ) {
    // 自分自身を importStack に入れることで、循環参照を検知できる
    this.importStack.push(this.normalizePath(filePath));
  }

  /** Resolve all directives, populating the variable table. */
  resolveDirectives(directives: Directive[]): void {
    for (const d of directives) {
      switch (d.kind) {
        case "import":
          this.resolveImport(d);
          break;
        case "include":
          this.resolveInclude(d);
          break;
        case "let":
          this.resolveLet(d);
          break;
      }
    }
  }

  /** Recursively expand variable references in the AST. */
  expandReferences(node: AstNode): AstNode {
    switch (node.type) {
      case "variable_ref": {
        const resolved = this.variables.get(node.name);
        if (!resolved) {
          this.reporter.addError(
            E.E304_UNDEFINED_VARIABLE,
            this.filePath,
            node.line,
            node.column,
            `@${node.name}`,
            { suggestion: `定義済みの変数: ${[...this.variables.keys()].join(", ")}` }
          );
          return { type: "literal", value: null, line: node.line, column: node.column };
        }
        return this.expandReferences(resolved);
      }

      case "ref_shorthand": {
        const resolved = this.variables.get(node.refName);
        if (!resolved) {
          this.reporter.addError(
            E.E304_UNDEFINED_VARIABLE,
            this.filePath,
            node.line,
            node.column,
            `@ref(${node.refName})`,
            { suggestion: `定義済みの変数: ${[...this.variables.keys()].join(", ")}` }
          );
          return { type: "literal", value: null, line: node.line, column: node.column };
        }
        return this.expandReferences(resolved);
      }

      case "object": {
        const newProps = new Map<string, AstNode>();
        for (const [key, val] of node.properties) {
          newProps.set(key, this.expandReferences(val));
        }
        return { ...node, properties: newProps };
      }

      case "array":
        return { ...node, elements: node.elements.map((e) => this.expandReferences(e)) };

      case "merge":
        return {
          ...node,
          left: this.expandReferences(node.left),
          right: this.expandReferences(node.right),
        };

      case "conditional":
        return {
          ...node,
          thenBranch: this.expandReferences(node.thenBranch),
          elifBranches: node.elifBranches.map((b) => ({
            condition: b.condition,
            branch: this.expandReferences(b.branch),
          })),
          elseBranch: node.elseBranch ? this.expandReferences(node.elseBranch) : null,
        };

      case "type_shorthand": {
        const newParams = new Map<string, AstNode>();
        for (const [k, v] of node.params) {
          newParams.set(k, this.expandReferences(v));
        }
        return { ...node, params: newParams };
      }

      default:
        return node;
    }
  }

  getVariable(name: string): AstNode | undefined {
    return this.variables.get(name);
  }

  getVariableNames(): string[] {
    return [...this.variables.keys()];
  }

  // --- import ---

  private resolveImport(stmt: ImportStatement): void {
    if (!this.fileResolver) {
      this.reporter.addError(
        E.E104_FILE_NOT_FOUND,
        this.filePath,
        stmt.line,
        stmt.column,
        stmt.path,
        { suggestion: "FileResolver が提供されていません" }
      );
      return;
    }

    const resolvedPath = this.normalizePath(stmt.path);

    // 循環インポート検知
    if (this.importStack.includes(resolvedPath)) {
      this.reporter.addError(
        E.E101_CIRCULAR_IMPORT,
        this.filePath,
        stmt.line,
        stmt.column,
        `${this.importStack.join(" → ")} → ${resolvedPath}`
      );
      return;
    }

    const source = this.fileResolver(resolvedPath, this.filePath);
    if (source === null) {
      this.reporter.addError(
        E.E104_FILE_NOT_FOUND,
        this.filePath,
        stmt.line,
        stmt.column,
        resolvedPath
      );
      return;
    }

    // 再帰パース
    this.importStack.push(resolvedPath);
    const childReporter = new ErrorReporter();
    const lexer = new Lexer(source, resolvedPath, childReporter);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, resolvedPath, childReporter);
    const file = parser.parse();

    // 子ファイルのディレクティブも解決
    const childResolver = new Resolver(resolvedPath, childReporter, this.fileResolver);
    childResolver.importStack = [...this.importStack];
    childResolver.resolveDirectives(file.directives);

    this.importStack.pop();

    // 子のエラーを転送
    for (const err of childReporter.errors) this.reporter.errors.push(err);
    for (const warn of childReporter.warnings) this.reporter.warnings.push(warn);

    if (childReporter.hasErrors) {
      this.reporter.addError(
        E.E102_IMPORT_PARSE_FAILED,
        this.filePath,
        stmt.line,
        stmt.column,
        stmt.path
      );
      return;
    }

    // 名前付きインポート: 子ファイルの @let で定義された変数を取り込む
    for (const name of stmt.names) {
      const imported = childResolver.getVariable(name);
      if (imported) {
        this.variables.set(name, imported);
      } else {
        this.reporter.addError(
          E.E103_IMPORT_NAME_NOT_FOUND,
          this.filePath,
          stmt.line,
          stmt.column,
          `"${name}" in ${stmt.path}`,
          { suggestion: `利用可能な名前: ${childResolver.getVariableNames().join(", ")}` }
        );
      }
    }

    this.includesResolved.push(resolvedPath);
  }

  // --- include ---

  private resolveInclude(stmt: IncludeStatement): void {
    if (!this.fileResolver) {
      this.reporter.addError(
        E.E104_FILE_NOT_FOUND,
        this.filePath,
        stmt.line,
        stmt.column,
        stmt.path
      );
      return;
    }

    const resolvedPath = this.normalizePath(stmt.path);
    const source = this.fileResolver(resolvedPath, this.filePath);
    if (source === null) {
      this.reporter.addError(
        E.E104_FILE_NOT_FOUND,
        this.filePath,
        stmt.line,
        stmt.column,
        stmt.path
      );
      return;
    }

    // include先をパースし、全ての @let をここに取り込む
    const childReporter = new ErrorReporter();
    const lexer = new Lexer(source, resolvedPath, childReporter);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens, resolvedPath, childReporter);
    const file = parser.parse();

    const childResolver = new Resolver(resolvedPath, childReporter, this.fileResolver);
    childResolver.resolveDirectives(file.directives);

    for (const err of childReporter.errors) this.reporter.errors.push(err);
    for (const warn of childReporter.warnings) this.reporter.warnings.push(warn);

    // 子ファイルの全変数をマージ
    for (const name of childResolver.getVariableNames()) {
      this.variables.set(name, childResolver.getVariable(name)!);
    }

    this.includesResolved.push(resolvedPath);
  }

  // --- let ---

  private resolveLet(stmt: LetStatement): void {
    if (this.variables.has(stmt.name)) {
      this.reporter.addWarning(
        E.W001_VARIABLE_REDEFINED,
        this.filePath,
        stmt.line,
        stmt.column,
        `変数 "${stmt.name}" が再定義されています`
      );
    }
    this.variables.set(stmt.name, stmt.value);
  }

  private normalizePath(p: string): string {
    let normalized = p.replace(/\\/g, "/");
    if (!normalized.endsWith(".aispec")) {
      normalized += ".aispec";
    }
    return normalized;
  }
}

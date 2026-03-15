// =============================================
// AI-Spec Language - Public API
// =============================================

export { Lexer } from "./lexer/lexer.js";
export { Scanner } from "./lexer/scanner.js";
export { TokenType } from "./lexer/tokens.js";
export type { Token } from "./lexer/tokens.js";

export { Parser } from "./parser/parser.js";
export { Resolver } from "./parser/resolver.js";
export { Evaluator } from "./parser/evaluator.js";
export { Emitter } from "./parser/emitter.js";
export type { AstNode, AiSpecFile, Directive, VersionStatement, ExpressionNode } from "./parser/ast.js";

export { ErrorReporter } from "./errors/reporter.js";
export * as ErrorCodes from "./errors/codes.js";

export type {
  JsonValue,
  JsonObject,
  AiSpecError,
  ParseResult,
  ParseMetadata,
  ErrorReport,
  FileResolver,
} from "./types.js";

import { Lexer } from "./lexer/lexer.js";
import { Parser } from "./parser/parser.js";
import { Resolver } from "./parser/resolver.js";
import { Evaluator } from "./parser/evaluator.js";
import { Emitter } from "./parser/emitter.js";
import { ErrorReporter } from "./errors/reporter.js";
import * as ErrorCodes from "./errors/codes.js";
import type { ParseResult, FileResolver } from "./types.js";

export interface ParseOptions {
  /** 外部変数（@if 条件で使用） */
  env?: Record<string, string>;
  /** ファイル解決コールバック（@import, @include 用） */
  fileResolver?: FileResolver;
}

/**
 * .aispec ソースコードをパースし、純粋な JSON に変換する。
 *
 * @param source - .aispec ファイルの内容
 * @param filePath - ファイルパス（エラー表示・メタデータ用）
 * @param options - パースオプション
 */
export function parse(
  source: string,
  filePath: string,
  options: ParseOptions = {}
): ParseResult {
  const reporter = new ErrorReporter();
  const env = options.env ?? {};

  // Phase 1: Tokenize
  const lexer = new Lexer(source, filePath, reporter);
  const tokens = lexer.tokenize();

  // Phase 2-3: Parse (directives + body)
  const parser = new Parser(tokens, filePath, reporter);
  const file = parser.parse();

  // Version compatibility check
  const PARSER_VERSION = "0.2";
  if (file.version && file.version !== PARSER_VERSION) {
    reporter.addWarning(
      ErrorCodes.W004_VERSION_MISMATCH,
      filePath,
      1,
      1,
      `file: ${file.version}, parser: ${PARSER_VERSION}`
    );
  }

  // Phase 4: Resolve directives (@import, @include, @let)
  const resolver = new Resolver(filePath, reporter, options.fileResolver ?? null);
  resolver.resolveDirectives(file.directives);

  if (!file.body) {
    // ディレクティブのみのファイル（ライブラリ）
    const emitter = new Emitter(filePath, resolver.includesResolved, env, file.version);
    return {
      success: !reporter.hasErrors,
      output: null,
      errors: reporter.errors,
      warnings: reporter.warnings,
      metadata: emitter.buildMetadata(),
    };
  }

  // Phase 5: Expand variable references
  const expanded = resolver.expandReferences(file.body);

  // Phase 6: Evaluate conditions
  const evaluator = new Evaluator(filePath, reporter, env);
  const evaluated = evaluator.evaluate(expanded);

  // Phase 7: Emit pure JSON + metadata
  const emitter = new Emitter(filePath, resolver.includesResolved, env, file.version);
  const output = emitter.emit(evaluated);
  const withMetadata = emitter.attachMetadata(output);

  return {
    success: !reporter.hasErrors,
    output: withMetadata,
    errors: reporter.errors,
    warnings: reporter.warnings,
    metadata: emitter.buildMetadata(),
  };
}

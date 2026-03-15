// =============================================
// AI-Spec Language - エラーレポーター
// =============================================

import type { AiSpecError, ErrorReport } from "../types.js";
import type { ErrorTemplate } from "./codes.js";

export class ErrorReporter {
  readonly errors: AiSpecError[] = [];
  readonly warnings: AiSpecError[] = [];

  addError(
    template: ErrorTemplate,
    file: string,
    line: number,
    column: number,
    context?: string,
    options?: { suggestion?: string; related?: string[] }
  ): void {
    this.errors.push({
      code: template.code,
      severity: "error",
      message: template.message,
      file,
      line,
      column,
      context: context ?? "",
      suggestion: options?.suggestion ?? template.suggestion ?? "",
      related: options?.related,
    });
  }

  addWarning(
    template: ErrorTemplate,
    file: string,
    line: number,
    column: number,
    context?: string
  ): void {
    this.warnings.push({
      code: template.code,
      severity: "warning",
      message: template.message,
      file,
      line,
      column,
      context: context ?? "",
      suggestion: template.suggestion ?? "",
    });
  }

  addErrorRaw(
    code: string,
    message: string,
    file: string,
    line: number,
    column: number,
    context?: string,
    suggestion?: string
  ): void {
    this.errors.push({
      code,
      severity: "error",
      message,
      file,
      line,
      column,
      context: context ?? "",
      suggestion: suggestion ?? "",
    });
  }

  get hasErrors(): boolean {
    return this.errors.length > 0;
  }

  toReport(): ErrorReport {
    return {
      errors: this.errors,
      warnings: this.warnings,
      summary: {
        total_errors: this.errors.length,
        total_warnings: this.warnings.length,
        parseable: this.errors.length === 0,
      },
    };
  }
}

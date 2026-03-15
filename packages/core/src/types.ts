// =============================================
// AI-Spec Language - 共通型定義
// =============================================

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | JsonObject;

export type JsonObject = { [key: string]: JsonValue };

export interface AiSpecError {
  code: string;
  severity: "error" | "warning";
  message: string;
  file: string;
  line: number;
  column: number;
  context: string;
  suggestion: string;
  related?: string[];
}

export interface ParseMetadata {
  version: string;
  parsed_from: string;
  parsed_at: string;
  includes_resolved: string[];
  conditions_evaluated: Record<string, string>;
}

export interface ParseResult {
  success: boolean;
  output: JsonValue | null;
  errors: AiSpecError[];
  warnings: AiSpecError[];
  metadata: ParseMetadata;
}

export interface ErrorReport {
  errors: AiSpecError[];
  warnings: AiSpecError[];
  summary: {
    total_errors: number;
    total_warnings: number;
    parseable: boolean;
  };
}

/** Callback for resolving external files (import/include). */
export type FileResolver = (
  path: string,
  fromFile: string
) => string | null;

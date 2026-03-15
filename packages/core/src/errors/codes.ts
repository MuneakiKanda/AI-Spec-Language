// =============================================
// AI-Spec Language - エラーコード定義
// =============================================

export interface ErrorTemplate {
  code: string;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
}

// --- 構文エラー (E001-E099) ---
export const E001_UNEXPECTED_PARSE_ERROR: ErrorTemplate = {
  code: "E001",
  severity: "error",
  message: "予期しないパースエラー",
};

export const E002_UNEXPECTED_TOKEN: ErrorTemplate = {
  code: "E002",
  severity: "error",
  message: "予期しないトークン",
};

export const E003_UNTERMINATED_STRING: ErrorTemplate = {
  code: "E003",
  severity: "error",
  message: "文字列が閉じられていません",
  suggestion: '閉じクォート " を追加してください',
};

export const E004_UNTERMINATED_BLOCK_COMMENT: ErrorTemplate = {
  code: "E004",
  severity: "error",
  message: "ブロックコメントが閉じられていません",
  suggestion: "*/ を追加してください",
};

export const E005_EXPECTED_COLON: ErrorTemplate = {
  code: "E005",
  severity: "error",
  message: "オブジェクトのキーの後に : が必要です",
};

export const E006_EXPECTED_VALUE: ErrorTemplate = {
  code: "E006",
  severity: "error",
  message: "値が必要です",
};

export const E007_TRAILING_COMMA: ErrorTemplate = {
  code: "E007",
  severity: "error",
  message: "末尾のカンマの後に値がありません",
};

export const E008_INVALID_NUMBER: ErrorTemplate = {
  code: "E008",
  severity: "error",
  message: "無効な数値リテラル",
};

export const E009_EXPECTED_PROPERTY_KEY: ErrorTemplate = {
  code: "E009",
  severity: "error",
  message: "プロパティキー（文字列）が必要です",
};

export const E010_EXPECTED_ASSIGNMENT: ErrorTemplate = {
  code: "E010",
  severity: "error",
  message: "@let の後に = が必要です",
};

export const E011_EXPECTED_FROM: ErrorTemplate = {
  code: "E011",
  severity: "error",
  message: '@import の後に from "path" が必要です',
};

export const E012_EXPECTED_BRACE: ErrorTemplate = {
  code: "E012",
  severity: "error",
  message: "{ が必要です",
};

// --- インポートエラー (E100-E199) ---
export const E101_CIRCULAR_IMPORT: ErrorTemplate = {
  code: "E101",
  severity: "error",
  message: "循環インポートが検出されました",
  suggestion: "共通部分を別ファイルに抽出してください",
};

export const E102_IMPORT_PARSE_FAILED: ErrorTemplate = {
  code: "E102",
  severity: "error",
  message: "インポートファイルのパースに失敗",
};

export const E103_IMPORT_NAME_NOT_FOUND: ErrorTemplate = {
  code: "E103",
  severity: "error",
  message: "インポート先に指定された名前が存在しません",
};

export const E104_FILE_NOT_FOUND: ErrorTemplate = {
  code: "E104",
  severity: "error",
  message: "ファイルが見つかりません",
};

// --- 型エラー (E200-E299) ---
export const E201_TYPE_MISMATCH: ErrorTemplate = {
  code: "E201",
  severity: "error",
  message: "型ミスマッチ",
};

// --- 式エラー (E300-E399) ---
export const E301_CONDITION_NOT_BOOLEAN: ErrorTemplate = {
  code: "E301",
  severity: "error",
  message: "条件式がboolean以外に評価されました",
  suggestion: "比較演算子（==, != など）を使用してください",
};

export const E302_DOT_DEPTH_EXCEEDED: ErrorTemplate = {
  code: "E302",
  severity: "error",
  message: "ドット記法は最大3レベルまでです",
};

export const E303_UNKNOWN_EXPRESSION: ErrorTemplate = {
  code: "E303",
  severity: "error",
  message: "未知の式タイプ",
};

export const E304_UNDEFINED_VARIABLE: ErrorTemplate = {
  code: "E304",
  severity: "error",
  message: "未定義の変数",
};

// --- 警告 (W001-W099) ---
export const W001_VARIABLE_REDEFINED: ErrorTemplate = {
  code: "W001",
  severity: "warning",
  message: "変数が再定義されています",
};

export const W002_UNUSED_VARIABLE: ErrorTemplate = {
  code: "W002",
  severity: "warning",
  message: "未使用の変数",
};

export const W003_UNUSED_IMPORT: ErrorTemplate = {
  code: "W003",
  severity: "warning",
  message: "未使用のインポート",
};

export const W004_VERSION_MISMATCH: ErrorTemplate = {
  code: "W004",
  severity: "warning",
  message: "@version がパーサーバージョンと一致しません",
};

export const E013_DUPLICATE_VERSION: ErrorTemplate = {
  code: "E013",
  severity: "error",
  message: "@version は1ファイルにつき1つだけ指定できます",
};

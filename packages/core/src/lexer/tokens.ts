// =============================================
// AI-Spec Language - トークン定義
// =============================================

export enum TokenType {
  // JSON 標準
  LeftBrace = "LeftBrace",         // {
  RightBrace = "RightBrace",       // }
  LeftBracket = "LeftBracket",     // [
  RightBracket = "RightBracket",   // ]
  Colon = "Colon",                 // :
  Comma = "Comma",                 // ,
  String = "String",
  Number = "Number",
  Boolean = "Boolean",             // true | false
  Null = "Null",                   // null

  // AI-Spec 拡張 (Layer 1)
  AtLet = "AtLet",                 // @let
  AtImport = "AtImport",           // @import
  AtInclude = "AtInclude",         // @include
  AtIf = "AtIf",                   // @if
  AtElif = "AtElif",               // @elif
  AtElse = "AtElse",               // @else
  AtType = "AtType",               // @type
  AtRef = "AtRef",                 // @ref
  AtVersion = "AtVersion",           // @version
  AtIdentifier = "AtIdentifier",   // @<name>

  // 式の演算子
  Equals = "Equals",               // ==
  NotEquals = "NotEquals",         // !=
  Greater = "Greater",             // >
  Less = "Less",                   // <
  Gte = "Gte",                     // >=
  Lte = "Lte",                     // <=
  And = "And",                     // &&
  Or = "Or",                       // ||
  Not = "Not",                     // !
  Dot = "Dot",                     // .
  Plus = "Plus",                   // +

  // 括弧
  LeftParen = "LeftParen",         // (
  RightParen = "RightParen",       // )

  // 識別子（式の中）
  Identifier = "Identifier",

  // @import 用
  From = "From",                   // from

  // 代入
  Assign = "Assign",               // = (単一の =)

  // 制御
  Eof = "Eof",
}

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/** @keywords マッピング */
export const AT_KEYWORDS: Record<string, TokenType> = {
  let: TokenType.AtLet,
  import: TokenType.AtImport,
  include: TokenType.AtInclude,
  if: TokenType.AtIf,
  elif: TokenType.AtElif,
  else: TokenType.AtElse,
  type: TokenType.AtType,
  ref: TokenType.AtRef,
  version: TokenType.AtVersion,
};

/** 通常キーワード */
export const PLAIN_KEYWORDS: Record<string, TokenType> = {
  true: TokenType.Boolean,
  false: TokenType.Boolean,
  null: TokenType.Null,
  from: TokenType.From,
};

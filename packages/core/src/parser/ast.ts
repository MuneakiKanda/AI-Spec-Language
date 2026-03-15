// =============================================
// AI-Spec Language - AST ノード型定義
// =============================================

export type AstNode =
  | ObjectNode
  | ArrayNode
  | LiteralNode
  | VariableRefNode
  | ConditionalNode
  | TypeShorthandNode
  | RefShorthandNode
  | MergeNode;

export interface ObjectNode {
  type: "object";
  properties: Map<string, AstNode>;
  line: number;
  column: number;
}

export interface ArrayNode {
  type: "array";
  elements: AstNode[];
  line: number;
  column: number;
}

export interface LiteralNode {
  type: "literal";
  value: string | number | boolean | null;
  line: number;
  column: number;
}

export interface VariableRefNode {
  type: "variable_ref";
  name: string;
  line: number;
  column: number;
}

export interface ConditionalNode {
  type: "conditional";
  condition: ExpressionNode;
  thenBranch: AstNode;
  elifBranches: { condition: ExpressionNode; branch: AstNode }[];
  elseBranch: AstNode | null;
  line: number;
  column: number;
}

/** @type("string", format="email", maxLength=254) */
export interface TypeShorthandNode {
  type: "type_shorthand";
  typeName: string;
  params: Map<string, AstNode>;
  line: number;
  column: number;
}

/** @ref(EmailAddress) */
export interface RefShorthandNode {
  type: "ref_shorthand";
  refName: string;
  line: number;
  column: number;
}

/** left + right (object merge) */
export interface MergeNode {
  type: "merge";
  left: AstNode;
  right: AstNode;
  line: number;
  column: number;
}

// --- ディレクティブ（トップレベル文） ---

export interface LetStatement {
  kind: "let";
  name: string;
  value: AstNode;
  line: number;
  column: number;
}

export interface ImportStatement {
  kind: "import";
  names: string[];
  path: string;
  line: number;
  column: number;
}

export interface IncludeStatement {
  kind: "include";
  path: string;
  line: number;
  column: number;
}

export interface VersionStatement {
  kind: "version";
  versionString: string;
  line: number;
  column: number;
}

export type Directive = VersionStatement | LetStatement | ImportStatement | IncludeStatement;

export interface AiSpecFile {
  version?: string;
  directives: Directive[];
  body: AstNode | null;
}

// --- 式ノード ---

export type ExpressionNode =
  | LiteralExpr
  | VariableExpr
  | ComparisonExpr
  | LogicalAndExpr
  | LogicalOrExpr
  | LogicalNotExpr
  | ParenExpr;

export interface LiteralExpr {
  type: "literal";
  value: string | number | boolean | null;
}

export interface VariableExpr {
  type: "variable_ref";
  parts: string[];
}

export interface ComparisonExpr {
  type: "comparison";
  left: ExpressionNode;
  operator: "==" | "!=" | ">" | "<" | ">=" | "<=";
  right: ExpressionNode;
}

export interface LogicalAndExpr {
  type: "logical_and";
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface LogicalOrExpr {
  type: "logical_or";
  left: ExpressionNode;
  right: ExpressionNode;
}

export interface LogicalNotExpr {
  type: "logical_not";
  operand: ExpressionNode;
}

export interface ParenExpr {
  type: "paren";
  inner: ExpressionNode;
}

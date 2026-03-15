// =============================================
// AI-Spec Language - Evaluator
// 条件分岐＋式の評価
// =============================================

import type { JsonValue } from "../types.js";
import { ErrorReporter } from "../errors/reporter.js";
import * as E from "../errors/codes.js";
import type { AstNode, ExpressionNode } from "./ast.js";

export class Evaluator {
  constructor(
    private readonly filePath: string,
    private readonly reporter: ErrorReporter,
    private readonly env: Record<string, string>
  ) {}

  /** Evaluate all conditional nodes, resolving @if/@elif/@else. */
  evaluate(node: AstNode): AstNode {
    switch (node.type) {
      case "conditional": {
        const condResult = this.evaluateExpression(node.condition);

        if (typeof condResult !== "boolean") {
          this.reporter.addError(
            E.E301_CONDITION_NOT_BOOLEAN,
            this.filePath,
            node.line,
            node.column,
            `結果: ${typeof condResult} (${JSON.stringify(condResult)})`
          );
          return node.elseBranch
            ? this.evaluate(node.elseBranch)
            : { type: "literal", value: null, line: node.line, column: node.column };
        }

        if (condResult) {
          return this.evaluate(node.thenBranch);
        }

        for (const elif of node.elifBranches) {
          const elifResult = this.evaluateExpression(elif.condition);
          if (elifResult === true) {
            return this.evaluate(elif.branch);
          }
        }

        return node.elseBranch
          ? this.evaluate(node.elseBranch)
          : { type: "literal", value: null, line: node.line, column: node.column };
      }

      case "object": {
        const newProps = new Map<string, AstNode>();
        for (const [key, value] of node.properties) {
          newProps.set(key, this.evaluate(value));
        }
        return { ...node, properties: newProps };
      }

      case "array":
        return { ...node, elements: node.elements.map((e) => this.evaluate(e)) };

      case "merge":
        return { ...node, left: this.evaluate(node.left), right: this.evaluate(node.right) };

      default:
        return node;
    }
  }

  // --- 式評価 ---

  evaluateExpression(expr: ExpressionNode): JsonValue {
    switch (expr.type) {
      case "literal":
        return expr.value;

      case "variable_ref": {
        // ドット記法の深さチェック（最大3レベル）
        if (expr.parts.length > 3) {
          this.reporter.addErrorRaw(
            E.E302_DOT_DEPTH_EXCEEDED.code,
            E.E302_DOT_DEPTH_EXCEEDED.message,
            this.filePath,
            0,
            0,
            `${expr.parts.join(".")} (${expr.parts.length}レベル)`,
            `${expr.parts.slice(0, 3).join(".")} に変更してください`
          );
          return null;
        }
        return this.resolveVariableRef(expr.parts);
      }

      case "comparison": {
        const left = this.evaluateExpression(expr.left);
        const right = this.evaluateExpression(expr.right);
        return this.compareValues(left, expr.operator, right);
      }

      case "logical_and": {
        const left = this.evaluateExpression(expr.left);
        if (!left) return left;
        return this.evaluateExpression(expr.right);
      }

      case "logical_or": {
        const left = this.evaluateExpression(expr.left);
        if (left) return left;
        return this.evaluateExpression(expr.right);
      }

      case "logical_not":
        return !this.evaluateExpression(expr.operand);

      case "paren":
        return this.evaluateExpression(expr.inner);

      default:
        return null;
    }
  }

  private resolveVariableRef(parts: string[]): JsonValue {
    // env 変数として解決を試行
    if (parts.length === 1) {
      const envVal = this.env[parts[0]];
      if (envVal !== undefined) return envVal;
    }
    // 未解決の場合は識別子名をそのまま返す（比較用）
    return parts.join(".");
  }

  private compareValues(
    left: JsonValue,
    op: "==" | "!=" | ">" | "<" | ">=" | "<=",
    right: JsonValue
  ): boolean {
    switch (op) {
      case "==": return left === right;
      case "!=": return left !== right;
      case ">":  return (left as number) > (right as number);
      case "<":  return (left as number) < (right as number);
      case ">=": return (left as number) >= (right as number);
      case "<=": return (left as number) <= (right as number);
    }
  }
}

// =============================================
// AI-Spec Language - Emitter
// AST → 純粋 JSON 変換 + メタデータ付与
// =============================================

import type { JsonValue, JsonObject, ParseMetadata } from "../types.js";
import type { AstNode } from "./ast.js";

export class Emitter {
  constructor(
    private readonly filePath: string,
    private readonly includesResolved: string[],
    private readonly conditionsEvaluated: Record<string, string>,
    private readonly fileVersion?: string
  ) {}

  /** AST を 純粋な JSON に変換 */
  emit(node: AstNode): JsonValue {
    switch (node.type) {
      case "literal":
        return node.value;

      case "object": {
        const obj: JsonObject = {};
        for (const [key, val] of node.properties) {
          obj[key] = this.emit(val);
        }
        return obj;
      }

      case "array":
        return node.elements.map((e) => this.emit(e));

      case "type_shorthand":
        return this.emitTypeShorthand(node);

      case "merge":
        return this.emitMerge(node);

      case "variable_ref":
        // If still unresolved, emit as null
        return null;

      case "ref_shorthand":
        return null;

      case "conditional":
        // Should be resolved by evaluator, but fallback
        return null;
    }
  }

  /** 出力 JSON にメタデータを付与 */
  attachMetadata(output: JsonValue): JsonValue {
    if (typeof output === "object" && output !== null && !Array.isArray(output)) {
      return {
        _aispec: this.buildMetadata() as unknown as JsonObject,
        ...output,
      };
    }
    return output;
  }

  buildMetadata(): ParseMetadata {
    return {
      version: this.fileVersion ?? "0.2",
      parsed_from: this.filePath,
      parsed_at: new Date().toISOString(),
      includes_resolved: this.includesResolved,
      conditions_evaluated: this.conditionsEvaluated,
    };
  }

  // --- @type shorthand → JSON ---

  private emitTypeShorthand(node: AstNode & { type: "type_shorthand" }): JsonValue {
    const constraints: JsonObject = {};
    for (const [key, val] of node.params) {
      const emitted = this.emit(val);
      // "values" パラメータがカンマ区切り文字列の場合、配列に変換
      if (key === "values" && typeof emitted === "string" && emitted.includes(",")) {
        constraints[key] = emitted.split(",").map((s) => s.trim());
      } else {
        constraints[key] = emitted;
      }
    }

    if (Object.keys(constraints).length === 0) {
      return { "@type": node.typeName };
    }

    return {
      "@type": node.typeName,
      constraints,
    };
  }

  // --- merge (shallow) ---

  private emitMerge(node: AstNode & { type: "merge" }): JsonValue {
    const left = this.emit(node.left);
    const right = this.emit(node.right);

    if (
      typeof left === "object" && left !== null && !Array.isArray(left) &&
      typeof right === "object" && right !== null && !Array.isArray(right)
    ) {
      return { ...left, ...right };
    }

    // Non-object merge: return right (override)
    return right;
  }
}

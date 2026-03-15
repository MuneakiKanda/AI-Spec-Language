// =============================================
// AI-Spec Language - E2E Integration Tests
// =============================================

import { describe, it, expect } from "vitest";
import { parse, PARSER_VERSION } from "./index.js";
import type { FileResolver, JsonObject } from "./types.js";

describe("parse() E2E", () => {
  it("純粋 JSON をそのままパース", () => {
    const result = parse('{ "name": "test", "count": 42 }', "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    expect(output["name"]).toBe("test");
    expect(output["count"]).toBe(42);
    expect(output["_aispec"]).toBeDefined();
  });

  it("コメント付き JSON", () => {
    const source = `
      // This is a comment
      {
        "name": "test", /* inline */
        "active": true
      }
    `;
    const result = parse(source, "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    expect(output["name"]).toBe("test");
    expect(output["active"]).toBe(true);
  });

  it("@let + 変数参照", () => {
    const source = `
      @let greeting = "hello"
      { "message": @greeting }
    `;
    const result = parse(source, "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    expect(output["message"]).toBe("hello");
  });

  it("@let オブジェクト + 参照展開", () => {
    const source = `
      @let config = { "host": "localhost", "port": 8080 }
      { "server": @config }
    `;
    const result = parse(source, "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    const server = output["server"] as JsonObject;
    expect(server["host"]).toBe("localhost");
    expect(server["port"]).toBe(8080);
  });

  it("@if 条件分岐 (env=production)", () => {
    const source = `
      @let env = "production"
      { "max": @if env == "production" { 10000 } @else { 100 } }
    `;
    const result = parse(source, "test.aispec", { env: { env: "production" } });
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    expect(output["max"]).toBe(10000);
  });

  it("@if 条件分岐 (env=development)", () => {
    const source = `
      @let env = "development"
      { "max": @if env == "production" { 10000 } @else { 100 } }
    `;
    const result = parse(source, "test.aispec", { env: { env: "development" } });
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    expect(output["max"]).toBe(100);
  });

  it("@type ショートハンド → JSON 展開", () => {
    const source = `
      { "email": @type("string", format="email", maxLength=254) }
    `;
    const result = parse(source, "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    const email = output["email"] as JsonObject;
    expect(email["@type"]).toBe("string");
    expect((email["constraints"] as JsonObject)["format"]).toBe("email");
    expect((email["constraints"] as JsonObject)["maxLength"]).toBe(254);
  });

  it("+ マージ演算子", () => {
    const source = `
      @let base = { "a": 1, "b": 2 }
      { "merged": @base + { "b": 99, "c": 3 } }
    `;
    const result = parse(source, "test.aispec");
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    const merged = output["merged"] as JsonObject;
    expect(merged["a"]).toBe(1);
    expect(merged["b"]).toBe(99); // overridden
    expect(merged["c"]).toBe(3);
  });

  it("@import で変数を取り込む", () => {
    const files: Record<string, string> = {
      "common/types.aispec": '@let UserId = @type("string", format="uuid")',
    };
    const fileResolver: FileResolver = (path) => files[path] ?? null;

    const source = `
      @import { UserId } from "common/types"
      { "user_id": @UserId }
    `;
    const result = parse(source, "test.aispec", { fileResolver });
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    const userId = output["user_id"] as JsonObject;
    expect(userId["@type"]).toBe("string");
  });

  it("未定義変数でエラー", () => {
    const source = '{ "val": @undefined_var }';
    const result = parse(source, "test.aispec");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].code).toBe("E304");
  });

  it("_aispec メタデータが付与される", () => {
    const result = parse('{ "test": true }', "my/file.aispec", {
      env: { env: "production" },
    });
    expect(result.success).toBe(true);
    const output = result.output as JsonObject;
    const meta = output["_aispec"] as JsonObject;
    expect(meta["version"]).toBe(PARSER_VERSION);
    expect(meta["parsed_from"]).toBe("my/file.aispec");
    expect(meta["conditions_evaluated"]).toEqual({ env: "production" });
  });

  it("ディレクティブのみのファイル（ライブラリ）", () => {
    const source = `
      @let UserId = @type("string", format="uuid")
      @let Email = @type("string", format="email")
    `;
    const result = parse(source, "common/types.aispec");
    expect(result.success).toBe(true);
    expect(result.output).toBeNull();
  });

  describe("@version ディレクティブ", () => {
    it("@version 指定でメタデータに反映される", () => {
      const source = `
        @version "${PARSER_VERSION}"
        { "name": "test" }
      `;
      const result = parse(source, "test.aispec");
      expect(result.success).toBe(true);
      const output = result.output as JsonObject;
      const meta = output["_aispec"] as JsonObject;
      expect(meta["version"]).toBe(PARSER_VERSION);
    });

    it("@version なしでもパースできる（任意）", () => {
      const source = '{ "name": "test" }';
      const result = parse(source, "test.aispec");
      expect(result.success).toBe(true);
      expect(result.metadata?.version).toBe(PARSER_VERSION);
    });

    it("@version が不一致の場合 W004 警告", () => {
      const source = `
        @version "0.3"
        { "name": "test" }
      `;
      const result = parse(source, "test.aispec");
      expect(result.success).toBe(true);
      expect(result.warnings.some((w) => w.code === "W004")).toBe(true);
      const output = result.output as JsonObject;
      const meta = output["_aispec"] as JsonObject;
      expect(meta["version"]).toBe("0.3");
    });

    it("@version が重複した場合 E013 エラー", () => {
      const source = `
        @version "${PARSER_VERSION}"
        @version "${PARSER_VERSION}"
        { "name": "test" }
      `;
      const result = parse(source, "test.aispec");
      expect(result.errors.some((e) => e.code === "E013")).toBe(true);
    });

    it("@version と他のディレクティブの共存", () => {
      const source = `
        @version "${PARSER_VERSION}"
        @let greeting = "hello"
        { "message": @greeting }
      `;
      const result = parse(source, "test.aispec");
      expect(result.success).toBe(true);
      const output = result.output as JsonObject;
      expect(output["message"]).toBe("hello");
    });
  });

  describe("エラーケース", () => {
    it("循環インポート検知", () => {
      const files: Record<string, string> = {
        "a.aispec": '@import { B } from "b"',
        "b.aispec": '@import { A } from "a"',
      };
      const fileResolver: FileResolver = (path) => files[path] ?? null;

      const result = parse(files["a.aispec"], "a.aispec", { fileResolver });
      const hasCircularError = result.errors.some((e) => e.code === "E101");
      expect(hasCircularError).toBe(true);
    });

    it("ファイル未発見", () => {
      const source = '@import { X } from "nonexistent"';
      const result = parse(source, "test.aispec", {
        fileResolver: () => null,
      });
      expect(result.errors.some((e) => e.code === "E104")).toBe(true);
    });
  });
});

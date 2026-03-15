// =============================================
// AI-Spec Language - サンプルファイル統合テスト
// samples/ 配下の各 .aispec が正しく JSON 変換されるか検証
// =============================================

import { describe, it, expect } from "vitest";
import { parse } from "./index.js";
import type { FileResolver, JsonObject, JsonValue } from "./types.js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

/** samples/ ディレクトリからファイルを読み込む FileResolver */
function createSamplesResolver(basePath: string): FileResolver {
  return (requestedPath: string, _fromFile: string): string | null => {
    const dir = dirname(basePath);
    const fullPath = resolve(dir, requestedPath);
    try {
      return readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  };
}

function readSample(name: string): string {
  const filePath = resolve(__dirname, "../../../samples", name);
  return readFileSync(filePath, "utf-8");
}

function samplePath(name: string): string {
  return resolve(__dirname, "../../../samples", name);
}

// ===========================================================

describe("サンプルファイル統合テスト", () => {

  // ----- 01: 純粋 JSON -----
  describe("01_pure_json.aispec", () => {
    it("純粋な JSON がそのままパースされる", () => {
      const source = readSample("01_pure_json.aispec");
      const result = parse(source, "samples/01_pure_json.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      expect(out["name"]).toBe("pure-json-sample");
      expect(out["version"]).toBe("1.0.0");
      expect(out["tags"]).toEqual(["sample", "json", "basic"]);

      const config = out["config"] as JsonObject;
      expect(config["debug"]).toBe(false);
      expect(config["port"]).toBe(8080);
      expect(config["host"]).toBeNull();
    });
  });

  // ----- 02: コメント -----
  describe("02_comments.aispec", () => {
    it("コメントが無視されて JSON が正しく出力される", () => {
      const source = readSample("02_comments.aispec");
      const result = parse(source, "samples/02_comments.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      expect(out["name"]).toBe("comment-sample");
      expect(out["version"]).toBe("2.0.0");
      expect(out["items"]).toEqual([1, 2, 3]);
    });
  });

  // ----- 03: @let 基本 -----
  describe("03_let_variables.aispec", () => {
    it("@let で定義した変数が展開される", () => {
      const source = readSample("03_let_variables.aispec");
      const result = parse(source, "samples/03_let_variables.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      expect(out["service"]).toBe("user-service");
      expect(out["timeout"]).toBe(30);
      expect(out["enabled"]).toBe(true);

      const health = (out["endpoints"] as JsonObject)["health"] as JsonObject;
      expect(health["path"]).toBe("/health");
      expect(health["timeout"]).toBe(30);
    });
  });

  // ----- 04: @let オブジェクト -----
  describe("04_let_objects.aispec", () => {
    it("@let でオブジェクトを変数にして再利用できる", () => {
      const source = readSample("04_let_objects.aispec");
      const result = parse(source, "samples/04_let_objects.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      const listUsers = out["list_users"] as JsonObject;
      const listPosts = out["list_posts"] as JsonObject;

      // 両方同じヘッダーが展開される
      const headers1 = listUsers["headers"] as JsonObject;
      const headers2 = listPosts["headers"] as JsonObject;
      expect(headers1["Content-Type"]).toBe("application/json");
      expect(headers2["Content-Type"]).toBe("application/json");

      // Pagination も同じ
      const query1 = listUsers["query"] as JsonObject;
      const query2 = listPosts["query"] as JsonObject;
      expect(query1["per_page"]).toBe(20);
      expect(query2["per_page"]).toBe(20);
    });
  });

  // ----- 05: @type ショートハンド -----
  describe("05_type_shorthand.aispec", () => {
    it("@type() がオブジェクトに展開される", () => {
      const source = readSample("05_type_shorthand.aispec");
      const result = parse(source, "samples/05_type_shorthand.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const schema = (result.output as JsonObject)["user_schema"] as JsonObject;

      // UserId = @type("string", format="uuid")
      const userId = schema["id"] as JsonObject;
      expect(userId["@type"]).toBe("string");
      expect((userId["constraints"] as JsonObject)["format"]).toBe("uuid");

      // Email = @type("string", format="email", maxLength=254)
      const email = schema["email"] as JsonObject;
      expect(email["@type"]).toBe("string");
      expect((email["constraints"] as JsonObject)["format"]).toBe("email");
      expect((email["constraints"] as JsonObject)["maxLength"]).toBe(254);

      // Age = @type("integer", min=0, max=200)
      const age = schema["age"] as JsonObject;
      expect(age["@type"]).toBe("integer");
      expect((age["constraints"] as JsonObject)["min"]).toBe(0);
      expect((age["constraints"] as JsonObject)["max"]).toBe(200);
    });
  });

  // ----- 06: @if / @elif / @else -----
  describe("06_conditionals.aispec", () => {
    it("env=production で本番設定が選択される", () => {
      const source = readSample("06_conditionals.aispec");
      const result = parse(source, "samples/06_conditionals.aispec", {
        env: { env: "production" },
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const db = (result.output as JsonObject)["database"] as JsonObject;
      expect(db["host"]).toBe("db.prod.internal");
      expect(db["pool_size"]).toBe(20);
      expect(db["ssl"]).toBe(true);
    });

    it("env=staging でステージング設定が選択される", () => {
      const source = readSample("06_conditionals.aispec");
      const result = parse(source, "samples/06_conditionals.aispec", {
        env: { env: "staging" },
      });

      expect(result.success).toBe(true);
      const db = (result.output as JsonObject)["database"] as JsonObject;
      expect(db["host"]).toBe("db.staging.internal");
      expect(db["pool_size"]).toBe(5);
      expect(db["ssl"]).toBe(false);
    });

    it("env=development で開発設定（else）が選択される", () => {
      const source = readSample("06_conditionals.aispec");
      const result = parse(source, "samples/06_conditionals.aispec", {
        env: { env: "development" },
      });

      expect(result.success).toBe(true);
      const db = (result.output as JsonObject)["database"] as JsonObject;
      expect(db["host"]).toBe("localhost");
      expect(db["pool_size"]).toBe(5);
      expect(db["ssl"]).toBe(false);
    });
  });

  // ----- 07: + マージ演算子 -----
  describe("07_merge_operator.aispec", () => {
    it("マージ演算子で基本設定が上書きされる", () => {
      const source = readSample("07_merge_operator.aispec");
      const result = parse(source, "samples/07_merge_operator.aispec");

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      const prod = out["production"] as JsonObject;
      const dev = out["development"] as JsonObject;

      // production: retries と log_level が上書き、timeout と backoff は維持
      expect(prod["timeout"]).toBe(30);
      expect(prod["backoff"]).toBe("exponential");
      expect(prod["retries"]).toBe(5);
      expect(prod["log_level"]).toBe("warn");

      // development: timeout, retries, log_level が上書き、hot_reload が追加
      expect(dev["timeout"]).toBe(5);
      expect(dev["retries"]).toBe(0);
      expect(dev["log_level"]).toBe("debug");
      expect(dev["hot_reload"]).toBe(true);
      expect(dev["backoff"]).toBe("exponential"); // 元の値を保持
    });
  });

  // ----- 08: ライブラリファイル -----
  describe("08_library.aispec", () => {
    it("body なしのライブラリファイルは output=null", () => {
      const source = readSample("08_library.aispec");
      const result = parse(source, "samples/08_library.aispec");

      expect(result.success).toBe(true);
      expect(result.output).toBeNull();
    });
  });

  // ----- 09: @import -----
  describe("09_import.aispec", () => {
    it("別ファイルから変数をインポートして使用できる", () => {
      const source = readSample("09_import.aispec");
      const filePath = samplePath("09_import.aispec");
      const result = parse(source, filePath, {
        fileResolver: createSamplesResolver(filePath),
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const api = (result.output as JsonObject)["api"] as JsonObject;
      expect(api["version"]).toBe("v2");
      expect(api["base_url"]).toBe("https://api.example.com");

      const rateLimit = api["rate_limit"] as JsonObject;
      expect(rateLimit["requests_per_minute"]).toBe(60);
      expect(rateLimit["burst"]).toBe(10);
    });
  });

  // ----- 10: 複合サンプル -----
  describe("10_combined.aispec", () => {
    it("env=production で全機能が連携動作する", () => {
      const source = readSample("10_combined.aispec");
      const result = parse(source, "samples/10_combined.aispec", {
        env: { env: "production" },
      });

      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);

      const out = result.output as JsonObject;
      expect(out["service"]).toBe("order-service");

      // create_order: BaseEndpoint + 追加フィールド
      const createOrder = out["create_order"] as JsonObject;
      expect(createOrder["auth_required"]).toBe(true);   // BaseEndpoint から
      expect(createOrder["rate_limit"]).toBe(100);         // BaseEndpoint から
      expect(createOrder["method"]).toBe("POST");          // 上書き
      expect(createOrder["timeout"]).toBe(10);             // @if production

      // request_body の @type 展開
      const body = createOrder["request_body"] as JsonObject;
      const orderId = body["order_id"] as JsonObject;
      expect(orderId["@type"]).toBe("string");
      expect((orderId["constraints"] as JsonObject)["format"]).toBe("uuid");

      const amount = body["amount"] as JsonObject;
      expect(amount["@type"]).toBe("number");

      // get_order
      const getOrder = out["get_order"] as JsonObject;
      expect(getOrder["method"]).toBe("GET");
      expect(getOrder["auth_required"]).toBe(true);
    });

    it("env=development では timeout が 30 になる", () => {
      const source = readSample("10_combined.aispec");
      const result = parse(source, "samples/10_combined.aispec", {
        env: { env: "development" },
      });

      expect(result.success).toBe(true);
      const createOrder = (result.output as JsonObject)["create_order"] as JsonObject;
      expect(createOrder["timeout"]).toBe(30);
    });
  });

  // ----- メタデータ検証 -----
  describe("_aispec メタデータ", () => {
    it("全サンプルに _aispec メタデータが付与される", () => {
      const source = readSample("01_pure_json.aispec");
      const result = parse(source, "samples/01_pure_json.aispec");

      expect(result.success).toBe(true);
      const out = result.output as JsonObject;
      const meta = out["_aispec"] as JsonObject;

      expect(meta["version"]).toBe("0.2");
      expect(meta["parsed_from"]).toBe("samples/01_pure_json.aispec");
      expect(meta["parsed_at"]).toBeDefined();
    });
  });
});

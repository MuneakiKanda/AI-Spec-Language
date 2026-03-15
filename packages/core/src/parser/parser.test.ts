// =============================================
// AI-Spec Language - Parser Tests
// =============================================

import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer/lexer.js";
import { Parser } from "./parser.js";
import { ErrorReporter } from "../errors/reporter.js";
import type { AstNode } from "./ast.js";

function parseSource(source: string) {
  const reporter = new ErrorReporter();
  const lexer = new Lexer(source, "test.aispec", reporter);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens, "test.aispec", reporter);
  const file = parser.parse();
  return { file, reporter };
}

describe("Parser", () => {
  describe("純粋 JSON", () => {
    it("空のオブジェクト", () => {
      const { file } = parseSource("{}");
      expect(file.body?.type).toBe("object");
    });

    it("文字列値", () => {
      const { file } = parseSource('{ "name": "test" }');
      expect(file.body?.type).toBe("object");
      if (file.body?.type === "object") {
        const val = file.body.properties.get("name");
        expect(val?.type).toBe("literal");
        if (val?.type === "literal") expect(val.value).toBe("test");
      }
    });

    it("ネストしたオブジェクト", () => {
      const { file } = parseSource('{ "a": { "b": 42 } }');
      expect(file.body?.type).toBe("object");
      if (file.body?.type === "object") {
        const inner = file.body.properties.get("a");
        expect(inner?.type).toBe("object");
      }
    });

    it("配列", () => {
      const { file } = parseSource('[1, 2, 3]');
      expect(file.body?.type).toBe("array");
      if (file.body?.type === "array") {
        expect(file.body.elements.length).toBe(3);
      }
    });
  });

  describe("@let ディレクティブ", () => {
    it("文字列変数", () => {
      const { file } = parseSource('@let name = "hello"\n{ "val": @name }');
      expect(file.directives.length).toBe(1);
      expect(file.directives[0].kind).toBe("let");
      if (file.directives[0].kind === "let") {
        expect(file.directives[0].name).toBe("name");
      }
      expect(file.body?.type).toBe("object");
    });

    it("オブジェクト変数", () => {
      const { file } = parseSource('@let config = { "a": 1 }');
      expect(file.directives.length).toBe(1);
      if (file.directives[0].kind === "let") {
        expect(file.directives[0].value.type).toBe("object");
      }
    });
  });

  describe("@import ディレクティブ", () => {
    it("名前付きインポート", () => {
      const { file } = parseSource('@import { UserId, Email } from "../types"');
      expect(file.directives.length).toBe(1);
      if (file.directives[0].kind === "import") {
        expect(file.directives[0].names).toEqual(["UserId", "Email"]);
        expect(file.directives[0].path).toBe("../types");
      }
    });

    it("単一インポート", () => {
      const { file } = parseSource('@import Config from "./config"');
      expect(file.directives.length).toBe(1);
      if (file.directives[0].kind === "import") {
        expect(file.directives[0].names).toEqual(["Config"]);
      }
    });
  });

  describe("@include ディレクティブ", () => {
    it("パスを認識", () => {
      const { file } = parseSource('@include "common/types"');
      expect(file.directives.length).toBe(1);
      expect(file.directives[0].kind).toBe("include");
      if (file.directives[0].kind === "include") {
        expect(file.directives[0].path).toBe("common/types");
      }
    });
  });

  describe("@if 条件分岐", () => {
    it("@if/@else", () => {
      const { file } = parseSource('{ "val": @if x == "a" { 1 } @else { 2 } }');
      expect(file.body?.type).toBe("object");
      if (file.body?.type === "object") {
        const val = file.body.properties.get("val");
        expect(val?.type).toBe("conditional");
      }
    });

    it("@if/@elif/@else", () => {
      const { file } = parseSource('{ "v": @if x == 1 { "a" } @elif x == 2 { "b" } @else { "c" } }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("v");
        expect(val?.type).toBe("conditional");
        if (val?.type === "conditional") {
          expect(val.elifBranches.length).toBe(1);
          expect(val.elseBranch).not.toBeNull();
        }
      }
    });
  });

  describe("@type ショートハンド", () => {
    it("パラメータなし", () => {
      const { file } = parseSource('{ "name": @type("string") }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("name");
        expect(val?.type).toBe("type_shorthand");
        if (val?.type === "type_shorthand") {
          expect(val.typeName).toBe("string");
          expect(val.params.size).toBe(0);
        }
      }
    });

    it("パラメータ付き", () => {
      const { file } = parseSource('{ "email": @type("string", format="email", maxLength=254) }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("email");
        expect(val?.type).toBe("type_shorthand");
        if (val?.type === "type_shorthand") {
          expect(val.typeName).toBe("string");
          expect(val.params.has("format")).toBe(true);
          expect(val.params.has("maxLength")).toBe(true);
        }
      }
    });
  });

  describe("@ref ショートハンド", () => {
    it("参照を認識", () => {
      const { file } = parseSource('{ "id": @ref(UserId) }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("id");
        expect(val?.type).toBe("ref_shorthand");
        if (val?.type === "ref_shorthand") {
          expect(val.refName).toBe("UserId");
        }
      }
    });
  });

  describe("+ マージ演算子", () => {
    it("オブジェクトマージ", () => {
      const { file } = parseSource('@let base = { "a": 1 }\n{ "val": @base + { "b": 2 } }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("val");
        expect(val?.type).toBe("merge");
      }
    });
  });

  describe("変数参照", () => {
    it("@identifier", () => {
      const { file } = parseSource('{ "val": @myVar }');
      if (file.body?.type === "object") {
        const val = file.body.properties.get("val");
        expect(val?.type).toBe("variable_ref");
        if (val?.type === "variable_ref") {
          expect(val.name).toBe("myVar");
        }
      }
    });
  });
});

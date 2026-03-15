// =============================================
// AI-Spec Language - Lexer Tests
// =============================================

import { describe, it, expect } from "vitest";
import { Lexer } from "../lexer/lexer.js";
import { TokenType } from "../lexer/tokens.js";
import { ErrorReporter } from "../errors/reporter.js";

function tokenize(source: string) {
  const reporter = new ErrorReporter();
  const lexer = new Lexer(source, "test.aispec", reporter);
  const tokens = lexer.tokenize();
  return { tokens, reporter };
}

describe("Lexer", () => {
  describe("JSON 標準トークン", () => {
    it("空のオブジェクト", () => {
      const { tokens } = tokenize("{}");
      expect(tokens.map((t) => t.type)).toEqual([
        TokenType.LeftBrace,
        TokenType.RightBrace,
        TokenType.Eof,
      ]);
    });

    it("文字列", () => {
      const { tokens } = tokenize('"hello"');
      expect(tokens[0].type).toBe(TokenType.String);
      expect(tokens[0].value).toBe("hello");
    });

    it("エスケープ付き文字列", () => {
      const { tokens } = tokenize('"hello\\nworld"');
      expect(tokens[0].value).toBe("hello\nworld");
    });

    it("数値", () => {
      const { tokens } = tokenize("42");
      expect(tokens[0].type).toBe(TokenType.Number);
      expect(tokens[0].value).toBe("42");
    });

    it("負の数値", () => {
      const { tokens } = tokenize("-3.14");
      expect(tokens[0].type).toBe(TokenType.Number);
      expect(tokens[0].value).toBe("-3.14");
    });

    it("ブーリアン", () => {
      const { tokens } = tokenize("true false");
      expect(tokens[0].type).toBe(TokenType.Boolean);
      expect(tokens[0].value).toBe("true");
      expect(tokens[1].type).toBe(TokenType.Boolean);
      expect(tokens[1].value).toBe("false");
    });

    it("null", () => {
      const { tokens } = tokenize("null");
      expect(tokens[0].type).toBe(TokenType.Null);
    });

    it("完全なJSONオブジェクト", () => {
      const { tokens } = tokenize('{ "name": "test", "count": 42 }');
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        TokenType.LeftBrace,
        TokenType.String,
        TokenType.Colon,
        TokenType.String,
        TokenType.Comma,
        TokenType.String,
        TokenType.Colon,
        TokenType.Number,
        TokenType.RightBrace,
        TokenType.Eof,
      ]);
    });

    it("配列", () => {
      const { tokens } = tokenize('[1, "two", true]');
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        TokenType.LeftBracket,
        TokenType.Number,
        TokenType.Comma,
        TokenType.String,
        TokenType.Comma,
        TokenType.Boolean,
        TokenType.RightBracket,
        TokenType.Eof,
      ]);
    });
  });

  describe("コメント", () => {
    it("一行コメント", () => {
      const { tokens } = tokenize('// comment\n"value"');
      expect(tokens[0].type).toBe(TokenType.String);
      expect(tokens[0].value).toBe("value");
    });

    it("ブロックコメント", () => {
      const { tokens } = tokenize('/* block */ "value"');
      expect(tokens[0].type).toBe(TokenType.String);
      expect(tokens[0].value).toBe("value");
    });

    it("閉じられていないブロックコメント", () => {
      const { reporter } = tokenize("/* unclosed");
      expect(reporter.hasErrors).toBe(true);
      expect(reporter.errors[0].code).toBe("E004");
    });
  });

  describe("AI-Spec 拡張", () => {
    it("@let", () => {
      const { tokens } = tokenize('@let name = "value"');
      expect(tokens[0].type).toBe(TokenType.AtLet);
      expect(tokens[1].type).toBe(TokenType.Identifier);
      expect(tokens[1].value).toBe("name");
      expect(tokens[2].type).toBe(TokenType.Assign);
      expect(tokens[3].type).toBe(TokenType.String);
    });

    it("@import", () => {
      const { tokens } = tokenize('@import { UserId } from "../common/types"');
      expect(tokens[0].type).toBe(TokenType.AtImport);
      expect(tokens[1].type).toBe(TokenType.LeftBrace);
      expect(tokens[2].type).toBe(TokenType.Identifier);
      expect(tokens[2].value).toBe("UserId");
      expect(tokens[3].type).toBe(TokenType.RightBrace);
      expect(tokens[4].type).toBe(TokenType.From);
      expect(tokens[5].type).toBe(TokenType.String);
    });

    it("@include", () => {
      const { tokens } = tokenize('@include "common/types"');
      expect(tokens[0].type).toBe(TokenType.AtInclude);
      expect(tokens[1].type).toBe(TokenType.String);
    });

    it("@if / @else", () => {
      const { tokens } = tokenize('@if env == "prod" { 1 } @else { 2 }');
      const types = tokens.map((t) => t.type);
      expect(types).toContain(TokenType.AtIf);
      expect(types).toContain(TokenType.Equals);
      expect(types).toContain(TokenType.AtElse);
    });

    it("@identifier (変数参照)", () => {
      const { tokens } = tokenize("@MyVariable");
      expect(tokens[0].type).toBe(TokenType.AtIdentifier);
      expect(tokens[0].value).toBe("MyVariable");
    });

    it("@type ショートハンド", () => {
      const { tokens } = tokenize('@type("string", format="email")');
      expect(tokens[0].type).toBe(TokenType.AtType);
      expect(tokens[1].type).toBe(TokenType.LeftParen);
      expect(tokens[2].type).toBe(TokenType.String);
      expect(tokens[2].value).toBe("string");
    });

    it("@ref ショートハンド", () => {
      const { tokens } = tokenize("@ref(UserId)");
      expect(tokens[0].type).toBe(TokenType.AtRef);
      expect(tokens[1].type).toBe(TokenType.LeftParen);
      expect(tokens[2].type).toBe(TokenType.Identifier);
    });
  });

  describe("演算子", () => {
    it("比較演算子", () => {
      const { tokens } = tokenize("== != > < >= <=");
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        TokenType.Equals,
        TokenType.NotEquals,
        TokenType.Greater,
        TokenType.Less,
        TokenType.Gte,
        TokenType.Lte,
        TokenType.Eof,
      ]);
    });

    it("論理演算子", () => {
      const { tokens } = tokenize("&& || !");
      const types = tokens.map((t) => t.type);
      expect(types).toEqual([
        TokenType.And,
        TokenType.Or,
        TokenType.Not,
        TokenType.Eof,
      ]);
    });

    it("+ 演算子", () => {
      const { tokens } = tokenize("+");
      expect(tokens[0].type).toBe(TokenType.Plus);
    });
  });

  describe("位置情報", () => {
    it("行と列を正しく追跡する", () => {
      const { tokens } = tokenize('{\n  "key": "value"\n}');
      const keyToken = tokens.find((t) => t.value === "key");
      expect(keyToken?.line).toBe(2);
    });
  });
});

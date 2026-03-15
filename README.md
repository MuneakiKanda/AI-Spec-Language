# AI-Spec Language

**Current Version: v0.2.0**

**AI-Spec Language** は、API 仕様を AI が読み書きしやすい形式で記述するための **JSON スーパーセット言語**です。  
JSON の完全な上位互換として、変数・インポート・条件分岐・型ショートハンドといった構造化機能を追加し、パース後は純粋な JSON を出力します。

> **ステータス:** TypeScript プロトタイプ（v0.2.0）— パーサー・CLI 実装済み

---

## 特徴

- **JSON 完全互換** — 任意の JSON はそのまま有効な `.aispec` ファイル
- **コメント** — `//` 一行コメント、`/* */` 複数行コメント
- **変数 (`@let`)** — 値の再利用、DRY な仕様記述
- **インポート (`@import`)** — 他ファイルから名前付き変数を取り込み
- **インクルード (`@include`)** — ファイル内容の直接展開
- **条件分岐 (`@if / @elif / @else`)** — 環境ごとの設定切り替え
- **型ショートハンド (`@type()`)** — 制約付き型定義の簡略記法
- **参照ショートハンド (`@ref()`)** — 定義済み変数への参照
- **マージ演算子 (`+`)** — オブジェクトの浅いマージ
- **循環インポート検知** — 自動でエラー報告
- **構造化エラー出力** — エラーコード・行番号・修正提案付き

---

## プロジェクト構成

```
AI-Spec-Language/
├── packages/
│   ├── core/               # @aispec/core v0.2.0 — パーサーライブラリ
│   │   └── src/
│   │       ├── lexer/      # 字句解析 (Scanner, Lexer, Tokens)
│   │       ├── parser/     # 構文解析 (Parser, Resolver, Evaluator, Emitter)
│   │       ├── errors/     # エラーコード・レポーター
│   │       ├── types.ts    # 共通型定義
│   │       └── index.ts    # Public API
│   └── cli/                # @aispec/cli v0.2.0 — コマンドラインツール
│       └── src/
│           └── index.ts    # parse / validate コマンド
├── samples/                # 文法別サンプル (.aispec → JSON 変換例)
│   ├── *.aispec            # 01_pure_json 〜 10_combined
│   └── output/             # 変換後の JSON 出力
├── specs/                  # 実践的な API 仕様例
│   ├── common/             # 共通型定義 (types, errors)
│   ├── schemas/            # スキーマ定義 (security, events)
│   └── notifications/      # サービス仕様例 (realtime)
└── memo/                   # 設計メモ・レビュー記録
    ├── memo.txt            # 言語仕様メモ (v0.1→v0.2 変更点含む)
    └── memo_YYYYMMDD_NN.txt # 中間レビュー・検討記録
```

---

## セットアップ

```bash
# 必要環境: Node.js >= 20, pnpm
pnpm install
pnpm build
```

## テスト

```bash
pnpm test          # 全テスト実行 (67 tests)
pnpm test:watch    # ウォッチモード
```

テスト内訳:
| テストスイート | 件数 | 内容 |
|---|---|---|
| `lexer.test.ts` | 23 | JSON トークン、コメント、@ディレクティブ、演算子、位置追跡 |
| `parser.test.ts` | 16 | JSON パース、ディレクティブ、条件分岐、ショートハンド、マージ |
| `e2e.test.ts` | 14 | フルパイプライン（パース→解決→評価→JSON出力→メタデータ） |
| `samples.test.ts` | 14 | サンプルファイル統合テスト（全文法の JSON 変換検証） |

---

## 使い方

### ライブラリとして (`@aispec/core`)

```typescript
import { parse } from "@aispec/core";

const source = `
  @let AppName = "MyService"
  {
    "name": @AppName,
    "version": "1.0.0"
  }
`;

const result = parse(source, "example.aispec", {
  env: { env: "production" },
});

if (result.success) {
  console.log(JSON.stringify(result.output, null, 2));
}
```

### CLI (`@aispec/cli`)

```bash
# .aispec → JSON 変換
aispec parse specs/notifications/realtime.aispec --pretty

# 環境変数を指定して条件分岐を制御
aispec parse spec.aispec --env env=production --env region=ap-northeast-1

# ファイルに出力
aispec parse spec.aispec --output output.json --pretty

# バリデーションのみ（JSON 出力なし）
aispec validate spec.aispec
```

---

## 言語構文

### コメント

```jsonc
{
  // 一行コメント
  "key": "value" /* インラインコメント */
}
```

### 変数定義 (`@let`)

```
@let UserId = @type("string", format="uuid")
@let MaxRetries = 3

{
  "user_id": @UserId,
  "retries": @MaxRetries
}
```

### インポート (`@import`)

```
@import { UserId, Email } from "common/types"

{
  "id": @UserId,
  "email": @Email
}
```

### 条件分岐 (`@if / @elif / @else`)

```
{
  "log_level": @if env == "production" {
    "warn"
  } @elif env == "staging" {
    "info"
  } @else {
    "debug"
  }
}
```

### 型ショートハンド (`@type()`)

```
// ショートハンド
@let Email = @type("string", format="email", maxLength=254)

// ↓ パース後の出力
// { "@type": "string", "constraints": { "format": "email", "maxLength": 254 } }
```

### マージ演算子 (`+`)

```
@let Base = { "timeout": 30, "retries": 3 }

{
  "config": @Base + { "retries": 5, "debug": true }
  // → { "timeout": 30, "retries": 5, "debug": true }
}
```

---

## パーサーパイプライン

```
.aispec ソース
    │
    ▼
┌─────────────┐
│ 1. Tokenize │  Lexer: ソース → トークン列
└──────┬──────┘
       ▼
┌─────────────┐
│ 2. Parse    │  Parser: トークン → AST + ディレクティブ
└──────┬──────┘
       ▼
┌─────────────┐
│ 3. Resolve  │  Resolver: @import / @include / @let 解決
└──────┬──────┘
       ▼
┌─────────────┐
│ 4. Expand   │  Resolver: 変数参照 (@var) を展開
└──────┬──────┘
       ▼
┌─────────────┐
│ 5. Evaluate │  Evaluator: @if 条件式を評価
└──────┬──────┘
       ▼
┌─────────────┐
│ 6. Emit     │  Emitter: AST → 純粋 JSON
└──────┬──────┘
       ▼
   JSON 出力 + _aispec メタデータ
```

---

## エラーコード

| コード | 種別 | 内容 |
|---|---|---|
| E001 | 構文 | 予期しないトークン |
| E002 | 構文 | 文字列が閉じられていない |
| E003 | 構文 | 不正な数値リテラル |
| E004 | 構文 | オブジェクトのキーがありません |
| E005 | 構文 | コロンがありません |
| E006 | 構文 | パス文字列がありません |
| E007 | 構文 | 予約済みキーワード |
| E008 | 構文 | 型名がありません |
| E009 | 構文 | 変数名がありません |
| E010 | 構文 | 代入演算子がありません |
| E011 | 構文 | ブロックが閉じられていない |
| E012 | 構文 | コメントが閉じられていない |
| E101 | インポート | 循環インポート検知 |
| E102 | インポート | インポート先のパース失敗 |
| E103 | インポート | 指定された名前が見つからない |
| E104 | インポート | ファイルが見つからない |
| E201 | 型 | 不正な型名 |
| E301 | 式 | 不正な式 |
| E302 | 式 | 比較演算子がありません |
| E303 | 式 | ドット記法の深さ超過（最大3レベル） |
| E304 | 式 | 未定義変数の参照 |
| W001 | 警告 | 変数の再定義 |
| W002 | 警告 | 未使用の変数 |
| W003 | 警告 | 非推奨の構文 |

---

## バージョン情報

| パッケージ | バージョン | 説明 |
|---|---|---|
| AI-Spec Language 仕様 | v0.2 | 言語仕様バージョン |
| `@aispec/core` | 0.2.0 | パーサーライブラリ |
| `@aispec/cli` | 0.2.0 | コマンドラインツール |

出力 JSON の `_aispec.version` フィールドにも仕様バージョンが記録されます:

```json
{
  "_aispec": {
    "version": "0.2",
    "parsed_from": "example.aispec",
    "parsed_at": "2026-03-15T03:11:33.268Z",
    "includes_resolved": [],
    "conditions_evaluated": { "env": "production" }
  }
}
```

## 技術スタック

- **言語:** TypeScript 5.7+ (将来的に Rust へ移行予定)
- **ランタイム:** Node.js 20+
- **パッケージマネージャ:** pnpm (monorepo)
- **テストフレームワーク:** Vitest
- **モジュール:** ESM (ES2022)

## ライセンス

TBD

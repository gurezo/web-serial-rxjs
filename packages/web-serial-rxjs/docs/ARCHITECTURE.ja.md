# ドキュメント構成

この文書は `@gurezo/web-serial-rxjs` のドキュメントについて、canonical な構成・責務・パス・URL 規則・生成物管理方針を定義する。

親 Issue: [#453](https://github.com/gurezo/web-serial-rxjs/issues/453)  
定義 Issue: [#454](https://github.com/gurezo/web-serial-rxjs/issues/454)

## 論理構成

```text
Documentation
├── Guide
│   ├── 日本語 (手書き source → 静的 HTML 出力)
│   └── English (手書き source → 静的 HTML 出力)
└── API Reference
    └── English / TypeDoc (TypeScript JSDoc → 生成 HTML)
```

## 責務

### Guide（日本語・英語）

| トピック | 内容 |
| --- | --- |
| インストール | パッケージ導入と peer dependency（`rxjs`） |
| クイックスタート | 最短でポートを開き購読する手順 |
| 接続フロー | connect / disconnect / close の基本 |
| ライフサイクル | `state$` を canonical なライフサイクルソースとして説明 |
| エラーハンドリング | `errors$` による fatal / non-fatal エラー |
| read / write | 送受信 |
| 高度な使用方法 | 行フレーミング、擬似リクエスト／レスポンス、リカバリ |
| マイグレーション | v2 → v3、v1 → v2 への導線 |
| 概念補足 | 表や図による補足（旧 `API_REFERENCE.md`） |

Guide は**手書き Markdown** の日英二言語で、ライブラリの*使い方*を説明する。

### API Reference（英語のみ）

| トピック | 内容 |
| --- | --- |
| エクスポート | class、interface、type、enum、function |
| 公開 API | property、method、parameter、return type |
| API 契約 | `@deprecated`、`@throws`、error code、emit されるエラー |
| 正本 | `packages/web-serial-rxjs/src/` の英語 JSDoc |

API Reference は英語 JSDoc から **TypeDoc で生成**し、公開 API の*仕様*を記載する。日本語 API Reference は**生成しない**。

### 名称の整理

| 名称 | 役割 |
| --- | --- |
| API Reference（本構成） | `docs/api/` 配下の TypeDoc 出力 |
| `concepts.md`（Guide） | 旧 `API_REFERENCE.md`。概念補足であり、生成 API ドキュメントではない |

## リポジトリ内パス

### Source（Git 管理）

| 領域 | パス | 言語 |
| --- | --- | --- |
| 日本語 Guide | `packages/web-serial-rxjs/docs/guide/ja/` | 日本語 |
| English Guide | `packages/web-serial-rxjs/docs/guide/en/` | 英語 |
| API Reference source | `packages/web-serial-rxjs/src/`（JSDoc） | 英語のみ |
| 構成定義（本書） | `packages/web-serial-rxjs/docs/ARCHITECTURE.ja.md` | 日本語 + `.md` |

### ビルド出力（生成物、Git 管理外）

| 領域 | パス | 構築担当 |
| --- | --- | --- |
| デプロイ artifact ルート | `docs/` | CI（`pnpm run docs` + 将来の Guide ビルド） |
| 日本語 Guide 出力 | `docs/guide/ja/` | #458 |
| English Guide 出力 | `docs/guide/en/` | #458 |
| API Reference 出力 | `docs/api/` | #457（TypeDoc `out` 変更） |

### 移行対応表（現行 → 移行先）

実ファイルの移動は #455 / #456 で実施する。本表が canonical な移行先である。

| 現行ファイル | 移行先 | 備考 |
| --- | --- | --- |
| `OVERVIEW.md` | `guide/en/overview.md` | |
| `OVERVIEW.ja.md` | `guide/ja/overview.md` | |
| `QUICK_START.md` | `guide/en/quick-start.md` | |
| `QUICK_START.ja.md` | `guide/ja/quick-start.md` | |
| `ADVANCED_USAGE.md` | `guide/en/advanced-usage.md` | |
| `ADVANCED_USAGE.ja.md` | `guide/ja/advanced-usage.md` | |
| `MIGRATION_V2.md` | `guide/en/migration-v2.md` | |
| `MIGRATION_V2.ja.md` | `guide/ja/migration-v2.md` | |
| `MIGRATION_V3.md` | `guide/en/migration-v3.md` | |
| `MIGRATION_V3.ja.md` | `guide/ja/migration-v3.md` | |
| `API_REFERENCE.md` | `guide/en/concepts.md` | リネーム。Guide 補足 |
| `API_REFERENCE.ja.md` | `guide/ja/concepts.md` | リネーム。Guide 補足 |
| `archive/` | `guide/en/archive/` / `guide/ja/archive/` | 現状維持 |

## URL path 規則

| 論理パス | GitHub Pages（現行） | Firebase（#151 想定） |
| --- | --- | --- |
| サイトルート | `https://gurezo.github.io/web-serial-rxjs/` | `https://gurezo.net/web-serial-rxjs/` |
| 日本語 Guide | `/guide/ja/` | `/web-serial-rxjs/guide/ja/` |
| English Guide | `/guide/en/` | `/web-serial-rxjs/guide/en/` |
| API Reference | `/api/` | `/web-serial-rxjs/api/` |

- 生成 HTML 内は相対リンクを優先し、Hosting の `base` path は #151 / #458 で扱う。
- `packages/web-serial-rxjs/package.json` の `homepage` は #458 で更新する。

## 生成物の Git 管理方針

| パス | Git 管理 |
| --- | --- |
| `packages/web-serial-rxjs/docs/guide/**` | する（手書き source） |
| `docs/api/**`、`docs/guide/**` | しない（CI 生成 artifact） |
| `docs/.gitignore` | する（生成物を除外） |

- ローカル生成: `pnpm run docs`（#457 まで現行 TypeDoc 設定）
- 公開: `.github/workflows/deploy-docs.yml` が `./docs` を Pages artifact としてアップロード
- ルート `docs/` 配下は**編集しない**（`docs/.gitignore` を除く）

## Issue 間の責務境界

| Issue | 責務 |
| --- | --- |
| **#454**（本 Issue） | 構成・パス・URL 規則・artifact 方針の定義 |
| **#455** | v3 canonical model に沿った日本語 Guide の整理 |
| **#456** | 日本語 Guide に対応する English Guide の整備 |
| **#457** | 英語のみの TypeDoc API Reference（`typedoc.json` → `docs/api/`） |
| **#458** | Guide と API Reference のビルド統合、相互導線、サイト index |
| **#151** | Firebase Hosting への配信（artifact の*レイアウト*は本 Issue、*Hosting 設定*は #151） |

## 後続 Issue 向けチェックリスト

- [ ] **#455** — 日本語 Guide を `guide/ja/` へ移行・更新
- [ ] **#456** — English Guide を `guide/en/` へ移行・更新
- [ ] **#457** — TypeDoc `out` を `../../docs/api` に変更。`projectDocuments` は英語 Guide のみ
- [ ] **#458** — `docs/guide/{ja,en}/` をビルドし、Guide ↔ API Reference の導線を追加
- [ ] **#151** — `docs/` artifact を Firebase へデプロイ（内部パスは再定義しない）

## 参照

- [親 Issue #453](https://github.com/gurezo/web-serial-rxjs/issues/453)
- [TypeDoc 設定](../typedoc.json)
- [デプロイ workflow](../../../.github/workflows/deploy-docs.yml)
- [English version](./ARCHITECTURE.md)

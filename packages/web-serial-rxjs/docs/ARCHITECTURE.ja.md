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
| デプロイ artifact ルート | `docs/` | CI（`pnpm run docs`） |
| サイトランディング | `docs/index.html` | #458 |
| 日本語 Guide 出力 | `docs/guide/ja/` | #458 |
| English Guide 出力 | `docs/guide/en/` | #458 |
| API Reference 出力 | `docs/api/` | #457（TypeDoc `out` 変更） |

### 移行対応表（現行 → 移行先）

Guide の source は `guide/{en,ja}/` に配置済み。legacy flat パスは #455 / #456 で削除済み。本表は移行対応の記録である。

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
| Examples index | `/examples/` | `/web-serial-rxjs/examples/` |

- 生成 HTML 内は相対リンクを優先し、Hosting の `base` path は #151 / #458 で扱う。
- `packages/web-serial-rxjs/package.json` の `homepage` は統合ドキュメントサイトルートを指す。

## 生成物の Git 管理方針

| パス | Git 管理 |
| --- | --- |
| `packages/web-serial-rxjs/docs/guide/**` | する（手書き source） |
| `docs/index.html`、`docs/examples/**`、`docs/media/**`、`docs/api/**`、`docs/guide/**` | しない（CI 生成 artifact） |
| `docs/.gitignore` | する（生成物を除外） |
| `dist/portal/web-serial-rxjs/**` | しない（portal fragment。ルート `dist/` gitignore で除外） |

- ローカル生成: `pnpm run docs`（Guide HTML、TypeDoc API Reference、サイト index、examples index、内部リンク検証、portal fragment パッケージ）
- 公開（GitHub Pages、#361 まで）: `.github/workflows/deploy-docs.yml` が `./docs` を Pages artifact としてアップロード
- ルート `docs/` 配下は**編集しない**（`docs/.gitignore` を除く）

## Portal fragment（#352 / #353 / #354 / #355 / #356 / #357 / #358 / #359）

`pnpm run docs` の末尾で `docs:portal` が走り、生成済み `docs/` ツリー（`docs/.gitignore` を除く）を次へコピーする:

| 項目 | 値 |
| --- | --- |
| Fragment 出力先 | `dist/portal/web-serial-rxjs/` |
| 公開 URL（想定） | `https://gurezo.net/web-serial-rxjs/` |
| portal 取り込み先 | `gurezo/portal` → `firebase-public/web-serial-rxjs/` |

`docs:examples-index` が `docs/examples/index.html` を書き出し、`docs:example-angular` / `docs:example-react` / `docs:example-svelte` / `docs:example-vanilla-js` / `docs:example-vanilla-ts` / `docs:example-vue` が framework example を `docs/examples/<slug>/` へビルドしてからパッケージするため、fragment には次が含まれる:

```text
dist/portal/web-serial-rxjs/
├── index.html
├── api/ guide/ media/
└── examples/
    ├── index.html          # #353
    ├── angular/            # #354
    ├── react/              # #355
    ├── svelte/             # #356
    ├── vanilla-js/         # #357
    ├── vanilla-ts/         # #358
    └── vue/                # #359
```

| 項目 | 値 |
| --- | --- |
| Examples index URL | `https://gurezo.net/web-serial-rxjs/examples/` |
| Angular example URL | `https://gurezo.net/web-serial-rxjs/examples/angular/` |
| React example URL | `https://gurezo.net/web-serial-rxjs/examples/react/` |
| Svelte example URL | `https://gurezo.net/web-serial-rxjs/examples/svelte/` |
| Vanilla JS example URL | `https://gurezo.net/web-serial-rxjs/examples/vanilla-js/` |
| Vanilla TS example URL | `https://gurezo.net/web-serial-rxjs/examples/vanilla-ts/` |
| Vue example URL | `https://gurezo.net/web-serial-rxjs/examples/vue/` |
| portal 取り込み先 | `gurezo/portal` → `firebase-public/web-serial-rxjs/examples/` |

- 本リポジトリは**静的 fragment の生成のみ**を行う。Firebase Hosting への最終 deploy は `gurezo/portal` の責務。
- docs ページの相対リンクは GitHub project Pages と同じ `/web-serial-rxjs/` のパス深さに既に整合しているため、HTML 内の絶対 `base` 書き換えは不要。
- Angular example は `baseHref` `/web-serial-rxjs/examples/angular/` を使う（`nx build example-angular --configuration=portal`）。
- React example は Vite `base` `/web-serial-rxjs/examples/react/` を使う（`nx build example-react --configuration=portal`）。
- Svelte example は Vite `base` `/web-serial-rxjs/examples/svelte/` を使う（`nx build example-svelte --configuration=portal`）。
- Vanilla JS example は Vite `base` `/web-serial-rxjs/examples/vanilla-js/` を使う（`nx build example-vanilla-js --configuration=portal`）。
- Vanilla TS example は Vite `base` `/web-serial-rxjs/examples/vanilla-ts/` を使う（`nx build example-vanilla-ts --configuration=portal`）。
- Vue example は Vite `base` `/web-serial-rxjs/examples/vue/` を使う（`nx build example-vue --configuration=portal`）。
- SPA fallback / clean URL rewrite（必要な場合）は portal 側 Hosting 設定の確認事項。docs はマルチページ静的 HTML（`*.html`）である。

### Portal static artifact CI（#360）

GitHub Actions workflow [`.github/workflows/portal-static-artifact.yml`](../../../.github/workflows/portal-static-artifact.yml) が `pnpm run docs` を実行し、portal 取り込み用に staging したうえでダウンロード可能な artifact を upload する。Firebase Hosting への deploy は**行わない**。

| 項目 | 値 |
| --- | --- |
| Workflow | [`.github/workflows/portal-static-artifact.yml`](../../../.github/workflows/portal-static-artifact.yml) |
| Artifact 名 | `web-serial-rxjs-static` |
| Staging レイアウト | `web-serial-rxjs-static/web-serial-rxjs/`（`dist/portal/web-serial-rxjs/` からコピー） |
| トリガー | `main` への `push`（path filter あり）および `workflow_dispatch` |
| Deploy | 本リポジトリでは行わない（`gurezo/portal` の責務） |

```text
web-serial-rxjs-static/
└── web-serial-rxjs/
    ├── index.html
    ├── api/ guide/ media/
    └── examples/
        ├── index.html
        ├── angular/
        ├── react/
        ├── svelte/
        ├── vanilla-js/
        ├── vanilla-ts/
        └── vue/
```

`gurezo/portal` は artifact をダウンロードし、`web-serial-rxjs/` を `firebase-public/web-serial-rxjs/` へ配置する。ビルド失敗時は upload ステップに到達しないため、失敗時に artifact は公開されない。

## GitHub Pages 配信（#151 / #361 完了まで）

Firebase Hosting（#151）で github.io を置き換えるまでは、公開サイトは GitHub Actions 経由でのみ配信する。

| 設定 | 必須値 |
| --- | --- |
| Repo → Settings → Pages → Source | **GitHub Actions**（`build_type=workflow`） |
| デプロイ workflow | [`.github/workflows/deploy-docs.yml`](../../../.github/workflows/deploy-docs.yml) |
| 公開 URL | `https://gurezo.github.io/web-serial-rxjs/` |

**Deploy from a branch**（`main` + `/docs`）は使わない。生成 HTML は git 管理外（`docs/.gitignore`）のため、その設定だと空のツリーが公開されサイトが 404 になる（#500）。

## Issue 間の責務境界

| Issue | 責務 |
| --- | --- |
| **#454**（本 Issue） | 構成・パス・URL 規則・artifact 方針の定義 |
| **#455** | v3 canonical model に沿った日本語 Guide の整理 |
| **#456** | 日本語 Guide に対応する English Guide の整備 |
| **#457** | 英語のみの TypeDoc API Reference（`typedoc.json` → `docs/api/`） |
| **#458** | Guide と API Reference のビルド統合、相互導線、サイト index |
| **#352** | docs を `dist/portal/web-serial-rxjs/` の portal fragment としてパッケージ |
| **#353** | examples index を `dist/portal/web-serial-rxjs/examples/` に出力 |
| **#354** | Angular example を `dist/portal/web-serial-rxjs/examples/angular/` に出力 |
| **#355** | React example を `dist/portal/web-serial-rxjs/examples/react/` に出力 |
| **#356** | Svelte example を `dist/portal/web-serial-rxjs/examples/svelte/` に出力 |
| **#357** | Vanilla JS example を `dist/portal/web-serial-rxjs/examples/vanilla-js/` に出力 |
| **#358** | Vanilla TS example を `dist/portal/web-serial-rxjs/examples/vanilla-ts/` に出力 |
| **#359** | Vue example を `dist/portal/web-serial-rxjs/examples/vue/` に出力 |
| **#151** | Firebase Hosting 移行の親（レイアウトは本リポ、最終 deploy は portal） |
| **#360** | docs + examples の静的 artifact 集約 workflow |
| **#361** | URL 更新と GitHub Pages 停止 |

## 後続 Issue 向けチェックリスト

- [x] **#455** — 日本語 Guide を `guide/ja/` へ移行・更新
- [x] **#456** — English Guide を `guide/en/` へ移行・更新
- [x] **#457** — TypeDoc `out` を `../../docs/api` に変更。`projectDocuments` は英語 Guide のみ
- [x] **#458** — `docs/guide/{ja,en}/` をビルドし、Guide ↔ API Reference の導線を追加
- [x] **#352** — portal docs fragment を `dist/portal/web-serial-rxjs/` に出力
- [x] **#353** — examples index を `dist/portal/web-serial-rxjs/examples/` に出力
- [x] **#354** — Angular example を `dist/portal/web-serial-rxjs/examples/angular/` に出力
- [x] **#355** — React example を `dist/portal/web-serial-rxjs/examples/react/` に出力
- [x] **#356** — Svelte example を `dist/portal/web-serial-rxjs/examples/svelte/` に出力
- [x] **#357** — Vanilla JS example を `dist/portal/web-serial-rxjs/examples/vanilla-js/` に出力
- [x] **#358** — Vanilla TS example を `dist/portal/web-serial-rxjs/examples/vanilla-ts/` に出力
- [x] **#359** — Vue example を `dist/portal/web-serial-rxjs/examples/vue/` に出力
- [x] **#360** — GitHub Actions で `web-serial-rxjs-static` artifact を upload
- [ ] **#151** — `gurezo/portal` 経由で公開（内部パスは再定義しない）

## 参照

- [親 Issue #453](https://github.com/gurezo/web-serial-rxjs/issues/453)
- [Portal docs fragment #352](https://github.com/gurezo/web-serial-rxjs/issues/352)
- [Portal examples index #353](https://github.com/gurezo/web-serial-rxjs/issues/353)
- [Portal Angular example #354](https://github.com/gurezo/web-serial-rxjs/issues/354)
- [Portal React example #355](https://github.com/gurezo/web-serial-rxjs/issues/355)
- [Portal Svelte example #356](https://github.com/gurezo/web-serial-rxjs/issues/356)
- [Portal Vanilla JS example #357](https://github.com/gurezo/web-serial-rxjs/issues/357)
- [Portal Vanilla TS example #358](https://github.com/gurezo/web-serial-rxjs/issues/358)
- [Portal Vue example #359](https://github.com/gurezo/web-serial-rxjs/issues/359)
- [Portal static artifact CI #360](https://github.com/gurezo/web-serial-rxjs/issues/360)
- [Firebase 移行親 #151](https://github.com/gurezo/web-serial-rxjs/issues/151)
- [TypeDoc 設定](../typedoc.json)
- [デプロイ workflow](../../../.github/workflows/deploy-docs.yml)
- [Portal static artifact workflow](../../../.github/workflows/portal-static-artifact.yml)
- [English version](./ARCHITECTURE.md)

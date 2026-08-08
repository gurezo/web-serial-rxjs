# Bundler / framework 互換性の検証方針

このページは、`@gurezo/web-serial-rxjs` が CI で何を検証しているか、Framework Examples が示す範囲、採用者が依拠すべき **最低限の import 条件**をまとめます。**ビルド／ツール選定**のための文書です。全 bundler を「対応」「非対応」として常時維持する matrix は**公開しません**。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#564](https://github.com/gurezo/web-serial-rxjs/issues/564) · Related: [ブラウザサポート](./browser-support.md) · [バージョンサポート](./version-support.md)

## 用語

| 用語 | 意味 |
| --- | --- |
| **パッケージの最低要件** | 公開 npm パッケージを消費するときの文書化された条件（ESM import、peer の RxJS、公開型定義） |
| **CI 検証** | リポジトリの CI が PR ごとに実際に build / 検査している範囲 |
| **Example build** | `apps/example-*` 配下のアプリがこのモノレポで build できること — **配線の参考実装**であり、あらゆる bundler / framework 版への互換性保証ではない |
| **未検証のツールチェーン** | CI で実行していない bundler / build system。**未検証は「非対応」や「ライブラリが拒否する」こととは異なる** |

## パッケージの最低要件

採用者が基準とすべき条件は次のとおりです。

| 要件 | 方針 |
| --- | --- |
| **モジュール形式** | パッケージは **ESM のみ**。`package.json` の `exports` は `import` → `dist/index.mjs` と `types` → `dist/index.d.ts` を公開します。`require` / CommonJS の export 条件はありません。 |
| **Import** | パッケージの `exports` マップを解決できる環境で、`@gurezo/web-serial-rxjs` を ESM `import` してください。 |
| **RxJS** | **peer dependency** として `rxjs` **`^7.8.0`** が必要です。アプリ側でインストールしてください（本パッケージには同梱しません）。 |
| **TypeScript** | TypeScript は **peer dependency ではありません**。TypeScript 利用者向けに `.d.ts` を同梱します。製品として TypeScript の最低バージョンを保証はしません。公開宣言を消費できる TypeScript を使ってください。JavaScript 利用者は型を無視できます。 |

ブラウザ / Web Serial の可否は別です — [ブラウザサポートと公式サポート方針](./browser-support.md) を参照してください。

## CI で検証していること

`main` 向けの PR では、[CI](https://github.com/gurezo/web-serial-rxjs/blob/main/.github/workflows/ci.yml) がおおよそ次を実行します。

| 検査 | 意味 |
| --- | --- |
| **Node.js 22** + **pnpm** | frozen lockfile でのインストール |
| **`nx run-many --target=lint --all`** | ワークスペース全体の lint |
| **`nx run-many --target=build --all`** | ライブラリとすべての Example アプリの build |
| **`web-serial-rxjs:verify-dist`** | ビルド後の `dist/` と公開 API allowlist |
| **`web-serial-rxjs:verify-pack`** | npm pack 内容、package metadata、設定済みの場合は消費者向け ESM / 型 smoke |
| **Tests** | ワークスペースのテスト |

CI が示すのは、**このモノレポの現行ツールチェーンで build できること**です。エコシステム上のすべての bundler 版を認証したという意味ではありません。

ライブラリ自体の npm 成果物は、パッケージ scripts 内の **TypeScript（`tsc` で宣言）+ esbuild（bundle）** で生成します。これは配布物の作り方であり、消費者が必ず esbuild を使うという意味ではありません。

## Framework Examples と build system

Examples は各スタックでの **`SerialSession` の配線方法**を示します。CI で Example が build されることは、**それらのアプリに対する smoke カバレッジ**であり、「Angular / React / Vue / Svelte / Vite / webpack をあらゆる版で公式サポートし続ける」約束ではありません。

| Example | このリポジトリで使っている build system |
| --- | --- |
| `example-angular` | Angular application builder（`@angular/build:application`） |
| `example-react` | Vite（`@nx/vite:build`） |
| `example-vue` | Vite（`@nx/vite:build`） |
| `example-svelte` | Vite（`@nx/vite:build`） |
| `example-vanilla-ts` | Vite（`@nx/vite:build`） |
| `example-vanilla-js` | Vite（`@nx/vite:build`） |

開始地点はリポジトリ [README – サンプル](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md#サンプル) を参照してください。

## 公式に維持しないもの

- Angular build、Vite、webpack、esbuild、Rollup およびその主要バージョンすべてに対する **常時更新の公式 compatibility matrix**
- 未検証の bundler を **「非対応」「非互換」** と断定する表現。本ページや Examples に無いことは、**継続検証を主張しない**という意味に留めます

ESM の解決と RxJS peer 要件を満たせば、`package.json` の `exports` を理解する現代的な bundler の多くで消費できる想定です。具体的な import / build 失敗は、bundler・バージョン・最小再現付きで [GitHub Issues](https://github.com/gurezo/web-serial-rxjs/issues) へ報告してください。

## 関連

- [クイックスタート – インストールと peer dependency](./quick-start.md#installation)
- [ブラウザサポートと公式サポート方針](./browser-support.md)
- [バージョンサポートとリリース方針](./version-support.md)
- リポジトリ [README – サンプル](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md#サンプル)
- パッケージ [`package.json` の exports と peers](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/package.json)

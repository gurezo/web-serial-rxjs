# Bundle size と tree-shaking

このページは、`@gurezo/web-serial-rxjs` のサイズと tree-shaking を**どう測るか**、および **library-only** のスナップショット結果をまとめます。**採用判断**のための文書です。数値は再現可能なスナップショットであり、CI のサイズ上限や、あらゆるアプリ bundler が同じバイト数になることの保証ではありません。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#563](https://github.com/gurezo/web-serial-rxjs/issues/563) · Related: [Bundler / framework 互換性](./bundler-compatibility.md) · [バージョンサポート](./version-support.md)

## 用語

| 用語 | 意味 |
| --- | --- |
| **Library-only** | **`rxjs` を external** にした本パッケージ本体のサイズ。RxJS **peer dependency** は一次指標に**含めない** |
| **npm pack tarball / unpacked** | 公開パッケージ全体のフットプリント（runtime、型、README、LICENSE、icon など） |
| **公開成果物** | 配布される `dist/index.mjs`（minify されていない ESM。ビルド時点で `rxjs` は external） |
| **Consumer fixture** | named export を import する小さなエントリを esbuild で束ねた測定用アプリ |
| **Tree-shaking** | 未使用の named export が consumer bundle から除外されること |

## 何を測るか

| 指標 | 目的 |
| --- | --- |
| npm pack tarball + unpacked | 公開パッケージの取得・展開コスト |
| `dist/index.mjs` の raw / minified / gzip / brotli | アプリコードを含まない runtime 成果物 |
| 最小 import（`isWebSerialSupported` のみ） | API の大部分を使わない場合の下限 |
| Session import（`createSerialSession` + `isWebSerialSupported`） | セッション利用時の代表的な面 |
| Tree-shake プローブ | 未使用 export（例: `createTerminalBuffer`）が最小 minified bundle に含まれないこと |

### 約束しないこと

- CI で強制する **ハードなサイズ上限**
- あらゆる bundler / minify / 圧縮設定でこのバイト数と一致すること
- **RxJS**（や framework）のサイズを「込み」として扱うこと — `rxjs` は別途インストール。詳細は [Bundler / framework 互換性](./bundler-compatibility.md)
- デバイス別・Example 別のサイズ主張

## 測定手順

正規のスクリプト: [`tools/bundle-size/`](https://github.com/gurezo/web-serial-rxjs/tree/main/tools/bundle-size)（[README](https://github.com/gurezo/web-serial-rxjs/blob/main/tools/bundle-size/README.md)）。

リポジトリルートで:

```bash
pnpm --filter @gurezo/web-serial-rxjs build
node tools/bundle-size/measure.mjs
```

スクリプトが固定する条件:

| 条件 | 値 |
| --- | --- |
| Bundler | ワークスペースの **esbuild**（レポートに版を出力） |
| Consumer 解決 | `tools/bundle-size/.out/node_modules/@gurezo/web-serial-rxjs` → パッケージルートの symlink（`exports` と `sideEffects` が適用される） |
| Peer の扱い | `rxjs` は**常に** `external` |
| Minify | minified と書いた行は esbuild `minify: true` |
| gzip | Node `zlib` level **9** |
| brotli | Node brotli quality **11** |
| 出力 | stdout の要約 + `tools/bundle-size/.out/report.json` |

## 結果スナップショット

ビルド後に `node tools/bundle-size/measure.mjs` を実行して記録したものです。

| 項目 | 値 |
| --- | --- |
| Package | `@gurezo/web-serial-rxjs@4.0.3` |
| 測定時刻 (UTC) | `2026-08-08T06:06:08.377Z` |
| Node | `v24.16.0` |
| esbuild | `0.28.1` |
| `package.json` の `sideEffects` | `false` |

### npm pack（公開パッケージ全体）

| 指標 | Bytes |
| --- | --- |
| Tarball | 212,301 |
| Unpacked | 442,307 |
| Files | 65 |

型・README・LICENSE・icon・`dist/` を含みます。runtime のみのサイズの代替ではありません。

### 公開 runtime 成果物（`dist/index.mjs`、library-only）

| 形態 | raw | gzip | brotli |
| --- | ---: | ---: | ---: |
| 公開どおり（unminified） | 45,138 | 10,200 | 8,862 |
| Minified（esbuild、測定用） | 16,497 | 5,527 | 5,005 |

npm 成果物自体は **minify されていません**。minified 行は転送サイズ比較用です。

### Consumer esbuild bundles（`rxjs` external）

| Fixture | 形態 | raw | gzip | brotli |
| --- | --- | ---: | ---: | ---: |
| `isWebSerialSupported` のみ | raw | 13,416 | 3,836 | 3,180 |
| `isWebSerialSupported` のみ | minified | 3,501 | 1,244 | 1,090 |
| `createSerialSession` + `isWebSerialSupported` | raw | 43,688 | 9,876 | 8,579 |
| `createSerialSession` + `isWebSerialSupported` | minified | 16,206 | 5,448 | 4,942 |

### Tree-shaking と `sideEffects`

- パッケージは **`"sideEffects": false`** を設定し、フィールドを尊重する bundler が import 時 side effect なしとして扱えるようにしています。
- 測定スクリプトの **tree-shaking 検査**は、**最小 minified** consumer bundle に `createTerminalBuffer`、`DEFAULT_TERMINAL_BUFFER_OPTIONS`、`SerialErrorCode` などの未使用 export 名が含まれないことを確認します。
- スナップショット結果: **PASS**（当該シンボルなし）。

API やビルドが変わったらスクリプトを再実行し、ベースライン更新時に本ページを更新してください。

## Related

- 測定ツール: [`tools/bundle-size/`](https://github.com/gurezo/web-serial-rxjs/tree/main/tools/bundle-size)
- [Bundler / framework 互換性の検証方針](./bundler-compatibility.md)
- [バージョンサポートとリリース方針](./version-support.md)
- [ブラウザサポートと公式サポート方針](./browser-support.md)
- パッケージ [`package.json`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/package.json)（`exports`、`sideEffects`、`peerDependencies`）

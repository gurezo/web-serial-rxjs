# Scopes

web-serial-rxjs で使用可能な scope の一覧と用途。`commitlint.config.js` の `scope-enum` と完全に一致させる。

## 一覧

| scope | 対象パス | プロジェクト名 (`project.json`) | 用途 |
| --- | --- | --- | --- |
| `web-serial-rxjs` | `packages/web-serial-rxjs` | `web-serial-rxjs` | `@gurezo/web-serial-rxjs` ライブラリ |
| `example-angular` | `apps/example-angular` | `example-angular` | Angular サンプル |
| `example-react` | `apps/example-react` | `example-react` | React サンプル |
| `example-vue` | `apps/example-vue` | `example-vue` | Vue サンプル |
| `example-svelte` | `apps/example-svelte` | `example-svelte` | Svelte サンプル |
| `example-vanilla-js` | `apps/example-vanilla-js` | `example-vanilla-js` | Vanilla JS サンプル |
| `example-vanilla-ts` | `apps/example-vanilla-ts` | `example-vanilla-ts` | Vanilla TS サンプル |
| `examples-shared` | `libs/examples-shared` | `examples-shared` | example 用 shared adapter |
| `workspace` | リポジトリルート | (該当なし) | `package.json` / `nx.json` / `.husky/` / `commitlint.config.js` / `.cursor/` / README / CONTRIBUTING 等 |
| `docs` | ドキュメント全般 | (該当なし) | ドキュメント横断 |
| `readme` | README 単体 | (該当なし) | README のみ |
| `release` | リリース運用 | (該当なし) | |
| `ci` | `.github/workflows/` | (該当なし) | GitHub Actions |
| `build` | ビルドシステム | (該当なし) | |
| `nx` | nx.json / Nx 設定 | (該当なし) | |
| `deps` | 依存関係更新 | (該当なし) | |
| `repo` | リポジトリ運用 | (該当なし) | |
| `test` | クロスプロジェクトのテスト | (該当なし) | |

## scope source

```text
apps/**/project.json
libs/**/project.json
packages/**/project.json
```

`libs/` の project は `name` を scope にし、`commitlint.config.js` を更新する。

## scope 選択の考え方

1. **単一プロジェクトに収まる変更**: その `project.json` の `name` を scope に使う。
2. **複数プロジェクトに跨る変更**: 最も影響の広い project を優先。判断できない場合は `workspace`。
3. **ルート設定・ツール変更**: `workspace`。
4. **GitHub Actions**: `ci`。

## 新規プロジェクト追加時の手順

新しい app / lib を追加した場合、以下を **同時に** 更新する。

1. `commitlint.config.js` の `scope-enum` に新しい scope を追加。
2. このファイル (`scopes.md`) に新しい行を追加。
3. `.cursor/rules/nx/30-nx-project-scope.mdc` の推奨 scope 表を更新。
4. `CONTRIBUTING.md` / `CONTRIBUTING.ja.md` の記載があれば更新。

## 参照

- [`SKILL.md`](SKILL.md)
- [`examples.md`](examples.md)
- [`assertions.md`](assertions.md)
- [`../../../commitlint.config.js`](../../../commitlint.config.js)

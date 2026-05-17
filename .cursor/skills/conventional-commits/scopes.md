# Conventional Commits Scope 一覧

`web-serial-rxjs` で利用可能な scope の正本。`apps/**/project.json` および `packages/**/project.json` の `name` プロパティに同期させる。

## 基本方針

- scope は hand-written な固定文字列ではなく、Nx Workspace の `project.json` の `name` から決定する
- 最終的な許可リストは [commitlint.config.js](../../../commitlint.config.js) の `scope-enum`
- Cursor / AI が scope を選ぶときは、変更対象ファイルから最も近い `project.json` を辿る

## Scope source

```text
apps/**/project.json
libs/**/project.json
packages/**/project.json
```

## 現在の Project スコープ

| パス | `project.json` の `name` | scope |
| --- | --- | --- |
| `packages/web-serial-rxjs/project.json` | `web-serial-rxjs` | `web-serial-rxjs` |
| `apps/example-angular/project.json` | `example-angular` | `example-angular` |
| `apps/example-react/project.json` | `example-react` | `example-react` |
| `apps/example-vue/project.json` | `example-vue` | `example-vue` |
| `apps/example-svelte/project.json` | `example-svelte` | `example-svelte` |
| `apps/example-vanilla-js/project.json` | `example-vanilla-js` | `example-vanilla-js` |
| `apps/example-vanilla-ts/project.json` | `example-vanilla-ts` | `example-vanilla-ts` |

> `libs/` は現状未使用。今後 `libs/<name>/project.json` が追加された場合は、その `name` を scope として利用する（commitlint の `scope-enum` も同時に更新する）。

## Fallback scope（project 非依存変更のみ）

以下は `project.json` に対応しない、Workspace 横断の変更で利用する。

| scope | 用途 |
| --- | --- |
| `workspace` | ルート設定・複数 project に跨る変更 |
| `docs` | ドキュメント全般 |
| `readme` | README 単体 |
| `release` | リリース運用 |
| `ci` | GitHub Actions など CI 関連 |
| `build` | ビルドシステム |
| `nx` | nx.json / nx 設定 |
| `deps` | 依存関係更新 |
| `repo` | リポジトリ運用 |
| `test` | クロスプロジェクトのテスト |

## 使用例

```text
feat(web-serial-rxjs): add receive stream helper
fix(web-serial-rxjs): handle reconnect timing
feat(example-angular): add Angular Signals example
fix(example-react): handle StrictMode remount in useSerialSession
test(web-serial-rxjs): add disconnect tests
docs(workspace): update README quick start
ci(workspace): update npm publish workflow
chore(workspace): bump pnpm dependencies
```

## 同期ルール

新しい `project.json` を追加・リネーム・削除したときは、以下を同時に更新する。

1. `apps/<name>/project.json` または `packages/<name>/project.json` の `name`
2. [commitlint.config.js](../../../commitlint.config.js) の `scope-enum`
3. 本ファイル（`scopes.md`）と [.cursor/rules/nx-project-scope.mdc](../../rules/nx-project-scope.mdc)

3 つの整合が取れていないと commitlint が失敗する。

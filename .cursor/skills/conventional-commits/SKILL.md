---
name: conventional-commits
description: web-serial-rxjs（TypeScript + RxJS + Nx Workspace）用に Conventional Commits 準拠の commit message と PR title を生成・検証する。git commit を作成するとき、PR タイトルを決めるとき、コミットメッセージのレビューを求められたとき、もしくは scope 選定が必要なときに自動的に適用する。
---

# Conventional Commits for web-serial-rxjs

`web-serial-rxjs` における Conventional Commits の運用を AI に教えるためのスキル。`.cursor/rules/conventional-commits.mdc` / `.cursor/rules/pull-request-title.mdc` / `.cursor/rules/nx-project-scope.mdc` と組み合わせて利用する。

## 前提

- TypeScript ライブラリ（`packages/web-serial-rxjs`）
- RxJS ベースの公開 API（`SerialSession` ほか）
- Nx Workspace（`apps/example-*` を含む）
- npm package として公開（`@gurezo/web-serial-rxjs`）
- commitlint + husky でローカル・CI 両方で検証

## 形式

```text
<type>(<scope>): <summary>

[optional body]

[optional footer(s)]
```

- `type` / `scope` は lowercase
- `summary` は命令形・現在形、末尾ピリオド禁止、72 文字以内
- `summary` の冒頭は大文字にしない

## 許可される type

`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`

## scope の決定方法

1. 変更対象ファイルの最も近い `project.json` を探す
2. その `project.json` の `name` を scope に使う
3. project に紐付かない変更は fallback scope（`workspace` / `docs` / `ci` など）を使う
4. 最終的な許可リストは [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` と一致させる

詳細は [scopes.md](scopes.md) を参照。

## 分類のガイド

| 変更内容 | type | 補足 |
| --- | --- | --- |
| Public API の追加（`SerialSession` の新メソッド等） | `feat` | 互換性に影響する場合は `!` |
| Public API のシグネチャ変更・削除 | `feat!` / `refactor!` | `BREAKING CHANGE:` を併記 |
| 内部実装のリファクタリング（API 変更なし） | `refactor` | |
| RxJS stream の挙動修正 | `fix` | |
| example アプリの修正・追加 | `feat` / `fix`（scope は `example-*`） | |
| ドキュメント・README・OVERVIEW など | `docs` | scope: `docs` / `readme` / `workspace` |
| テスト追加 | `test` | |
| 依存関係更新 | `chore`（または `build`） | scope: `deps` / `workspace` |
| CI ワークフロー | `ci` | scope: `ci` / `workspace` |
| パフォーマンス改善 | `perf` | |

## breaking change

破壊的変更は次のいずれかで明示する。

- `type(scope)!: summary`（`!` を付ける）
- footer に `BREAKING CHANGE: <description>` を記載

```text
feat(web-serial-rxjs)!: change SerialSession.connect signature

BREAKING CHANGE: connect() now returns Observable<SerialSession> instead of Promise.
```

## 生成ワークフロー

1. `git status` / `git diff` で変更ファイルを把握
2. 変更ファイルから [nx-project-scope.mdc](../../rules/nx-project-scope.mdc) のルールで scope を解決
3. 変更内容から `type` を選ぶ（上の分類表を参照）
4. 命令形 72 文字以内の `summary` を書く
5. 必要に応じて body / footer を追加
6. [assertions.md](assertions.md) の Valid 例と照合し、Invalid パターンに該当しないか確認

## 関連リソース

- [examples.md](examples.md): Good / Bad の具体例
- [assertions.md](assertions.md): 検証項目と Valid / Invalid 一覧
- [scopes.md](scopes.md): scope 一覧と同期方針
- [.cursor/rules/conventional-commits.mdc](../../rules/conventional-commits.mdc)
- [.cursor/rules/pull-request-title.mdc](../../rules/pull-request-title.mdc)
- [.cursor/rules/nx-project-scope.mdc](../../rules/nx-project-scope.mdc)
- [commitlint.config.js](../../../commitlint.config.js)
- [CONTRIBUTING.ja.md](../../../CONTRIBUTING.ja.md) / [CONTRIBUTING.md](../../../CONTRIBUTING.md)

# Conventional Commits 検証項目

`web-serial-rxjs` 用に生成された commit message / PR title を、コミット前・PR 作成前に AI が自己検証するためのチェックリスト。

## 検証項目（必須）

1. Conventional Commits 形式（`<type>(<scope>): <summary>`）になっているか
2. `type` が許可リスト（`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`）のいずれかか
3. `scope` が以下のいずれかか
   - `apps/**/project.json` または `packages/**/project.json` の `name`
   - fallback scope（`workspace` / `docs` / `readme` / `release` / `ci` / `build` / `nx` / `deps` / `repo` / `test`）
4. `scope` が [commitlint.config.js](../../../commitlint.config.js) の `scope-enum` に存在するか
5. `summary` が命令形・現在形か
6. `summary` の冒頭が lowercase か
7. `summary` の末尾にピリオドが付いていないか
8. `summary` が 72 文字以内か
9. `type` と変更内容が一致しているか（リファクタを `feat` にしない等）
10. Public API 変更時に `!` または `BREAKING CHANGE:` が付与されているか

## 検証ステップ

1. メッセージを 1 行目（header）と body / footer に分解する
2. 上記 1〜10 を順にチェックする
3. いずれかに違反していたら修正してから再検証する
4. 通過したらコミット / PR を進める

## Valid サンプル

以下はいずれも全項目を満たす。

```text
feat(web-serial-rxjs): add SerialSession API
fix(web-serial-rxjs): prevent duplicated receive stream
feat(example-angular): add Signals example
fix(example-react): handle StrictMode remount in useSerialSession
refactor(web-serial-rxjs): simplify connection lifecycle
docs(workspace): update quick start guide
ci(workspace): update npm publish workflow
chore(workspace): bump pnpm dependencies
feat(web-serial-rxjs)!: change SerialSession.connect signature
```

## Invalid サンプル

各サンプルがどの項目に違反しているかを示す。

| メッセージ | 違反 |
| --- | --- |
| `feat(core): add api` | 3 / 4（`core` は project.json に存在せず scope-enum にもない） |
| `fix(serial): fix bug` | 3 / 4（`serial` は scope に存在しない）+ 9（内容曖昧） |
| `refactor(utils): cleanup` | 3 / 4（`utils` は存在しない） |
| `update files` | 1（形式違反） |
| `WIP` | 1 |
| `fix issue` | 1 + 2 |
| `feat: Added New Feature.` | 5（過去形）/ 6（大文字）/ 7（末尾ピリオド） |
| `feat(web-serial-rxjs): Add SerialSession API.` | 6 / 7 |
| `feat(web-serial-rxjs): fix typo in README` | 9（実態は `docs`） |
| `refactor(web-serial-rxjs): add new method` | 9（実態は `feat`） |

## 自動検証との関係

- ローカル: [.husky/commit-msg](../../../.husky/commit-msg) が `commitlint` を起動
- CI: [.github/workflows/commitlint.yml](../../../.github/workflows/commitlint.yml) が PR 内のコミットを検証
- 設定: [commitlint.config.js](../../../commitlint.config.js)

AI が生成するメッセージは、上記の自動検証を **通過する前提** で出力する。違反すると commit / push が失敗する。

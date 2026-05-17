# Assertions

commit message / PR title を Conventional Commits に準拠させるための検証項目。AI が生成または検証するときに使うチェックリスト。

## 検証項目

1. **形式**: `<type>(<scope>): <summary>` の形式になっているか。
2. **type**: 許可された値 (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`) のいずれかで、小文字か。
3. **scope**: `commitlint.config.js` の `scope-enum` に含まれる値か。`scopes.md` と一致するか。小文字でハイフン区切りか。
4. **summary**: 簡潔で命令形 (imperative mood) か。
5. **summary 先頭**: 小文字か。
6. **summary 末尾**: ピリオドが付いていないか。
7. **summary 長さ**: 72 文字以内か。
8. **整合性**: type と変更対象が一致しているか (例: ドキュメントのみ変更で `feat` を使っていないか)。
9. **scope と変更対象の一致**: 変更ファイルが scope に対応するディレクトリと一致しているか。
10. **breaking change**: 破壊的変更がある場合、footer に `BREAKING CHANGE: ` が記載されているか (`!` 表記を使っていないか)。
11. **混在**: 関連性のない変更を 1 つのコミットにまとめていないか。

## Valid 例

```
feat(web-serial-rxjs): add SerialSession API
fix(web-serial-rxjs): prevent duplicated receive stream
feat(example-angular): add disconnect smoke test
fix(example-react): handle StrictMode remount in useSerialSession
docs(workspace): update readme quick start
test(web-serial-rxjs): add disconnect tests
ci(workspace): update npm publish workflow
chore(workspace): bump pnpm dependencies
```

破壊的変更を含む Valid 例:

```
feat(web-serial-rxjs): change SerialSession connect api

BREAKING CHANGE: connect が Observable を返さなくなりました
```

## Invalid 例と修正案

| Invalid | 違反項目 | 修正案 |
| --- | --- | --- |
| `fix stuff` | 1, 3, 4 | `fix(web-serial-rxjs): correct reconnect timing` |
| `update console` | 1, 2, 3 | `refactor(example-react): update debug logging` |
| `Added new feature` | 1, 5 | `feat(web-serial-rxjs): add new feature` |
| `WIP` | 1, 2, 3, 4 | コミットを分割し具体的なメッセージにする |
| `feat: Added New Feature.` | 4, 5, 6 | `feat(web-serial-rxjs): add new feature` |
| `feat(WEB): add helper` | 3 | `feat(example-react): add helper` |
| `feat(web-serial-rxjs)!: change api` | 10 | `feat(web-serial-rxjs): change api` + footer に `BREAKING CHANGE: ...` |

## 自動検証

ローカル: `.husky/commit-msg` が `pnpm exec commitlint --edit "$1"` を実行する。
CI: `.github/workflows/commitlint.yml` が PR の全コミットを検証する。

## 参照

- [`SKILL.md`](SKILL.md)
- [`examples.md`](examples.md)
- [`scopes.md`](scopes.md)

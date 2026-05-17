# Examples

web-serial-rxjs における Conventional Commits の良い例と悪い例。

## 良い例

### feat

```
feat(web-serial-rxjs): add SerialSession API
feat(web-serial-rxjs): add receive stream helper
feat(example-react): add useSerialSession hook options
```

### fix

```
fix(web-serial-rxjs): prevent duplicated disconnect events
fix(example-react): handle StrictMode remount in useSerialSession
fix(example-angular): correct disconnect cleanup timing
```

### refactor

```
refactor(web-serial-rxjs): simplify connection lifecycle
refactor(example-vue): simplify composable structure
```

### docs

```
docs(workspace): update readme quick start
docs(workspace): document cursor rules structure
docs(example-svelte): update readme usage notes
```

### test

```
test(web-serial-rxjs): add disconnect tests
test(example-react): cover StrictMode double mount for useSerialSession
```

### ci

```
ci(workspace): update npm publish workflow
ci(workspace): update github actions workflow
```

### build

```
build(workspace): optimize affected build
chore(workspace): bump pnpm dependencies
```

### chore

```
chore(workspace): remove unused script
```

### breaking change

```
feat(web-serial-rxjs): change SerialSession connect api

BREAKING CHANGE: SerialSession の公開メソッドのシグネチャが変更されました
```

## 悪い例

| メッセージ | 理由 |
| --- | --- |
| `update files` | type / scope が無く、内容も曖昧 |
| `fix issue` | scope が無く、内容も曖昧 |
| `WIP` | 完成していない作業を表す不適切なメッセージ |
| `Added new API` | type が無く、命令形でなく、大文字始まり |
| `feat: Added New Feature.` | summary が大文字始まりで末尾にピリオド |
| `feat(CORE): add api` | scope が大文字 |
| `fix(serial): fix bug` | 存在しない scope |
| `feat(web-serial-rxjs)!: change api` | `!` 表記は使わず footer に `BREAKING CHANGE:` を書く |

## 参照

- [`SKILL.md`](SKILL.md)
- [`assertions.md`](assertions.md)
- [`scopes.md`](scopes.md)

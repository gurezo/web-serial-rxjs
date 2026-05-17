# Conventional Commits 例集

`web-serial-rxjs` における commit message / PR title の良い例・悪い例。

## 良い例（Good）

### Public ライブラリ（`packages/web-serial-rxjs`）

```text
feat(web-serial-rxjs): add SerialSession API
feat(web-serial-rxjs): add receive stream helper
fix(web-serial-rxjs): prevent duplicated disconnect events
fix(web-serial-rxjs): handle reconnect timing
refactor(web-serial-rxjs): simplify connection lifecycle
perf(web-serial-rxjs): reduce allocations in receive stream
test(web-serial-rxjs): add disconnect tests
docs(web-serial-rxjs): regenerate typedoc output
```

### Example アプリ

```text
feat(example-angular): add Signals example
fix(example-react): handle StrictMode remount in useSerialSession
refactor(example-vue): simplify composable structure
test(example-react): cover StrictMode double mount for useSerialSession
docs(example-svelte): update README quick start
```

### Workspace 横断・project 非依存

```text
docs(workspace): update quick start guide
docs(readme): align CONTRIBUTING with Cursor skills
ci(workspace): update npm publish workflow
build(workspace): optimize affected build
chore(workspace): bump pnpm dependencies
chore(workspace): bump package version to 2.3.2
```

### Breaking change

```text
feat(web-serial-rxjs)!: change SerialSession interface

BREAKING CHANGE: SerialSession.connect() now returns Observable<SerialSession>.
```

## 悪い例（Bad）

### 形式違反

```text
update files                       # type/scope/summary がない
fix issue                          # type/scope なし、内容も曖昧
WIP                                # 一時的なメッセージは禁止
refactoring                        # type なし
Added serial feature               # 過去形・大文字始まり
feat: Added New Feature.           # 大文字始まり + 末尾ピリオド
fix bug                            # type なし・内容曖昧
```

### scope 違反（`project.json` の `name` と不一致）

```text
feat(core): add api               # core は workspace に存在しない
fix(serial): fix bug              # serial は workspace に存在しない
refactor(utils): cleanup          # utils は workspace に存在しない
feat(lib): add helper             # lib は scope-enum に存在しない
```

### 内容と type の不一致

```text
feat(web-serial-rxjs): fix typo in README       # 実態は docs
refactor(web-serial-rxjs): add new method       # 実態は feat
chore(example-react): fix StrictMode bug        # 実態は fix
```

## PR タイトル例

PR タイトルも同じ規約に従う。

### 良い PR タイトル

```text
feat(web-serial-rxjs): add SerialSession API
fix(example-react): handle StrictMode remount in useSerialSession
refactor(web-serial-rxjs): simplify parser
docs(workspace): update README quick start
test(web-serial-rxjs): add disconnect tests
ci(workspace): update npm publish workflow
build(workspace): optimize affected build
```

### 悪い PR タイトル

```text
Update files
WIP: testing some changes
fix issue #123
feat(core): add api                # core は project.json になし
feat(web-serial-rxjs): Add SerialSession API.   # 大文字 + 末尾ピリオド
```

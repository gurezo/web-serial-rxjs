# web-serial-rxjs への貢献

web-serial-rxjs への貢献にご関心をお持ちいただき、ありがとうございます！このドキュメントでは、本プロジェクトへの貢献に関するガイドラインと手順を提供します。

## 目次

- [行動規範](#行動規範)
- [はじめに](#はじめに)
- [開発環境セットアップ](#開発環境セットアップ)
- [開発ワークフロー](#開発ワークフロー)
- [コミットメッセージガイドライン](#コミットメッセージガイドライン)
- [コードスタイルと標準](#コードスタイルと標準)
- [テストガイドライン](#テストガイドライン)
- [ビルドとリント](#ビルドとリント)
- [Pull Requestプロセス](#pull-requestプロセス)
- [プロジェクト構造](#プロジェクト構造)
- [ヘルプの取得](#ヘルプの取得)

## 行動規範

このプロジェクトは、すべての貢献者が従うべき行動規範を遵守しています。貢献の際は、他の方々に対して敬意と配慮を持って接してください。

## はじめに

### 前提条件

開始する前に、以下がインストールされていることを確認してください：

- **Node.js**: バージョン18.x以上
- **pnpm**: バージョン8.x以上（[インストールガイド](https://pnpm.io/installation)）
- **Git**: 最新の安定版

### 質問がある場合

質問やサポートが必要な場合は、以下を行ってください：

- [GitHub Issues](https://github.com/gurezo/web-serial-rxjs/issues)でイシューを開く
- 新しいイシューを作成する前に、既存のイシューやディスカッションを確認する

## 開発環境セットアップ

### 1. リポジトリのフォークとクローン

```bash
# GitHubでリポジトリをフォークし、その後フォークをクローン
git clone https://github.com/YOUR_USERNAME/web-serial-rxjs.git
cd web-serial-rxjs

# アップストリームリポジトリを追加
git remote add upstream https://github.com/gurezo/web-serial-rxjs.git
```

### 2. 依存関係のインストール

```bash
pnpm install
```

### 3. インストールの確認

```bash
# すべてのテストを実行してセットアップが正しく行われているか確認
pnpm test
```

### 4. Git フックのセットアップ

このプロジェクトでは、Husky を使用してコミットメッセージを自動的に検証します。依存関係をインストールすると、`prepare` スクリプトが自動的に実行され、Git フックがセットアップされます。

初回セットアップ時や、Git フックが正しく設定されていない場合は、以下のコマンドを実行してください：

```bash
pnpm run prepare
```

これにより、コミット時に Conventional Commits に準拠しているかが自動的にチェックされます。

## 開発ワークフロー

### ブランチ命名規則

ブランチ名には[Conventional Commits](https://www.conventionalcommits.org/)の命名規則に従います：

- `feat/scope-description` - 新機能
- `fix/scope-description` - バグ修正
- `docs/scope-description` - ドキュメント更新
- `refactor/scope-description` - コードリファクタリング
- `test/scope-description` - テストの追加または更新
- `chore/scope-description` - メンテナンス作業（依存関係、ツーリングなど）
- `build/scope-description` - ビルドシステムまたは外部依存関係の変更

**例:**

- `feat/web-serial-rxjs/add-filter-function`
- `fix/example-angular/test-errors`
- `docs/workspace/update-readme`
- `refactor/apps/restructure-directories`

### ワークフローの手順

1. **mainブランチから機能ブランチを作成**：

   ```bash
   git checkout main
   git pull upstream main
   git checkout -b feat/your-feature-name
   ```

2. **変更を加えてコミット**（[コミットメッセージガイドライン](#コミットメッセージガイドライン）に従う）

3. **ブランチをフォークにプッシュ**：

   ```bash
   git push origin feat/your-feature-name
   ```

4. **GitHubでPull Requestを作成**（変更内容を明確に説明）

5. **すべてのチェックが通過することを確認** - CIが自動的にテストとリントを実行します

## コミットメッセージガイドライン

私たちは厳密に[Conventional Commits](https://www.conventionalcommits.org/)仕様に従っています。これにより、バージョニング、チェンジログ生成の自動化が可能になり、git履歴がより読みやすくなります。

### 自動チェック機能

このプロジェクトでは、コミットメッセージが Conventional Commits に準拠しているかを自動的にチェックします：

- **ローカルでのチェック**: Husky と commitlint を使用して、コミット時に自動的にメッセージを検証します。準拠していない場合はコミットが拒否されます。
- **プルリクエストでのチェック**: GitHub Actions を使用して、PR 内のすべてのコミットメッセージを検証します。準拠していない場合は CI が失敗します。

コミットメッセージが拒否された場合は、エラーメッセージを確認して、正しい形式に修正してください。

### コミットメッセージ形式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（タイプ）

タイプは次のいずれかでなければなりません：

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更（空白、フォーマット、セミコロンの追加など）
- `refactor`: バグ修正でも新機能追加でもないコード変更
- `test`: テストの追加または更新
- `chore`: ビルドプロセスまたは補助ツールやライブラリの変更（ドキュメント生成など）
- `build`: ビルドシステムまたは外部依存関係に影響する変更

### Scope（スコープ）

スコープは、影響を受けるパッケージまたは領域の名前です：

- `web-serial-rxjs` - メインライブラリパッケージの変更
- `example-angular`, `example-react`, `example-vue`, `example-svelte`, `example-vanilla-js`, `example-vanilla-ts` - サンプルアプリケーションの変更
- `workspace` - ワークスペース設定、ルートレベルのファイルの変更
- `example-angular-e2e`, `example-react-e2e` など - E2Eテストの変更

複数のスコープが影響を受ける場合は、スコープを省略するか、`workspace`などのより広いスコープを使用できます。

### Subject（サブジェクト）

サブジェクトには変更の簡潔な説明が含まれます：

- 命令形、現在形を使用：「変更する」であって「変更した」「変更します」ではない
- 最初の文字は大文字にしない
- 末尾にピリオド（.）を付けない
- 最大72文字

### Body（本文、オプション）

本文には以下を含めるべきです：

- 変更の動機
- 以前の動作との対比
- 72文字で折り返す

### Footer（フッター、オプション）

フッターには以下を含めるべきです：

- イシュー参照：`Closes #123`, `Fixes #456`
- 破壊的変更：`BREAKING CHANGE: <description>`

### 例

**良いコミットメッセージ:**

```
feat(web-serial-rxjs): add filter function for data processing

Add a new filter function that allows users to process incoming
serial data before it reaches the observable stream.

Closes #42
```

```
fix(example-angular): resolve test errors in component

Fix type errors and missing dependencies in Angular component tests.
```

```
docs(workspace): update README with new commands

Update installation and usage instructions to reflect current
project structure.
```

```
refactor(apps): move vue-e2e to example-vue-e2e

Restructure directory to follow consistent naming convention
across all example applications.
```

```
build(workspace): migrate from npm to pnpm

Migrate package manager to pnpm for better monorepo support
and faster installations.
```

**悪いコミットメッセージ:**

```
❌ Fixed bug
❌ update docs
❌ changes
❌ feat: Added new feature (間違った大文字化、「Added」は命令形ではない)
❌ fix: fixed the bug (冗長な「fix:」)
```

## コードスタイルと標準

### TypeScript

- TypeScriptのベストプラクティスに従い、適切な型付けを使用
- 可能な限り`any`型を避ける
- 意味のある変数名と関数名を使用
- 関数を焦点を絞り、単一責任に保つ

### ESLint

コード品質のためにESLintを使用しています。コミット前にリントを実行してください：

```bash
# すべてのプロジェクトをリント
nx run-many --target=lint --all

# 特定のプロジェクトをリント
nx lint web-serial-rxjs
nx lint example-angular
```

### Prettier

コードフォーマットのためにPrettierを使用しています。プロジェクトは自動的にコードをフォーマットするように設定されています。エディタが保存時にフォーマットするように設定されていることを確認してください。

### インポートの整理

- インポートをグループ化：外部パッケージ、次に内部パッケージ
- 可能な場合は絶対インポートを使用（TypeScriptパスマッピング経由）
- 循環依存を避ける

## テストガイドライン

### テストの実行

```bash
# すべてのプロジェクトのテストを実行
pnpm test

# 特定のパッケージのテストを実行
nx test web-serial-rxjs

# 特定のアプリのテストを実行
nx test example-angular
nx test example-react

# ウォッチモードでテストを実行
nx test web-serial-rxjs --watch

# E2Eテストを実行
nx e2e example-angular-e2e
```

### テストの作成

- **ユニットテスト**: ユニットテストにはVitestを使用
  - テストファイルをソースファイルの隣に配置：`myfile.ts` → `myfile.test.ts`
  - または`tests`ディレクトリに：`src/lib/myfile.ts` → `tests/lib/myfile.test.ts`

- **E2Eテスト**: エンドツーエンドテストにはPlaywrightを使用
  - E2Eテストは別のプロジェクトに：`apps/example-*-e2e`

- **テストカバレッジ**: 特にライブラリパッケージでは、良いテストカバレッジを目指す

### テストファイルの命名

- ユニットテスト：`*.test.ts`または`*.spec.ts`
- E2Eテスト：`*.spec.ts`

## ビルドとリント

### ビルド

```bash
# すべてのプロジェクトをビルド
nx run-many --target=build --all

# 特定のパッケージをビルド
nx build web-serial-rxjs

# 特定のアプリをビルド
nx build example-angular
```

PRを提出する前に、コードが正常にビルドされることを確認してください。

### リント

```bash
# すべてのプロジェクトをリント
nx run-many --target=lint --all

# 特定のプロジェクトをリント
nx lint web-serial-rxjs
```

すべてのコードはリントチェックを通過する必要があります。

## Pull Requestプロセス

### 提出前

- [ ] コードがプロジェクトのスタイルガイドラインに従っている
- [ ] すべてのテストがローカルで通過する（`pnpm test`）
- [ ] コードがリントされ、通過する（`nx run-many --target=lint --all`）
- [ ] コードが正常にビルドする（`nx run-many --target=build --all`）
- [ ] コミットメッセージが[コミットメッセージガイドライン](#コミットメッセージガイドライン）に従っている
- [ ] ドキュメントが更新されている（該当する場合）
- [ ] ブランチが`upstream/main`と最新である

### Pull Requestの説明

PRの説明に以下を含めてください：

- **概要**: 変更の簡潔な説明
- **変更の種類**: 機能、バグ修正、ドキュメントなど
- **動機**: なぜこの変更が必要なのか？
- **テスト**: どのようにテストしたか？
- **チェックリスト**: すべての要件を完了したことを確認

### レビュープロセス

1. 自動チェックが実行されます（テスト、リント、ビルド）
2. メンテナがコードをレビューします
3. フィードバックや要求された変更に対応します
4. 承認されると、PRがマージされます

### PRを最新の状態に保つ

PRがmainブランチと古くなっている場合：

```bash
git checkout feat/your-feature-name
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin feat/your-feature-name
```

## プロジェクト構造

これは[Nx](https://nx.dev)モノレポワークスペースで、以下の構造を持っています：

```
web-serial-rxjs/
├── packages/
│   └── web-serial-rxjs/       # メインライブラリパッケージ
├── apps/
│   ├── example-angular/        # Angularサンプルアプリ
│   ├── example-react/          # Reactサンプルアプリ
│   ├── example-vue/            # Vueサンプルアプリ
│   ├── example-svelte/         # Svelteサンプルアプリ
│   ├── example-vanilla-js/     # バニラJavaScriptサンプル
│   ├── example-vanilla-ts/     # バニラTypeScriptサンプル
│   └── example-*-e2e/          # E2Eテストプロジェクト
└── tools/                      # ビルドおよび開発ツール
```

### 主要パッケージ

- **`@gurezo/web-serial-rxjs`**: RxJSベースのWeb Serial API機能を提供するメインライブラリ

### Nxコマンド

使用する可能性のある一般的なNxコマンド：

```bash
# 特定のプロジェクトのコマンドを実行
nx <target> <project>

# 複数のプロジェクトのコマンドを実行
nx run-many --target=<target> --all
nx run-many --target=<target> --projects=<project1>,<project2>

# 新しいコードを生成
nx generate @nx/react:component MyComponent --project=example-react

# 依存関係グラフを表示
nx graph
```

## ヘルプの取得

- **GitHub Issues**: [イシューを開く](https://github.com/gurezo/web-serial-rxjs/issues)
- **GitHubリポジトリ**: [web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)

web-serial-rxjs への貢献ありがとうございます！🎉

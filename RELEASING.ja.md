# リリース手順

このドキュメントは `@gurezo/web-serial-rxjs` のリリースプロセスを説明します。リリースプロセスは、バージョンタグをプッシュすると GitHub Actions により**完全に自動化**されます。

## 概要

リリースは Git タグで管理されます。`v*.*.*` パターン（例: `v1.0.0`）に一致するタグを `main` ブランチにプッシュすると、GitHub Actions が自動的に以下を実行します：

1. パッケージのビルド
2. テストの実行
3. npm への公開（Trusted Publishing / OIDC を使用）
4. リリースノート付きの GitHub リリース作成

**手動の `npm publish` は不要です** - プロセス全体が自動化されています！

## 前提条件

リリース前に、以下を確認してください：

1. **すべての変更が `main` にマージされている**: リリースは最新の `main` ブランチに基づくべきです
2. **テストが通過する**: ローカルで `pnpm test` を実行してすべてが動作することを確認
3. **ビルドが成功する**: `pnpm exec nx build web-serial-rxjs` を実行してビルドを確認
4. **バージョン番号**: [セマンティックバージョニング](https://semver.org/)に従って適切なバージョン番号を決定
   - **MAJOR** (例: `1.0.0` → `2.0.0`): 破壊的変更
   - **MINOR** (例: `1.0.0` → `1.1.0`): 新機能（後方互換性あり）
   - **PATCH** (例: `1.0.0` → `1.0.1`): バグ修正（後方互換性あり）
5. **package.json のバージョン**: `packages/web-serial-rxjs/package.json` のバージョンをタグと一致させる
6. **ドキュメント**: メンテナンスされている場合は `CHANGELOG.md` を更新（任意）

## リリース手順

### ステップ 1: リリースの準備（任意）

`package.json` のバージョン番号を更新したり、CHANGELOG エントリを追加する必要がある場合は、リリース用 PR を作成します：

1. **`main` からリリースブランチを作成**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b release/v1.0.0  # バージョンに置き換えてください
   ```

2. **package.json のバージョンを更新**:
   ```bash
   # packages/web-serial-rxjs/package.json を編集
   # "version": "0.1.4" を "version": "1.0.0" に変更
   ```

3. **CHANGELOG.md を更新**（メンテナンスされている場合）:
   - このリリースの変更を文書化

4. **コミットしてプッシュ**:
   ```bash
   git add packages/web-serial-rxjs/package.json
   git commit -m "chore(release): prepare release v1.0.0"
   git push origin release/v1.0.0
   ```

5. **Pull Request を作成**して `main` にマージ

**注意**: タグ付けとリリースのみが必要な場合（バージョン/ドキュメント更新が不要）、このステップをスキップしてステップ 2 に直接進むことができます。

### ステップ 2: ローカルの `main` ブランチを更新

ローカルの `main` ブランチが最新であることを確認：

```bash
git checkout main
git pull origin main
```

### ステップ 3: バージョンタグを作成してプッシュ

リリース用の注釈付きタグを作成：

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

**重要**: 
- タグ形式は `v*.*.*` である必要があります（例: `v1.0.0`, `v0.2.1`, `v2.0.0-beta.1`）
- タグは `main` ブランチからプッシュする必要があります
- タグ名は `packages/web-serial-rxjs/package.json` のバージョンと一致する必要があります

### ステップ 4: GitHub Actions が自動的にリリース

タグをプッシュすると、GitHub Actions が自動的に以下を実行します：

1. ✅ タグ付けされたコミットでコードをチェックアウト
2. ✅ 依存関係をインストール（`pnpm install --frozen-lockfile`）
3. ✅ テストを実行（`pnpm test`）
4. ✅ パッケージをビルド（`pnpm exec nx build web-serial-rxjs`）
5. ✅ リリース用 zip ファイルを作成
6. ✅ Trusted Publishing (OIDC) を使用して npm に公開 - トークン不要！
7. ✅ 自動生成されたリリースノート付きの GitHub リリースを作成
8. ✅ GitHub リリースにリリース zip を添付

進行状況は GitHub の [Actions タブ](https://github.com/gurezo/web-serial-rxjs/actions) で確認できます。

### ステップ 5: リリースを確認

ワークフローが完了した後：

1. **npm を確認**: パッケージが [npmjs.com/package/@gurezo/web-serial-rxjs](https://www.npmjs.com/package/@gurezo/web-serial-rxjs) で公開されたことを確認
2. **GitHub リリースを確認**: リリースが [GitHub Releases](https://github.com/gurezo/web-serial-rxjs/releases) で作成されたことを確認
3. **インストールをテスト**: 新しいバージョンをインストールしてみる：
   ```bash
   npm install @gurezo/web-serial-rxjs@latest
   ```

## ブランチ保護とタグ付け

リリースプロセスはブランチ保護ルールを尊重します：

- **タグはローカルの `main` からプッシュ**: タグは直接プッシュされるため（PR 経由ではない）、`main` にマージ後にローカルで作成できます
- **ワークフローはタグプッシュで実行**: GitHub Actions ワークフローはタグプッシュイベントでトリガーされ、ブランチプッシュイベントでは実行されません
- **`main` への直接コミットは不要**: タグは独立してプッシュできます

このアプローチにより：
- `main` ブランチが保護されたまま
- 適切にレビューされたコードのみ（PR 経由でマージ）がリリースされる
- リリースはタグ経由で明示的に作成される

## バージョン番号のガイドライン

[セマンティックバージョニング](https://semver.org/) に従ってください：

- **MAJOR バージョン** (`1.0.0` → `2.0.0`): 破壊的な API 変更
- **MINOR バージョン** (`1.0.0` → `1.1.0`): 新機能、後方互換性あり
- **PATCH バージョン** (`1.0.0` → `1.0.1`): バグ修正、後方互換性あり

**プレリリースバージョン**（例: `1.0.0-beta.1`, `1.0.0-rc.1`）もサポートされています。

## トラブルシューティング

### タグプッシュでワークフローがトリガーされない

- タグ名が `v*.*.*` パターンに一致することを確認
- タグがリモートリポジトリにプッシュされたことを確認: `git ls-remote --tags origin`
- ワークフローファイルが `.github/workflows/release.yml` に存在することを確認

### npm 公開が失敗する

- Actions タブでワークフローログを確認
- npm パッケージに対して Trusted Publishing が設定されていることを確認
- `package.json` のパッケージ名が npm パッケージ名と一致することを確認

### バージョンの不一致

- タグバージョン（例: `v1.0.0`）が `packages/web-serial-rxjs/package.json` のバージョン（例: `1.0.0`）と一致することを確認
- ワークフローはタグからバージョンを抽出します: `VERSION="${GITHUB_REF_NAME#v}"`

### ワークフローでテストが失敗する

- タグ付け前にローカルでテストを実行: `pnpm test`
- すべての依存関係が適切にインストールされていることを確認
- 環境固有の問題を確認

## まとめ

リリースプロセスは簡単です：

1. **バージョンを更新**（必要な場合）PR 経由で `package.json` を更新
2. **`main` にマージ**
3. **タグを作成してプッシュ**: `git tag -a vX.Y.Z -m "Release vX.Y.Z" && git push origin vX.Y.Z`
4. **GitHub Actions が残りを自動的に処理**！

手動の npm publish も複雑なスクリプトも不要 - タグを付けてプッシュするだけ！🚀

## 関連ドキュメント

- [貢献ガイド](CONTRIBUTING.ja.md) - 開発ワークフローと貢献ガイドライン
- [セマンティックバージョニング](https://semver.org/) - バージョン番号のガイドライン

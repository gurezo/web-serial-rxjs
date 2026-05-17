---
name: conventional-commits
description: Generates Conventional Commits messages and pull request titles for web-serial-rxjs (TypeScript + RxJS + Nx monorepo). Trigger when authoring commit messages, PR titles, or release notes, or when reviewing existing commit history for compliance.
---

# Conventional Commits for web-serial-rxjs

このリポジトリ（TypeScript ライブラリ + RxJS + Nx Workspace）向けに、Conventional Commits 準拠の commit message / PR title を生成・検証するための Skill。

## 目的

- commit message と PR title を [Conventional Commits](https://www.conventionalcommits.org/) に統一する。
- `packages/web-serial-rxjs` と `apps/example-*` の構成に整合する scope を選ぶ。
- AI が生成するメッセージの品質を安定化させる。

## 形式

```
<type>(<scope>): <summary>

[optional body]

[optional footer(s)]
```

## 適用ルール

1. **type は小文字** で、許可された値のみを使う (`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`)。
2. **scope は小文字、ハイフン区切り**。`commitlint.config.js` の `scope-enum` または `scopes.md` から選ぶ。
3. **summary は英語、命令形 (imperative mood)**。先頭は小文字、末尾にピリオドを付けない。
4. **summary は 72 文字以内**。
5. **type と変更内容を一致させる**。フォーマット変更のみは `style`、CI 設定は `ci`。
6. **関連性のない変更を 1 つのコミットに混在させない**。
7. **breaking change** は footer に `BREAKING CHANGE: ` を記載する (`type!` 表記は使わない)。

## Nx を踏まえた scope 選択

- ライブラリ本体 (`packages/web-serial-rxjs`) の変更 → `web-serial-rxjs`。
- 各 example アプリの変更 → 対応する `example-*` scope。
- ルート設定・複数 project に跨る変更 → `workspace`。
- ドキュメント全般 → `docs` / `readme`。
- GitHub Actions → `ci`。
- 依存・ビルド設定 → `build` / `chore` / `deps`。

詳細は `scopes.md` と `.cursor/rules/nx/30-nx-project-scope.mdc` を参照。

## docs / ci / build / chore の使い分け

| 種別 | type | 例 |
| --- | --- | --- |
| README / CONTRIBUTING 等のドキュメント | `docs` | `docs(workspace): update readme quick start` |
| GitHub Actions ワークフロー追加・変更 | `ci` | `ci(workspace): update npm publish workflow` |
| 依存追加・更新、ビルド設定 | `build` | `build(workspace): bump nx dependency` |
| 上記に当てはまらない雑務 | `chore` | `chore(workspace): remove unused script` |

## 参照ファイル

- [`examples.md`](examples.md): 良い例と悪い例
- [`assertions.md`](assertions.md): 検証項目と Valid / Invalid サンプル
- [`scopes.md`](scopes.md): scope 一覧と用途
- リポジトリ側: `.cursor/rules/commits/`, `commitlint.config.js`, `CONTRIBUTING.md`

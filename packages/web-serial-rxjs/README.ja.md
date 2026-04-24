# web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS API でラップする TypeScript ライブラリです。v2 では単一の `SerialSession` を公開し、アプリケーション側は `state$` / `receive$` / `errors$` を購読するだけで UI を駆動できます。BehaviorSubject による状態再構築・read loop・送信キューの自前実装は一切不要です。

## 目次

- [機能](#機能)
- [対応フレームワーク](#対応フレームワーク)
- [ブラウザサポート](#ブラウザサポート)
- [インストール](#インストール)
- [ドキュメント](#ドキュメント)
- [サンプル](#サンプル)
- [プロジェクトアイコンについて](#プロジェクトアイコンについて)
- [開発とリリース戦略](#開発とリリース戦略)
- [貢献](#貢献)
- [ライセンス](#ライセンス)
- [リンク](#リンク)

## 機能

- **Session 指向のリアクティブ API**: 1 つの `SerialSession` が `state$` / `receive$` / `errors$` と `connect$` / `disconnect$` / `send$` を公開
- **UTF-8 テキストストリーム**: `receive$` は内部でストリーミング `TextDecoder` を用いてデコード済み。マルチバイト文字がチャンクにまたがっても正しく結合されます
- **順序保証された送信キュー**: 並行する `send$` 呼び出しも内部キューで FIFO 処理され、呼び出し順に書き込まれます
- **統一エラーチャネル**: すべての I/O エラーは `SerialError` に正規化され `errors$` に多重化されます
- **明示的なライフサイクル**: `state$` は `idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` を emit するので UI から直接駆動できます
- **TypeScript サポート**: 完全な TypeScript 型定義を同梱
- **フレームワーク非依存**: 任意の JavaScript/TypeScript フレームワークまたはバニラ JavaScript で利用可能

## 対応フレームワーク

このライブラリはフレームワーク非依存で、以下の環境で利用できます。

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## ブラウザサポート

Web Serial API は現在、Chromium ベースのブラウザでのみサポートされています：

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

`connect$` を呼ぶ前の feature detection には `SerialSession.isBrowserSupported()` が使えます（同期的に `boolean` を返します）。

## インストール

npm または pnpm を使用してパッケージをインストールします：

```bash
npm install @gurezo/web-serial-rxjs
# または
pnpm add @gurezo/web-serial-rxjs
```

### ピア依存関係

このライブラリは RxJS をピア依存関係として必要とします：

```bash
npm install rxjs
# または
pnpm add rxjs
```

**最小要件バージョン**: RxJS ^7.8.0

## ドキュメント

- **[クイックスタート](docs/QUICK_START.ja.md)** - 基本的な例と使用方法で始める
- **[API リファレンス](docs/API_REFERENCE.ja.md)** - 詳細な説明を含む完全な API ドキュメント
- **[高度な使用方法](docs/ADVANCED_USAGE.ja.md)** - 高度なパターン、ストリーム処理、エラー回復
- **[v1 → v2 マイグレーションガイド](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.ja.md)** - 削除された `SerialClient` / `ShellClient` から v2 `SerialSession` への対応表

## サンプル

以下の環境向けのサンプルを用意しています。

- **[Angular](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular)** - Service を使用した Angular の例
- **[React](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-react)** - カスタムフック（`useSerialClient`）を使用した React の例
- **[Svelte](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-svelte)** - Svelte Store を使用した Svelte の例
- **[Vanilla JavaScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-js)** - バニラ JavaScript での基本的な使用方法
- **[Vanilla TypeScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-ts)** - RxJS を使用した TypeScript の例
- **[Vue](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vue)** - Composition API を使用した Vue 3 の例

各例には、セットアップと使用方法の説明を含む README が含まれています。

## プロジェクトアイコンについて

このプロジェクトのアイコンには、[RxJS](https://rxjs.dev/) のロゴから着想を得たデザインに、
Web Serial を表すシリアルコネクタのモチーフを組み合わせたものを使用しています。

このアイコンは、本ライブラリが Web Serial API を RxJS ベースで扱うための
ライブラリであることを示す目的でのみ使用しています。

本プロジェクトは **[ReactiveX](http://reactivex.io/) / [RxJS](https://rxjs.dev/) 公式とは関係のない独立したオープンソースプロジェクト** であり、
公式な提携・承認・スポンサー関係はありません。

## 開発とリリース戦略

このプロジェクトは**trunk-based開発**アプローチに従います：

- **`main`ブランチ**: 常にリリース可能な状態
- **短命ブランチ**: `feature/*`, `fix/*`, `docs/*` はプルリクエスト用
- **リリース**: ブランチではなくGitタグ（例: `v1.0.0`）で管理
- **バージョン保守**: 複数のメジャーバージョンを保守する必要がある場合のみ `release/v*` ブランチを追加

詳細な貢献ガイドラインについては、[CONTRIBUTING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md) を参照してください。

詳細なリリース手順については、[RELEASING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.ja.md) を参照してください。

## 貢献

貢献を歓迎します！詳細については、[貢献ガイド](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md)を参照してください：

- 開発環境のセットアップ
- コードスタイルガイドライン
- コミットメッセージの規約
- プルリクエストのプロセス
- リリースプロセス

英語版の貢献ガイドは [CONTRIBUTING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md) を参照してください。

リリース手順については、[RELEASING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.ja.md)（または英語版は [RELEASING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.md)）を参照してください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) ファイルを参照してください。

## リンク

- **GitHub リポジトリ**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

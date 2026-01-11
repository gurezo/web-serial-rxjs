# web-serial-rxjs

Web Serial API を RxJS ベースのリアクティブなラッパーで提供する TypeScript ライブラリです。Web アプリケーションでシリアルポート通信を簡単に実現できます。

## 目次

- [機能](#機能)
- [ブラウザサポート](#ブラウザサポート)
- [インストール](#インストール)
- [ドキュメント](#ドキュメント)
- [フレームワーク別の例](#フレームワーク別の例)
- [貢献](#貢献)
- [ライセンス](#ライセンス)
- [リンク](#リンク)

## 機能

- **RxJS ベースのリアクティブ API**: RxJS Observables を活用したリアクティブなシリアルポート通信
- **TypeScript サポート**: 完全な TypeScript 型定義を含む
- **ブラウザ検出**: ブラウザサポートの検出とエラーハンドリング機能を内蔵
- **エラーハンドリング**: カスタムエラークラスとエラーコードによる包括的なエラーハンドリング
- **フレームワーク非依存**: 任意の JavaScript/TypeScript フレームワークまたはバニラ JavaScript で使用可能

## ブラウザサポート

Web Serial API は現在、Chromium ベースのブラウザでのみサポートされています：

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

このライブラリには、使用前に Web Serial API のサポートを確認するためのブラウザ検出ユーティリティが含まれています。

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

- **[クイックスタート](docs/QUICK_START.ja.md)** - 基本的な例と使用方法のパターンで始める
- **[API リファレンス](docs/API_REFERENCE.ja.md)** - 詳細な説明を含む完全な API ドキュメント
- **[高度な使用方法](docs/ADVANCED_USAGE.ja.md)** - 高度なパターン、ストリーム処理、エラー回復

## フレームワーク別の例

このリポジトリには、さまざまなフレームワークで web-serial-rxjs を使用する方法を示すサンプルアプリケーションが含まれています：

- **[Vanilla JavaScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-js)** - バニラ JavaScript での基本的な使用方法
- **[Vanilla TypeScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-ts)** - RxJS を使用した TypeScript の例
- **[React](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-react)** - カスタムフック（`useSerialClient`）を使用した React の例
- **[Vue](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vue)** - Composition API を使用した Vue 3 の例
- **[Svelte](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-svelte)** - Svelte Store を使用した Svelte の例
- **[Angular](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular)** - Service を使用した Angular の例

各例には、セットアップと使用方法の説明を含む README が含まれています。

## 貢献

貢献を歓迎します！詳細については、[貢献ガイド](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md)を参照してください：

- 開発環境のセットアップ
- コードスタイルガイドライン
- コミットメッセージの規約
- プルリクエストのプロセス

英語版の貢献ガイドは [CONTRIBUTING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md) を参照してください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) ファイルを参照してください。

## リンク

- **GitHub リポジトリ**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

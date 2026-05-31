# web-serial-rxjs

<p align="center">
  <img src="./assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS API でラップする TypeScript ライブラリです。v2 では単一の `SerialSession` を公開し、アプリケーション側は `state$` / `isConnected$` / `receive$` / `lines$` / `errors$` を購読するだけで UI を駆動できます。BehaviorSubject による状態再構築・read loop・送信キューの自前実装は一切不要です。

## 目次

- [SerialSession（v2）の全体像](#serialsessionv2の全体像)
- [機能](#機能)
- [対応フレームワーク](#対応フレームワーク)
- [ブラウザサポート](#ブラウザサポート)
- [インストール](#インストール)
- [ドキュメント](#ドキュメント)
- [サンプル](#サンプル)
- [プロジェクトアイコンについて](#プロジェクトアイコンについて)
- [貢献](#貢献)
- [ライセンス](#ライセンス)
- [リンク](#リンク)

## 機能

- **Session 指向のリアクティブ API**: 1 つの `SerialSession` が `state$` / `isConnected$` / `receive$` / `lines$` / `errors$` と `connect$` / `disconnect$` / `send$` を公開
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

Web Serial API は**デスクトップ**ブラウザでのみサポートされています。スマートフォンなどのモバイルブラウザには対応していません。

対応しているデスクトップブラウザ：

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** は現時点で Web Serial API をサポートしていません。

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

## SerialSession（v2）の全体像

機能一覧と **`SerialSession` 早見表**、**`SerialSessionState` 表**、**最小サンプル**の正本は次のパッケージドキュメントにあります。

- **[SerialSession（v2）の概要](packages/web-serial-rxjs/docs/OVERVIEW.ja.md)**（[English](packages/web-serial-rxjs/docs/OVERVIEW.md)）

npm の [`@gurezo/web-serial-rxjs` README](packages/web-serial-rxjs/README.ja.md) は短い目次に留め、初回接続の手順は [クイックスタート](packages/web-serial-rxjs/docs/QUICK_START.ja.md) を参照してください。

**`receive$`** と **`lines$`** をいつ使うか（ターミナル表示・バッファと、改行区切りログ・解析の違い）は [パッケージ README](packages/web-serial-rxjs/README.ja.md) の「`receive$` と `lines$`」にまとめています。

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| **この README** | モノレポのハブ：機能要約、サンプル、貢献導線。 |
| **[SerialSession（v2）の概要](packages/web-serial-rxjs/docs/OVERVIEW.ja.md)** | 公開面・`SerialSessionState` 早見、最小サンプル。 |
| **[クイックスタート](packages/web-serial-rxjs/docs/QUICK_START.ja.md)** | 最短でポートを開いて購読するところまで。 |
| **[高度な使用方法](packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)** | 行フレーミング、擬似リクエスト／レスポンス、リカバリ。 |
| **[API リファレンス](packages/web-serial-rxjs/docs/API_REFERENCE.ja.md)** | オプション、`SerialSessionState`、`SerialError` の詳細。 |
| **[v1 → v2 マイグレーション](packages/web-serial-rxjs/docs/MIGRATION_V2.ja.md)** | 削除された v1 API からの対応表。 |

## サンプル

以下の環境向けのサンプルを用意しています。

- **[Angular](apps/example-angular/)** - Service を使用した Angular の例
- **[React](apps/example-react/)** - カスタムフック（`useSerialSession`）を使用した React の例
- **[Svelte](apps/example-svelte/)** - Svelte Store を使用した Svelte の例
- **[Vanilla JavaScript](apps/example-vanilla-js/)** - バニラ JavaScript での基本的な使用方法
- **[Vanilla TypeScript](apps/example-vanilla-ts/)** - RxJS を使用した TypeScript の例
- **[Vue](apps/example-vue/)** - Composition API を使用した Vue 3 の例

各サンプルは **connect・受信（ターミナル表示は `\r` を保持するため `receive$` で連結）・send・disconnect** の最小動作確認用です。**`lines$`** は改行区切りログや解析向けであり、対話的シェル出力のミラーには **`receive$`** を使ってください。行フレーミングや応用パターンの詳細は [高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md) に集約しています。

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

詳細な貢献ガイドラインについては、[CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) を参照してください。

詳細なリリース手順については、[RELEASING.ja.md](RELEASING.ja.md) を参照してください。

## 貢献

貢献を歓迎します！詳細については、[貢献ガイド](CONTRIBUTING.ja.md)を参照してください：

- 開発環境のセットアップ
- コードスタイルガイドライン
- コミットメッセージの規約
- プルリクエストのプロセス
- リリースプロセス

英語版の貢献ガイドは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

リリース手順については、[RELEASING.ja.md](RELEASING.ja.md)（または英語版は [RELEASING.md](RELEASING.md)）を参照してください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## リンク

- **GitHub リポジトリ**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

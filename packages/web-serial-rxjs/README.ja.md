<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS API でラップする TypeScript ライブラリです。v2 では単一の `SerialSession` を公開し、アプリケーション側は `state$` / `receive$` / `errors$` を購読するだけで UI を駆動できます。BehaviorSubject による状態再構築・read loop・送信キューの自前実装は一切不要です。

## 目次

- [SerialSession（v2）の全体像](#serialsessionv2の全体像)
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

## SerialSession（v2）の全体像

`createSerialSession` が返す **SerialSession** だけを使います。公開 API は意図的に小さく、行区切りや「接続中」真偽値などは `state$` / `receive$` の上に RxJS で組み立てます（[高度な使用方法](docs/ADVANCED_USAGE.ja.md)）。

| 公開面 | 役割 |
| --- | --- |
| `state$` | **接続ライフサイクル** — `idle` / `connecting` / `connected` / `disconnecting` / `error` / `unsupported`。購読時に現在値をリプレイ。 |
| `receive$` | **受信 UTF-8 テキスト**（デコード済みの**チャンク**列。行区切りではない。マルチバイト安全）。 |
| `errors$` | **すべての `SerialError`**（接続・読み取り・書き込み・クローズ）の主チャネル。 |
| `connect$()` | ポート選択 → オープン → 内部 read pump 開始。 |
| `disconnect$()` | ポートを閉じ、pump を停止。 |
| `send$(string \| Uint8Array)` | 送信を **FIFO** で直列化（並行 `send$` も呼び出し順）。 |
| `isBrowserSupported()` | `connect$` の前に使う、Web Serial 利用可否の同期的な `boolean`。 |

**`connected$`（UI 用）** — `SerialSession` のプロパティではありません。真偽の `Observable` が欲しい場合は `state$` から派生します。

```typescript
import { map } from 'rxjs';

const connected$ = session.state$.pipe(map((s) => s === 'connected'));
```

**行単位の `lines$`** — ビルトインではありません。`receive$` の上にフレーミングします（[行単位のフレーミング](docs/ADVANCED_USAGE.ja.md#行単位のフレーミング)）。

### 最小サンプル

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  throw new Error('このブラウザでは Web Serial を利用できません');
}

session.receive$.subscribe(console.log);
session.errors$.subscribe(console.error);
session.connect$().subscribe();
session.send$('hello\r\n').subscribe();
```

実アプリでは `connect$` / `send$` の `subscribe` で `error` も扱ってください（`errors$` にも流れます）。手順の全体は [クイックスタート](docs/QUICK_START.ja.md) を参照してください。

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポ全体の目次、サンプル索引、貢献の導線。 |
| **[クイックスタート](docs/QUICK_START.ja.md)** | 最短でポートを開いて購読するところまで。 |
| **[高度な使用方法](docs/ADVANCED_USAGE.ja.md)** | 行フレーミング、擬似リクエスト／レスポンス、リカバリ。 |
| **[API リファレンス](docs/API_REFERENCE.ja.md)** | オプション、`SerialSessionState`、`SerialError` の詳細。 |
| **[v1 → v2 マイグレーション](docs/MIGRATION_V2.ja.md)**（[English](docs/MIGRATION_V2.md)） | 削除された v1 API からの対応表。 |
| **[Phase 5（アーカイブ）](docs/archive/MIGRATION_PHASE5.ja.md)** | 旧 v1 ドキュメントの参照用。 |

## サンプル

以下の環境向けのサンプルを用意しています。

- **[Angular](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular)** - Service を使用した Angular の例
- **[React](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-react)** - カスタムフック（`useSerialSession`）を使用した React の例
- **[Svelte](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-svelte)** - Svelte Store を使用した Svelte の例
- **[Vanilla JavaScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-js)** - バニラ JavaScript での基本的な使用方法
- **[Vanilla TypeScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-ts)** - RxJS を使用した TypeScript の例
- **[Vue](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vue)** - Composition API を使用した Vue 3 の例

各サンプルは **connect・受信（`receive$` から派生した行区切り）・send・disconnect** の最小動作確認用です。応用は [高度な使用方法](docs/ADVANCED_USAGE.ja.md) を参照してください。

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

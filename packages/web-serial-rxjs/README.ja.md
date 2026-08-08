# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS 表面でラップする TypeScript ライブラリです。公開 API は単一の `SerialSession` を提供し、`state$`（canonical lifecycle state）/ `errors$`（error event channel）/ `receive$` / `lines$` を購読するだけで UI を駆動できます。read loop や送信キューの自前実装は不要です。

**主対象は UTF-8 テキスト通信です。** 受信データは常にストリーミング UTF-8 `TextDecoder` でデコードされます。`receive$` が返すのは**デコード済みテキストチャンク**（行未分割）であり、ワイヤ上の生バイトではありません。バイナリ**送信**（`send$(Uint8Array)`）は対応しますが、バイナリ**受信**・UTF-8 以外の文字コード・プロトコルフレーミング（Modbus / COBS / SLIP など）は対象外です。詳細は下記の [対応範囲](#対応範囲テキスト--バイナリ--文字コード) と [API の概念](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/concepts.md#対応範囲テキスト--バイナリ--文字コード) を参照してください。

## ブラウザサポート

この節では、**Web Serial API の実装状況**（ブラウザが提供するもの）と、本プロジェクトの**公式サポート方針**（動作確認・保証の範囲）を分けて記載します。

### Web Serial API の実装状況

`navigator.serial` が存在する環境では、本ライブラリは Web Serial API を利用できます。デスクトップでの典型的な対応は次のとおりです。

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** は現時点で Web Serial API を**実装していません**。多くの**モバイル**ブラウザにも `navigator.serial` がなく、API が無い場合は `isWebSerialSupported()` が `false` を返します。

### プロジェクトの公式サポート方針

**公式サポート**の対象は、上記のデスクトップブラウザ（Chrome 89+、Edge 89+、Opera 75+、Firefox 151+）です。

**モバイル**ブラウザは**未検証**であり、**公式サポート対象外**です。未検証は「ライブラリが拒否する」ことと同一ではありません。モバイルで Web Serial が公開され、セキュアコンテキストであれば feature detection が成功する場合もありますが、動作は保証しません。

### `isWebSerialSupported()`

`connect$` の前の **feature detection**（`navigator.serial` の有無）には `isWebSerialSupported()`（同期的に `boolean`）を使います。これは**互換性や公式サポートの保証ではありません**。セキュアコンテキスト（HTTPS または localhost）は別条件です。

## 接続状態（ライフサイクル UI）

ライフサイクル UI には **`state$`** の `state.status` narrowing を canonical API として使用してください。boolean だけ必要な場合は `state$` から derive してください。セッション破棄には **`dispose$()`** を使用します（購読により実行されます）。詳細は [v4 への移行](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/migration-v4.md) を参照してください。

## 接続中のポート情報（デバイス識別）

`connect$` 成功後、`state$` を `state.status === SerialSessionStatus.Connected` で handling する場合は **`state.portInfo`** を canonical API として使用してください。生の `SerialPort` は公開しません。削除された convenience API（`isConnected$`、`portInfo$`、`getPortInfo()`、`destroy$()`、`getCurrentPort()`、`receiveReplay$`、`isBrowserSupported()`）と置換先は [v4 への移行](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/migration-v4.md) を参照してください。

## 対応範囲（テキスト / バイナリ / 文字コード）

| 項目 | 現在の対応 |
| --- | --- |
| UTF-8 テキスト送受信 | 対応 |
| チャンク単位の文字列受信 | `receive$`（デコード済みチャンク。生バイトではない） |
| 改行区切りの文字列受信 | `lines$` |
| `\r` を含むターミナル表示 | `receive$` / `terminalText$` |
| バイナリ送信 | `send$(Uint8Array)` で対応 |
| バイナリ受信 | **非対応**（生 `Uint8Array` 受信ストリームなし） |
| UTF-8 以外の文字コード | **非対応** |
| 特定プロトコル（Modbus / COBS / SLIP など） | **利用側で実装** |

詳細と将来検討時の設計論点: [API の概念 — 対応範囲](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/concepts.md#対応範囲テキスト--バイナリ--文字コード)。

## `receive$` と `lines$`

購読するストリームはユースケースに合わせて選んでください。**`lines$`** をターミナル表示に使うと `\r` が失われ再描画できず、シェル出力（例: `ls -la` の整形）が崩れます。詳細は [概要](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/overview.md) を参照してください。

### `receive$`（デコード済みチャンク）

- UTF-8 の**デコードチャンク**をそのまま届く順に（行揃えではありません）。**ワイヤ上の生バイトではありません**。
- デコード後のテキストとして `\r` や行途中の断片など制御文字も保持します。
- **ターミナル表示**、**プロンプト判定**、自前の**バッファ**/スクロールバック、未フレーミングのデコードストリーム処理に使います。

### `lines$`（行単位のイベント）

- **完了した行**だけを emit（`\n` / `\r\n` / 実装どおり内部の `\r`）。
- **ログ出力**、**行単位の解析**、改行フレームのプロトコル向き。
- 対話 CLI の**画面ミラーには不向き**です（`\r` での上書き表示の意味が落ちます）。

### 避ける／推奨する書き方

画面にそのまま足していく用途で **`lines$`** の文字列を連結すると、再描画情報が欠けレイアウトが崩れます。**避けてください**。

```ts
session.lines$.subscribe((line) => {
  output += line + '\n';
});
```

ミラーやシェル風バッファには **`receive$`** のチャンクを連結します。**推奨**です。

```ts
session.receive$.subscribe((chunk) => {
  output += chunk;
});
```

## インストール

```bash
npm install @gurezo/web-serial-rxjs
# または
pnpm add @gurezo/web-serial-rxjs
```

### ピア依存関係

**RxJS** `^7.8.0` をピア依存関係として必要とします。

```bash
npm install rxjs
# または
pnpm add rxjs
```

## 次に読むもの

- **API の全体像**（機能一覧、`SerialSession` 早見表、`SerialSessionState`、最小サンプル）: [SerialSession の概要](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/overview.md)（[English](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md)）
- 最短でポートを開く手順: [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/quick-start.md)
- よくある問題と自己解決: [トラブルシューティング](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/troubleshooting.md)
- 公開ドキュメントサイト: [web-serial-rxjs Documentation](https://gurezo.net/web-serial-rxjs/)
- API Reference（TypeDoc）: [web-serial-rxjs API Documentation](https://gurezo.net/web-serial-rxjs/api/)

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| [ドキュメントホーム](https://gurezo.net/web-serial-rxjs/) | Guide（ja/en）と API Reference へのサイトランディング |
| [日本語 Guide（公開サイト）](https://gurezo.net/web-serial-rxjs/guide/ja/README.html) | Getting Started の読み順と一覧（公開サイト） |
| [API Reference（公開サイト）](https://gurezo.net/web-serial-rxjs/api/index.html) | 英語 TypeDoc API Reference |
| [日本語 Guide 索引](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/README.md) | Getting Started の読み順と一覧 |
| [English Guide 索引](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/README.md) | Getting Started reading order and full index |
| [全体像](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/overview.md) | 機能と `SerialSession` / `SerialSessionState` の対応表 |
| [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/quick-start.md) | ポートを開いて購読までを最短で |
| [高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/advanced-usage.md) | 行フレーミング、擬似リクエスト/レス、リカバリ |
| [トラブルシューティング](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/troubleshooting.md) | Web Serial / セッションのよくある問題と自己解決手順 |
| [API の概念と設計メモ](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/concepts.md) | オプション、`SerialError`、型の表形式補足 |
| [v3 → v4 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/migration-v4.md) | Phase 1+2 の削除（`receiveReplay$`、`isBrowserSupported()`、オプション整理） |
| [v2 → v3 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/migration-v3.md) | `state$` discriminated union、`SerialSessionStatus`、`context.cause` |
| [v1 → v2 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/migration-v2.md) | 廃止された v1 API の置き換え |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポのハブ：**`apps/` のサンプル**、貢献入口、開発ツール案内 |
| **[CONTRIBUTING](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md#5-ai-アシスタントmcp--任意)** | リポジトリ貢献者向けの MCP / Cursor 設定 |

## ライセンス

MIT。詳細はリポジトリの [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) を参照してください。

## リンク

- **リポジトリ**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [wicg.github.io/serial](https://wicg.github.io/serial/)

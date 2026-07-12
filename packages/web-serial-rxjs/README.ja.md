# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS 表面でラップする TypeScript ライブラリです。公開 API は単一の `SerialSession` を提供し、`state$`（canonical lifecycle state）/ `errors$`（error event channel）/ `receive$` / `lines$` を購読するだけで UI を駆動できます。read loop や送信キューの自前実装は不要です。

## ブラウザサポート

Web Serial API は**デスクトップ**ブラウザでのみサポートされています。スマートフォンなどのモバイルブラウザには対応していません。

対応しているデスクトップブラウザ：

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** は現時点で Web Serial API をサポートしていません。

`connect$` の前の feature detection には `SerialSession.isBrowserSupported()`（同期的に `boolean`）を使います。

## 接続中のポート情報（デバイス識別）

`connect$` 成功後、`state$` を `state.status === SerialSessionStatus.Connected` で handling する場合は **`state.portInfo`** を canonical API として使用してください。`getPortInfo()` と `portInfo$` は v3.x では引き続き利用可能ですが **非推奨** です。`state$` の narrowing へ移行してください。`getCurrentPort()` は接続中のみ内部の `SerialPort` を返します。`close()` は直接呼ばず、ライフサイクルは `disconnect$` に任せてください。

## 受信の replay（`receive$` と `receiveReplay$`）

`receive$` は **non-replay** のままです。購読後に届くチャンクだけが見えます。接続ごとに直近 *N* 件のデコード済みテキスト**チャンク**（read pump の 1 回の `onChunk` あたり 1 件。文字数ではありません）を遅延購読者にも渡したい場合は、`createSerialSession` に `receiveReplay: { enabled: true, bufferSize: 512 }` を指定し、`receiveReplay$` を購読します。`bufferSize` は 1〜65536 の正の safe integer である必要があります。任意の `maxChars` で保持チャンク全体の文字数上限を指定でき、超過時は古いチャンクから破棄し non-fatal の `RECEIVE_REPLAY_BUFFER_OVERFLOW` を `errors$` に emit します。`bufferSize` やチャンクサイズを大きくするとメモリ負荷が増えます。receive replay が **無効**（既定）のとき、`receiveReplay$` は `receive$` と同じ hot ストリームです。`lines$` の行分割に replay は付きません。生チャンクの `receiveReplay$` のみが対象です。

## `receive$` と `lines$`

購読するストリームはユースケースに合わせて選んでください。**`lines$`** をターミナル表示に使うと `\r` が失われ再描画できず、シェル出力（例: `ls -la` の整形）が崩れます。詳細は [概要](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md) を参照してください。

### `receive$`（raw ストリーム）

- UTF-8 の**デコードチャンク**をそのまま届く順に（行揃えではありません）。
- `\r` や行途中の断片など制御文字も保持します。
- **ターミナル表示**、**プロンプト判定**、自前の**バッファ**/スクロールバック、raw を前提にした処理に使います。

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

- **API の全体像**（機能一覧、`SerialSession` 早見表、`SerialSessionState`、最小サンプル）: [SerialSession の概要](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md)（[English](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.md)）
- 最短でポートを開く手順: [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md)

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| [全体像](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md) | 機能と `SerialSession` / `SerialSessionState` の対応表 |
| [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md) | ポートを開いて購読までを最短で |
| [高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md) | 行フレーミング、擬似リクエスト/レス、リカバリ |
| [API リファレンス](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.ja.md) | オプション、`SerialError`、型の詳細 |
| [v2 → v3 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V3.ja.md) | `state$` discriminated union、`SerialSessionStatus`、`context.cause` |
| [v1 → v2 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.ja.md) | 廃止された v1 API の置き換え |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポ構成、**`apps/` のサンプル**、貢献、MCP、プロジェクトアイコン |

## ライセンス

MIT。詳細はリポジトリの [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) を参照してください。

## リンク

- **リポジトリ**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [wicg.github.io/serial](https://wicg.github.io/serial/)

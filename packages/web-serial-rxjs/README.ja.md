# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

Web Serial API を最小限の Session 指向 RxJS 表面でラップする TypeScript ライブラリです。v2 では単一の `SerialSession` を公開し、`state$` / `isConnected$` / `receive$` / `lines$` / `errors$` を購読するだけで UI を駆動できます。read loop や送信キューの自前実装は不要です。

## ブラウザサポート

Web Serial API は **Chromium 系**のブラウザ（**Chrome** 89+、**Edge** 89+、**Opera** 75+）でのみ利用できます。

`connect$` の前の feature detection には `SerialSession.isBrowserSupported()`（同期的に `boolean`）を使います。

## 接続中のポート情報（デバイス識別）

`connect$` 成功後は `getPortInfo()` または `portInfo$` で `SerialPort.getInfo()` と同じスナップショット（例: 利用可能な場合の USB ベンダ/プロダクト ID）を取得できます。未接続時は `null` です。`getCurrentPort()` は接続中のみ内部の `SerialPort` を返します。`close()` は直接呼ばず、ライフサイクルは `disconnect$` に任せてください。

## 受信の replay（`receive$` と `receiveReplay$`）

`receive$` は **non-replay** のままです。購読後に届くチャンクだけが見えます。接続ごとに直近 *N* 件のデコード済みテキスト**チャンク**（read pump の 1 回の `onChunk` あたり 1 件。文字数ではありません）を遅延購読者にも渡したい場合は、`createSerialSession` に `receiveReplay: { enabled: true, bufferSize: 512 }` を指定し、`receiveReplay$` を購読します。`bufferSize` を大きくするとメモリ負荷が増えます。receive replay が **無効**（既定）のとき、`receiveReplay$` は `receive$` と同じ hot ストリームです。`lines$` の行分割に replay は付きません。生チャンクの `receiveReplay$` のみが対象です。

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

- **v2 の全体像**（機能一覧、`SerialSession` 早見表、`SerialSessionState`、最小サンプル）: [SerialSession（v2）の概要](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md)（[English](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.md)）
- 最短でポートを開く手順: [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md)

## ドキュメント

| ドキュメント | 用途 |
| --- | --- |
| [全体像](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md) | 機能と v2 `SerialSession` / `SerialSessionState` の対応表 |
| [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md) | ポートを開いて購読までを最短で |
| [高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md) | 行フレーミング、擬似リクエスト/レス、リカバリ |
| [API リファレンス](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.ja.md) | オプション、`SerialError`、型の詳細 |
| [v1 → v2 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.ja.md) | 廃止された v1 API の置き換え |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポ構成、**`apps/` のサンプル**、貢献、MCP、プロジェクトアイコン |

## ライセンス

MIT。詳細はリポジトリの [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) を参照してください。

## リンク

- **リポジトリ**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [wicg.github.io/serial](https://wicg.github.io/serial/)

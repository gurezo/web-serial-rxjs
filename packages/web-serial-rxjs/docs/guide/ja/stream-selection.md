# `receive$` / `lines$` / `terminalText$` の選び方

`SerialSession` は受信側に 3 系統のテキストストリームを公開します。「raw っぽい名前」ではなく、**やりたいこと**から選んでください。本ページは判断用ガイドです。オプション表や正式な契約は [API の概念](./concepts.md) と [TypeDoc API Reference](../../api/modules.html) を参照してください。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#559](https://github.com/gurezo/web-serial-rxjs/issues/559)

## 早見比較表

| やりたいこと | 推奨 |
| --- | --- |
| 改行単位のログを読む | `lines$` |
| JSON Lines を読む | `lines$` |
| 受信チャンクをそのまま扱う | `receive$` |
| `\r` を含む表示制御を扱う | `receive$` または `terminalText$` |
| ターミナル風テキストを画面へ表示する | `terminalText$` |
| raw `Uint8Array`（ワイヤ生バイト）を受信する | **未対応** — [対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード) と [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) を参照 |

## 責務の要約

| ストリーム | 役割 |
| --- | --- |
| `receive$` | read pump からの UTF-8 **デコード済みチャンク**。行揃えではない。`\r` など制御文字を保持。**ワイヤ上の生バイトではない**。 |
| `lines$` | `\n` / `\r\n` / 単独の interior `\r` で区切った**完成行**。ログ、1 行応答、パーサ向け。 |
| `terminalText$` | `receive$` 由来の**表示用**累積テキスト。`\r` 再描画を畳み込み、既定ではプレーンテキスト UI 向けに ANSI を除去。`createTerminalBuffer(receive$).text$` と同等。 |

3 つとも同じ `connect$` の read pump から駆動されます。**subscription-lazy ではありません**。遅れて購読した consumer は新しいデータのみを受け取ります（`terminalText$` は購読後に共有された累積表示を受け取ります）。

## チャンク境界に依存しない

`receive$` の emit 単位は、ブラウザの `ReadableStream` の読み取りサイズとストリーミング `TextDecoder` に従います。**プロトコル上のメッセージ境界ではありません**。

- 論理的な 1 行が、複数の `receive$` チャンクに分かれて届くことがある
- 1 つの `receive$` チャンクに、複数の完成行が含まれることがある（完成行は `lines$` にも流れる）
- 「1 チャンク == 1 コマンド応答」とみなさない。必要なら `receive$` 上で独自フレーミングを組む

組み込み行バッファ以外の区切りが必要なときは `receive$` 上で合成してください — [高度な使用方法 — 行単位のフレーミング](./advanced-usage.md#行単位のフレーミング組み込み-lines-と-receive-上のカスタム分割)。

## `lines$` を使うとき

機器が**改行区切り**のテキストプロトコルのときは **`lines$`** を使います。

- ログ行・ステータス行
- JSON Lines（`\n` 区切りの JSON）
- `\n` / `\r\n` で終わるコマンド応答（例: `OK`）

終端がまだ来ていない不完全 tail は内部バッファに残り、行が完成するまで **emit されません**。不完全 tail は `SerialSessionOptions.lineBuffer`（既定 `maxChars: 1_048_576`）で上限があります。超過時は先頭を破棄し、切断せず non-fatal の `LINE_BUFFER_OVERFLOW` を `errors$` に流します。

`\r` による再描画を保ちたいターミナル UI に **`lines$` を繋がないでください**。行バッファが interior `\r` を境界として扱い、プログレスやシェル出力が壊れることがあります。

## `receive$` を使うとき

**未フレーミングのデコード済みテキスト**が必要なときは **`receive$`** を使います。

- カスタムフレーミング（非改行区切り、正規表現分割、バッチ化）
- **末尾改行のない**プロンプト／終端
- ピアが送った `\r` などをそのまま観察する
- 独自のターミナルパイプラインを組む（または自分で `createTerminalBuffer` に渡す）

ドキュメントや JSDoc で言う **`receive$` の「raw」は、未フレーミングのデコード済みテキストチャンク**を指します。ワイヤ上の生バイトでも、`Uint8Array` ストリームでもありません。[`receive$` における「raw」の意味](./concepts.md#receive-におけるrawの意味) を参照してください。

## `terminalText$` を使うとき

ターミナル風ビューポート（`<textarea>`、ログパネルなど）へ**1 本の文字列**をバインドしたいときは **`terminalText$`** を使います。

- `\r` による再描画を畳み込みつつ、通常の改行挙動は維持する
- 既定では ANSI エスケープを除去（`stripAnsi: true`）。表示ストリームにエスケープを残す場合は `SerialSessionOptions.terminalBuffer.stripAnsi` を `false` にする
- `terminalBuffer` で上限（`maxLines` / `maxChars`。既定は 10,000 行・1,048,576 文字）

表示バインドには `terminalText$` を優先します。装飾前のチャンク列（生のエスケープ、独自の畳み込み、非表示コンシューマ）が必要なときは `receive$` を使います。

## バイナリ受信は未対応

公開の `receiveBytes$` や `Uint8Array` 受信ストリームは**ありません**。read pump は常にストリーミング UTF-8 `TextDecoder` でデコードします。

- **バイナリ送信**は `send$(Uint8Array)` で対応
- **バイナリ受信**は未対応 — バイナリについては送受信が非対称

現行の制限と設計メモ: [対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード)。将来のバイナリ受信設計: [#545](https://github.com/gurezo/web-serial-rxjs/issues/545)。

## 関連ガイド

- [SerialSession の概要](./overview.md#serialsessionの全体像) — 公開面の地図
- [クイックスタート](./quick-start.md) — `lines$` での最短経路
- [高度な使用方法](./advanced-usage.md) — `receive$` 上のカスタムフレーミング
- [Request / Response レシピ](./request-response.md) — `lines$` / `receive$` で待ってから送信
- [タイムアウト・キャンセル・再試行](./timeout-cancel-retry.md) — 待ちの期限
- [API の概念 — 対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード) — テキスト / バイナリ / 文字コードの範囲

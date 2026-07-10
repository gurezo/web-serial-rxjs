# API リファレンス

v2 の公開 API は、1 つのファクトリ（`createSerialSession`）、1 つのランタイムインターフェイス（`SerialSession`）、1 つの options 型、1 つの状態ユニオン、2 つのエラー型のみで構成されます。

## 公開 export

```typescript
import {
  createSerialSession,
  createTerminalBuffer,
  DEFAULT_TERMINAL_BUFFER_OPTIONS,
  SerialError,
  SerialErrorCode,
  SerialSessionState,
  type SerialSession,
  type SerialSessionOptions,
  type SerialSessionReceiveReplayOptions,
  type TerminalBufferOptions,
} from '@gurezo/web-serial-rxjs';
```

## createSerialSession(options?)

`SerialSession` を返すファクトリ。`navigator.serial` が存在しない環境でも安全に呼び出せます。その場合 `state$` の初期値は `'unsupported'` となり、`connect$` は `SerialErrorCode.BROWSER_NOT_SUPPORTED` で失敗します。

### シグネチャ

```typescript
function createSerialSession(options?: SerialSessionOptions): SerialSession;
```

## SerialSessionOptions

| フィールド    | 型                                  | 既定値    | 説明                                                                         |
| ------------- | ----------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `baudRate`    | `number`                            | `9600`    | ボーレート（bps）                                                            |
| `dataBits`    | `7 \| 8`                            | `8`       | データビット                                                                 |
| `stopBits`    | `1 \| 2`                            | `1`       | ストップビット                                                               |
| `parity`      | `'none' \| 'even' \| 'odd'`         | `'none'`  | パリティ                                                                     |
| `bufferSize`  | `number`                            | `255`     | リードストリームのバッファサイズ（バイト）                                   |
| `flowControl` | `'none' \| 'hardware'`              | `'none'`  | フロー制御                                                                   |
| `filters`     | `SerialPortFilter[]` \| `undefined` | —         | ポート選択ダイアログに渡される `navigator.serial.requestPort` 用フィルタ     |
| `receiveReplay` | `SerialSessionReceiveReplayOptions` | `{ enabled: false, bufferSize: 512 }` | 受信チャンクの接続単位 replay。`receiveReplay$` を参照。 |
| `terminalBuffer` | `TerminalBufferOptions` | `{ maxLines: 10000, maxChars: 1048576 }` | `terminalText$` のメモリ上限。`createTerminalBuffer` を参照。 |
| `lineBuffer` | `LineBufferOptions` | `{ maxChars: 1048576 }` | `lines$` の未完成行 tail のメモリ上限。下記を参照。 |

### `SerialSessionReceiveReplayOptions`

| フィールド   | 型        | 既定値   | 説明 |
| ------------ | --------- | -------- | ---- |
| `enabled`    | `boolean` | `false`  | `true` のとき、現在の接続について `receiveReplay$` が直近 N **チャンク**をリプレイする。`false` のとき `receiveReplay$` は `receive$` と同じ hot ストリーム。 |
| `bufferSize` | `number`  | `512`    | 接続中に保持するテキストチャンク数の上限。文字数・バイト数ではない。 |

### `TerminalBufferOptions`

`createTerminalBuffer` と `SerialSessionOptions.terminalBuffer` で使います。上限を超えたときは、**古い**完了行や先頭の文字から破棄し、長時間のターミナル表示でメモリが際限なく増えないようにします。`0` を指定するとその制限を無効化します。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxLines`   | `number`  | `10000`    | 累積表示テキストに保持する完了行数の上限。 |
| `maxChars`   | `number`  | `1048576`  | 表示テキスト全体（完了部分 + 編集中行）の文字数上限。 |

### `LineBufferOptions`

`SerialSessionOptions.lineBuffer` で `lines$` の**未完成行 tail**（改行未到達の保持データ）の上限を指定します。`maxChars` を超えたときは tail の**先頭**文字から破棄し、non-fatal の `SerialErrorCode.LINE_BUFFER_OVERFLOW` を `errors$` に emit します（セッションは切断されません）。完了した行は trim 前にそのまま emit されます。`0` で制限を無効化します。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxChars`   | `number`  | `1048576`  | 未完成行 tail に保持する最大文字数。 |

## createTerminalBuffer(receive$, options?)

デコード済みチャンクの `Observable<string>`（通常は `SerialSession.receive$`）から、ターミナル向けの累積テキストストリームを構築します。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。既定値は `DEFAULT_TERMINAL_BUFFER_OPTIONS` と同じです。

```typescript
function createTerminalBuffer(
  receive$: Observable<string>,
  options?: TerminalBufferOptions,
): TerminalBuffer;
```

## SerialSessionState

上記と同じ文字列のユニオン型に加え、**定数オブジェクト** `SerialSessionState`（例: `SerialSessionState.Connected` は `'connected'`）が export され、補完やタイポ防止に使えます。従来どおり文字列リテラルで型注釈・比較しても問題ありません。

`state$` は以下のいずれかを emit します。

- `'idle'` — ポート未接続。Web Serial 対応環境での初期値。
- `'connecting'` — `connect$` 実行中。
- `'connected'` — ポートが開いており read pump が動作中。
- `'disconnecting'` — `disconnect$` 実行中。
- `'unsupported'` — `navigator.serial` が存在しない環境でセッションを生成した場合。
- `'error'` — 致命的な失敗が発生した。`disconnect$` を呼ぶかセッションを再生成して復帰する。

遷移:

```
idle -> connecting -> connected -> disconnecting -> idle
                              \-> error
idle / connected / connecting / disconnecting / error -> error（致命的失敗）
any -> unsupported（生成時に navigator.serial が存在しない場合）
```

## SerialSession

```typescript
interface SerialSession {
  isBrowserSupported(): boolean;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;

  readonly state$: Observable<SerialSessionState>;
  readonly isConnected$: Observable<boolean>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;
  readonly receiveReplay$: Observable<string>;
  readonly terminalText$: Observable<string>;
  readonly lines$: Observable<string>;

  send$(data: string | Uint8Array): Observable<void>;
}
```

### `isBrowserSupported(): boolean`

同期的な feature detection。`navigator.serial` が存在すれば `true` を返します。

### `connect$(): Observable<void>`

ユーザーが選択したシリアルポートをオープンし、内部の read pump を起動します。成功時は complete し、失敗時は subscriber と `errors$` の両方にエラーを流します。状態遷移は `idle → connecting → connected`。

### `disconnect$(): Observable<void>`

read pump を停止してポートを閉じます。すでに idle の場合もそのまま complete します。状態遷移は `connected → disconnecting → idle`。`'error'` からも呼べて、ポートをテアダウンして `idle` に戻します。

### `state$: Observable<SerialSessionState>`

購読時に現在値をリプレイします。`BehaviorSubject` を自前で再構築する代わりに、このストリームを UI の駆動源として使ってください。

### `isConnected$: Observable<boolean>`

`SerialSessionState` が `'connected'` のとき `true`、それ以外のとき `false` です。`state$` から `distinctUntilChanged` 付きで派生しており、接続有無の UI 分岐にそのまま使えます。必要に応じて従来どおり `state$` から自前の `map` でも構いません。

### `errors$: Observable<SerialError>`

主エラーチャネル。接続・読み取り・書き込み・クローズで発生したすべての失敗が `SerialError` に正規化されて流れます。致命的な失敗は `state$` を `'error'` に遷移させ、read pump とポートをテアダウンします。

### `receive$: Observable<string>`

内部の read pump が push する UTF-8 デコード済みテキスト（**行揃いではない**生チャンク列）。**subscription-lazy ではありません**：pump は `connect$` によって起動され、チャンクは multicast されます。遅れて購読した consumer は新しいデータのみを受け取ります。`\r` を含む制御文字もそのまま保持されます。**ターミナル風の表示**や **`\r` による上書き行**が必要なときは `receive$` を使います。**改行区切りのログ**や **1 行ずつの解析**には `lines$` を使います。

### `receiveReplay$: Observable<string>`

`receive$` と同じデータ経路ですが、`SerialSessionOptions.receiveReplay.enabled` が `true` のとき、**現在の接続**について直近 *N* 件のデコード**チャンク**を、新規購読者にリプレイします。`enabled` が `false`（既定）のときは `receive$` と同じ Observable 参照です。ポート切断時にリプレイバッファはリセットされます。`lines$` の行分割はリプレイしません。

### `terminalText$: Observable<string>`

`receive$` 由来のターミナル表示向け累積テキスト。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。`createTerminalBuffer(receive$, options.terminalBuffer).text$` と同等です。既定では完了行 10,000 行・文字数 1,048,576 文字まで保持し、`SerialSessionOptions.terminalBuffer` で変更できます。無制限にしたい場合は `{ maxLines: 0, maxChars: 0 }` を指定してください。

### `lines$: Observable<string>`

`\n` / `\r\n` など（実装に従い単独の `\r` も扱い）を区切りとした**行単位**の文字列。行末の改行が揃うまで内部バッファに保持し、揃った行だけが emit されます。既定では未完成 tail は `SerialSessionOptions.lineBuffer` により最大 1,048,576 文字まで保持し、超過時は先頭を破棄して `LINE_BUFFER_OVERFLOW` を `errors$` に通知します（切断はしません）。read pump については `receive$` と同様に **subscription-lazy ではありません**。ログ・パーサ向けであり、`\r` をそのまま活かす raw ターミナル表示には **`receive$`** を使ってください。

### `send$(data: string | Uint8Array): Observable<void>`

ペイロードを送信キューに投入します。文字列は共有 `TextEncoder` で UTF-8 エンコードされます。並行する `send$` 呼び出しは内部 FIFO キューで呼び出し順に直列化されます。書き込み失敗は `SerialErrorCode.WRITE_FAILED` の `SerialError` に正規化され、subscriber と `errors$` の両方に流れます。`'connected'` 以外の状態で呼ぶと、`SerialErrorCode.PORT_NOT_OPEN` で即失敗します。

## SerialError / SerialErrorCode

`SerialError` は `Error` を継承し、`code: SerialErrorCode` と任意の `originalError: Error` を持ちます。`is(code): boolean` で簡潔にコード判定できます。

| Code                     | emit されるタイミング                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `BROWSER_NOT_SUPPORTED`  | 生成時／`connect$` 時に `navigator.serial` が無い                  |
| `PORT_NOT_AVAILABLE`     | 要求ポートにアクセスできない                                       |
| `PORT_OPEN_FAILED`       | `port.open()` が reject                                            |
| `PORT_ALREADY_OPEN`      | `'idle'` / `'error'` 以外で `connect$` を呼んだ                    |
| `PORT_NOT_OPEN`          | 許可されない状態で `send$` / `disconnect$` を呼んだ                |
| `READ_FAILED`            | 内部 read pump でエラーが発生                                      |
| `WRITE_FAILED`           | `port.writable.getWriter().write()` が reject                      |
| `LINE_BUFFER_OVERFLOW`   | `lines$` の未完成 tail が `lineBuffer.maxChars` を超過。先頭データを破棄（non-fatal） |
| `CONNECTION_LOST`        | `port.close()` 失敗または接続中に切断                              |
| `INVALID_FILTER_OPTIONS` | `filters` に不正な値が含まれる                                     |
| `OPERATION_CANCELLED`    | ユーザーがポート選択ダイアログをキャンセル                         |
| `OPERATION_TIMEOUT`      | 内部操作がタイムアウト                                             |
| `UNKNOWN`                | 分類不能なエラー。`originalError` を確認                           |

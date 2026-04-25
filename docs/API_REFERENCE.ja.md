# API リファレンス

v2 の公開 API は、1 つのファクトリ（`createSerialSession`）、1 つのランタイムインターフェイス（`SerialSession`）、1 つの options 型、1 つの状態ユニオン、2 つのエラー型のみで構成されます。

## 公開 export

```typescript
import {
  createSerialSession,
  SerialError,
  SerialErrorCode,
  SerialSessionState,
  type SerialSession,
  type SerialSessionOptions,
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
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;

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

### `errors$: Observable<SerialError>`

主エラーチャネル。接続・読み取り・書き込み・クローズで発生したすべての失敗が `SerialError` に正規化されて流れます。致命的な失敗は `state$` を `'error'` に遷移させ、read pump とポートをテアダウンします。

### `receive$: Observable<string>`

内部の read pump が push する UTF-8 デコード済みテキスト。**subscription-lazy ではありません**：pump は `connect$` によって起動され、チャンクは multicast されます。遅れて購読した consumer は新しいデータのみを受け取ります。

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
| `CONNECTION_LOST`        | `port.close()` 失敗または接続中に切断                              |
| `INVALID_FILTER_OPTIONS` | `filters` に不正な値が含まれる                                     |
| `OPERATION_CANCELLED`    | ユーザーがポート選択ダイアログをキャンセル                         |
| `OPERATION_TIMEOUT`      | 内部操作がタイムアウト                                             |
| `UNKNOWN`                | 分類不能なエラー。`originalError` を確認                           |

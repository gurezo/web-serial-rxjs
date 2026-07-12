# API リファレンス

公開 API は、1 つのファクトリ（`createSerialSession`）、1 つのランタイムインターフェイス（`SerialSession`）、1 つの options 型、1 つの状態ユニオン、2 つのエラー型のみで構成されます。

## 公開 export

```typescript
import {
  createSerialSession,
  createTerminalBuffer,
  DEFAULT_TERMINAL_BUFFER_OPTIONS,
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSession,
  type SerialSessionState,
  type SerialSessionOptions,
  type SerialSessionReceiveReplayOptions,
  type TerminalBufferOptions,
} from '@gurezo/web-serial-rxjs';
```

## Deprecated exports

以下は v3.x で引き続き public export から利用できますが、canonical API ではありません。次回 major version で削除予定です。詳細は [v3 への移行 – §9 `assertNever` public export 監査](./MIGRATION_V3.ja.md#9-assertnever-public-export-監査) を参照してください。

| Export | 状態 | 移行先 |
| --- | --- | --- |
| `assertNever` | v3.x で `@deprecated` | アプリケーション側でローカル helper を定義するか、`switch (state.status)` + `SerialSessionStatus` を使用する |

```typescript
// 非推奨（v3.x では動作するが警告が出る）
import { assertNever } from '@gurezo/web-serial-rxjs';

// 推奨: ローカル helper
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

## createSerialSession(options?)

`SerialSession` を返すファクトリ。`navigator.serial` が存在しない環境でも安全に呼び出せます。その場合 `state$` の初期値は `{ status: 'unsupported' }` となり、`connect$` は `SerialErrorCode.BROWSER_NOT_SUPPORTED` で失敗します。

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
| `receiveReplay` | `SerialSessionReceiveReplayOptions` | `{ enabled: false, bufferSize: 512, maxChars: 0 }` | 受信チャンクの接続単位 replay。`receiveReplay$` を参照。 |
| `terminalBuffer` | `TerminalBufferOptions` | `{ maxLines: 10000, maxChars: 1048576, stripAnsi: true }` | `terminalText$` のメモリ上限と ANSI 除去。`createTerminalBuffer` を参照。 |
| `lineBuffer` | `LineBufferOptions` | `{ maxChars: 1048576 }` | `lines$` の未完成行 tail のメモリ上限。下記を参照。 |

`createSerialSession` 呼び出し時（factory 時）に `resolveSerialSessionOptions` が以下を検証します。不正値は `SerialError` として throw されます。

| 対象 | 検証内容 | エラーコード |
| --- | --- | --- |
| `baudRate` | safe integer かつ `> 0` | `INVALID_CONNECTION_OPTIONS` |
| `filters` | USB vendor/product ID の範囲 | `INVALID_FILTER_OPTIONS` |
| `receiveReplay` | `bufferSize` / `maxChars` の範囲 | `INVALID_RECEIVE_REPLAY_OPTIONS` |
| `terminalBuffer` | `maxLines` / `maxChars` が safe integer かつ `>= 0` | `INVALID_TERMINAL_BUFFER_OPTIONS` |
| `lineBuffer` | `maxChars` が safe integer かつ `>= 0` | `INVALID_LINE_BUFFER_OPTIONS` |

### `SerialSessionReceiveReplayOptions`

| フィールド   | 型        | 既定値   | 説明 |
| ------------ | --------- | -------- | ---- |
| `enabled`    | `boolean` | `false`  | `true` のとき、現在の接続について `receiveReplay$` が直近 N **チャンク**をリプレイする。`false` のとき `receiveReplay$` は `receive$` と同じ hot ストリーム。 |
| `bufferSize` | `number`  | `512`    | 接続中に保持するテキストチャンク数の上限（1〜65536）。文字数・バイト数ではない。 |
| `maxChars`   | `number`  | `0`      | 保持チャンク全体の文字数上限。超過時は**古い**チャンクから破棄し、non-fatal の `RECEIVE_REPLAY_BUFFER_OVERFLOW` を `errors$` に emit する。`0` で制限なし。 |

無効な `bufferSize` / `maxChars` は `createSerialSession` 時に `INVALID_RECEIVE_REPLAY_OPTIONS` で throw します。

### `TerminalBufferOptions`

`createTerminalBuffer` と `SerialSessionOptions.terminalBuffer` で使います。上限を超えたときは、**古い**完了行や先頭の文字から破棄し、長時間のターミナル表示でメモリが際限なく増えないようにします。`0` を指定するとその制限を無効化します。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxLines`   | `number`  | `10000`    | 累積表示テキストに保持する完了行数の上限。 |
| `maxChars`   | `number`  | `1048576`  | 表示テキスト全体（完了部分 + 編集中行）の文字数上限。 |
| `stripAnsi`  | `boolean` | `true`     | `true` のとき、`\r` 折りたたみ前に ANSI エスケープシーケンスを除去します。`false` にすると `terminalText$` に生のエスケープが残ります。`receive$` は常に変更されません。 |

無効な `maxLines` / `maxChars` は `createSerialSession` 時に `INVALID_TERMINAL_BUFFER_OPTIONS` で throw します。

### `LineBufferOptions`

`SerialSessionOptions.lineBuffer` で `lines$` の**未完成行 tail**（改行未到達の保持データ）の上限を指定します。`maxChars` を超えたときは tail の**先頭**文字から破棄し、non-fatal の `SerialErrorCode.LINE_BUFFER_OVERFLOW` を `errors$` に emit します（セッションは切断されません）。完了した行は trim 前にそのまま emit されます。`0` で制限を無効化します。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxChars`   | `number`  | `1048576`  | 未完成行 tail に保持する最大文字数。 |

無効な `maxChars` は `createSerialSession` 時に `INVALID_LINE_BUFFER_OPTIONS` で throw します。

## createTerminalBuffer(receive$, options?)

デコード済みチャンクの `Observable<string>`（通常は `SerialSession.receive$`）から、ターミナル向けの累積テキストストリームを構築します。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。既定値は `DEFAULT_TERMINAL_BUFFER_OPTIONS` と同じです。

```typescript
function createTerminalBuffer(
  receive$: Observable<string>,
  options?: TerminalBufferOptions,
): TerminalBuffer;
```

## SerialSessionState / SerialSessionStatus

v3 では **`SerialSessionStatus`** が lifecycle 文字列定数（例: `SerialSessionStatus.Connected` は `'connected'`）を提供し、**`SerialSessionState`** は `state$` が emit する discriminated union 型です。

`state$` は次のいずれかのオブジェクトを emit します。

- `{ status: 'idle' }` — ポート未接続。Web Serial 対応環境での初期値。
- `{ status: 'connecting' }` — `connect$` 実行中。
- `{ status: 'connected', portInfo }` — ポートが開いており read pump が動作中。`portInfo` は `SerialPort.getInfo()` と同じ形。
- `{ status: 'disconnecting' }` — `disconnect$` 実行中。
- `{ status: 'unsupported' }` — `navigator.serial` が存在しない環境でセッションを生成した場合。
- `{ status: 'error', error }` — 致命的な失敗。`error` は `errors$` に流れた `SerialError` と同一インスタンス。
- `{ status: 'disposed' }` — `dispose$` によりセッションが永久破棄された。

比較例:

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState, SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});

// RxJS pipeline では type predicate を使うと ConnectedSessionState が保持される
session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

### `isConnectedSessionState(state)`

`ConnectedSessionState` 用の type predicate です。RxJS の `filter()` と組み合わせて pipeline 内の discriminated union narrowing を保持します。inline の `filter((s) => s.status === SerialSessionStatus.Connected)` では TypeScript の narrowing は行われません。

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';

session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

v2 からの移行は [v3 移行ガイド](./MIGRATION_V3.ja.md) を参照してください。

## SerialSession

```typescript
interface SerialSession {
  isBrowserSupported(): boolean;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;
  dispose$(): Observable<void>;
  /** @deprecated {@link dispose$} を使用してください。次回 major version で削除予定です。 */
  destroy$(): Observable<void>;

  readonly state$: Observable<SerialSessionState>;
  /** @deprecated {@link state$} を {@link SerialSessionStatus.Connected} で narrowing してください。次回 major version で削除予定です。 */
  readonly isConnected$: Observable<boolean>;
  /** @deprecated {@link state$} を {@link SerialSessionStatus.Connected} で narrowing し `state.portInfo` を使用してください。次回 major version で削除予定です。 */
  readonly portInfo$: Observable<SerialPortInfo | null>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;
  readonly receiveReplay$: Observable<string>;
  readonly terminalText$: Observable<string>;
  readonly lines$: Observable<string>;

  /** @deprecated {@link state$} を {@link SerialSessionStatus.Connected} で narrowing し `state.portInfo` を使用してください。次回 major version で削除予定です。 */
  getPortInfo(): SerialPortInfo | null;

  send$(data: string | Uint8Array): Observable<void>;
}
```

### `isBrowserSupported(): boolean`

同期的な feature detection。`navigator.serial` が存在すれば `true` を返します。

### `connect$(): Observable<void>`

ユーザーが選択したシリアルポートをオープンし、内部の read pump を起動します。成功時は complete し、失敗時は subscriber と `errors$` の両方にエラーを流します。状態遷移は `idle → connecting → connected`。

### `disconnect$(): Observable<void>`

read pump を停止してポートを閉じます。すでに idle の場合もそのまま complete します。状態遷移は `connected → disconnecting → idle`。`'error'` からも呼べて、ポートをテアダウンして `idle` に戻します。`disconnect$` 後もセッションは再利用可能です。永久破棄には `dispose$` を使います。

### `dispose$(): Observable<void>`

セッションを永久破棄します。アクティブな接続があれば `disconnect$` と同様にポートと read pump を teardown し、`state$` に `'disposed'` を emit したうえで、すべてのセッション Observable（`state$`、`errors$`、`receive$`、`lines$`、`terminalText$`、`receiveReplay$`、`portInfo$`、`isConnected$`）を complete します。複数回呼んでも安全で、2 回目以降は即 complete します。

dispose 後の `connect$` と `send$` は `SerialErrorCode.SESSION_DISPOSED` で失敗します。`disconnect$` は即 complete します。baud rate 変更時の session 作り替えなどでは、破棄したインスタンスを再利用せず新しい `SerialSession` を作成してください。

### `destroy$(): Observable<void>`

**非推奨** — `dispose$()` のエイリアスです。v3.x では後方互換のため残っていますが、次回 major version で削除予定です。詳細は [v3 移行ガイド – destroy$ の非推奨化](./MIGRATION_V3.ja.md#4-destroy-の非推奨化) を参照してください。

### `state$: Observable<SerialSessionState>`

購読時に現在値をリプレイします。`BehaviorSubject` を自前で再構築する代わりに、このストリームを UI の駆動源として使ってください。

### `isConnected$: Observable<boolean>`

**非推奨** — `state$.status` が `SerialSessionStatus.Connected` のとき `true`、それ以外のとき `false` です。v3.x では後方互換のため残っていますが、次回 major version で削除予定です。`state$` を `SerialSessionStatus.Connected` で narrowing するか、`state$` から derive してください。詳細は [v3 移行ガイド – isConnected$ の非推奨化](./MIGRATION_V3.ja.md#6-isconnected-の非推奨化) を参照してください。

### `portInfo$: Observable<SerialPortInfo | null>`

**非推奨** — アクティブポートの `SerialPort.getInfo()` スナップショットを emit する convenience stream です。ポートが開いていないときは `null` です。v3.x では後方互換のため残っていますが、次回 major version で削除予定です。`state$` を `SerialSessionStatus.Connected` で narrowing し `state.portInfo` を参照してください。詳細は [v3 移行ガイド – portInfo$ / getPortInfo() の非推奨化](./MIGRATION_V3.ja.md#5-portinfo--getportinfo-の非推奨化) を参照してください。

### `getPortInfo(): SerialPortInfo | null`

**非推奨** — 最後の `portInfo$` 値の同期読み取りです。v3.x では後方互換のため残っていますが、次回 major version で削除予定です。`state$` を `SerialSessionStatus.Connected` で narrowing し `state.portInfo` を参照してください。詳細は [v3 移行ガイド – portInfo$ / getPortInfo() の非推奨化](./MIGRATION_V3.ja.md#5-portinfo--getportinfo-の非推奨化) を参照してください。

### `errors$: Observable<SerialError>`

主エラーチャネル。接続・読み取り・書き込み・クローズで発生したすべての失敗が `SerialError` に正規化されて流れます。致命的な失敗は `state$` を `{ status: 'error', error }` に遷移させ、read pump とポートをテアダウンします。

### `receive$: Observable<string>`

内部の read pump が push する UTF-8 デコード済みテキスト（**行揃いではない**生チャンク列）。**subscription-lazy ではありません**：pump は `connect$` によって起動され、チャンクは multicast されます。遅れて購読した consumer は新しいデータのみを受け取ります。`\r` を含む制御文字もそのまま保持されます。**ターミナル風の表示**や **`\r` による上書き行**が必要なときは `receive$` を使います。**改行区切りのログ**や **1 行ずつの解析**には `lines$` を使います。

### `receiveReplay$: Observable<string>`

`receive$` と同じデータ経路ですが、`SerialSessionOptions.receiveReplay.enabled` が `true` のとき、**現在の接続**について直近 *N* 件のデコード**チャンク**を、新規購読者にリプレイします。`enabled` が `false`（既定）のときは `receive$` と同じ Observable 参照です。ポート切断時にリプレイバッファはリセットされます。任意の `maxChars` で保持チャンク全体の文字数上限を指定でき、超過時は古いチャンクから破棄します。`lines$` の行分割はリプレイしません。

### `terminalText$: Observable<string>`

`receive$` 由来のターミナル表示向け累積テキスト。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。既定ではプレーンテキスト表示（`<textarea>` など）向けに ANSI エスケープを除去します。生のエスケープは `receive$` で参照できます。`createTerminalBuffer(receive$, options.terminalBuffer).text$` と同等です。既定では完了行 10,000 行・文字数 1,048,576 文字まで保持し、`SerialSessionOptions.terminalBuffer` で変更できます。無制限にしたい場合は `{ maxLines: 0, maxChars: 0 }` を指定してください。

### `lines$: Observable<string>`

`\n` / `\r\n` など（実装に従い単独の `\r` も扱い）を区切りとした**行単位**の文字列。行末の改行が揃うまで内部バッファに保持し、揃った行だけが emit されます。既定では未完成 tail は `SerialSessionOptions.lineBuffer` により最大 1,048,576 文字まで保持し、超過時は先頭を破棄して `LINE_BUFFER_OVERFLOW` を `errors$` に通知します（切断はしません）。read pump については `receive$` と同様に **subscription-lazy ではありません**。ログ・パーサ向けであり、`\r` をそのまま活かす raw ターミナル表示には **`receive$`** を使ってください。

### `send$(data: string | Uint8Array): Observable<void>`

ペイロードを送信キューに投入します。文字列は共有 `TextEncoder` で UTF-8 エンコードされます。並行する `send$` 呼び出しは内部 FIFO キューで呼び出し順に直列化されます。書き込み失敗は `SerialErrorCode.WRITE_FAILED` の `SerialError` に正規化され、subscriber と `errors$` の両方に流れます。`'connected'` 以外の状態で呼ぶと、`SerialErrorCode.PORT_NOT_OPEN` で即失敗します。

## SerialError / SerialErrorCode

`SerialError` は `Error` を継承し、`code: SerialErrorCode` と code 別の構造化メタデータ `context` を持ちます。`is(code)` は `code` と `context` を literal 型に narrow します。

cause 系 error code では **`context.cause`**（`unknown`）が原因エラーの canonical source です。`originalError` は後方互換のため v3.x に残っていますが **非推奨** で、次回 major version で削除予定です。詳細は [v3 移行ガイド – originalError の非推奨化](./MIGRATION_V3.ja.md#3-originalerror-の非推奨化) を参照してください。

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error(error.context.cause);
  }
});

try {
  createSerialSession({ baudRate: 0 });
} catch (error) {
  if (error instanceof SerialError && error.is(SerialErrorCode.INVALID_CONNECTION_OPTIONS)) {
    console.error(error.context.field, error.context.value, error.context.constraint);
  }
}
```

上記と同じ文字列のユニオン型に加え、**定数オブジェクト** `SerialErrorCode`（例: `SerialErrorCode.READ_FAILED` は `'READ_FAILED'`）が export され、補完やタイポ防止に使えます。従来どおり文字列リテラルで型注釈・比較しても問題ありません。enum から const object への宣言変更は [v3 移行ガイド](./MIGRATION_V3.ja.md) を参照してください。

全 19 code の runtime emission coverage は [v3 移行ガイド §8](./MIGRATION_V3.ja.md#8-serialerrorcode-runtime-emission-監査) で監査済みです。

| Code                     | `context` の形 | emit されるタイミング                                              |
| ------------------------ | -------------- | ------------------------------------------------------------------ |
| `LINE_BUFFER_OVERFLOW`   | `{ maxChars: number }` | `lines$` の未完成 tail が `lineBuffer.maxChars` を超過。先頭データを破棄（non-fatal） |
| `RECEIVE_REPLAY_BUFFER_OVERFLOW` | `{ maxChars: number; bufferSize: number }` | `receiveReplay$` バッファが `receiveReplay` の上限を超過。古いチャンクを破棄（non-fatal） |
| `INVALID_*` validation code | `ValidationErrorContext` | factory 時の options 検証。下表参照。`error.is(code)` で narrow |
| `PORT_OPEN_FAILED` など cause 系 | `{ cause: unknown }` | 下表の各タイミング。`error.is(code)` で narrow してから `context.cause` を参照 |
| その他                   | `undefined`    | 下表の各タイミング                                                 |

`ValidationErrorContext` は `{ field: string; value: unknown; constraint: ValidationErrorConstraint; filterIndex?: number }` です。`message` は人間向け、`context` はプログラム向けの metadata として利用してください。

### Implemented（v3.x で emit される）

| Code                     | emit されるタイミング                                              |
| ------------------------ | ------------------------------------------------------------------ |
| `BROWSER_NOT_SUPPORTED`  | `connect$` 時に `navigator.serial` が無い                          |
| `PORT_OPEN_FAILED`       | `port.open()` が reject                                            |
| `PORT_ALREADY_OPEN`      | `'idle'` / `'error'` 以外で `connect$` を呼んだ                    |
| `PORT_NOT_OPEN`          | 許可されない状態で `send$` または `disconnect$` を呼んだ           |
| `READ_FAILED`            | 内部 read pump でエラーが発生                                      |
| `WRITE_FAILED`           | `port.writable.getWriter().write()` が reject                      |
| `CONNECTION_LOST`        | `port.close()` 失敗または接続中に切断                              |
| `INVALID_FILTER_OPTIONS` | `filters` に不正な値が含まれる（セッション生成時）                 | `ValidationErrorContext` |
| `INVALID_RECEIVE_REPLAY_OPTIONS` | `receiveReplay.bufferSize` または `receiveReplay.maxChars` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `INVALID_TERMINAL_BUFFER_OPTIONS` | `terminalBuffer.maxLines` または `terminalBuffer.maxChars` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `INVALID_LINE_BUFFER_OPTIONS` | `lineBuffer.maxChars` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `INVALID_CONNECTION_OPTIONS` | `baudRate` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `OPERATION_CANCELLED`    | ユーザーがポート選択ダイアログをキャンセル                         |
| `SESSION_DISPOSED`       | `dispose$` 後に `connect$` または `send$` を呼んだ                 |
| `UNKNOWN`                | dispose / disconnect の分類不能 fallback。`context.cause` を確認     |

### Reserved（v3.x では emit されない・次回 major で削除予定）

| Code                     | 備考                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `PORT_NOT_AVAILABLE`     | **非推奨。** `getPorts` 系 API 未実装のため到達不能。ポート取得失敗は `PORT_OPEN_FAILED` / `OPERATION_CANCELLED` を使用 |
| `OPERATION_TIMEOUT`      | **非推奨。** timeout / transaction API 未実装のため到達不能        |

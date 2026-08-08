# API の概念と設計メモ

公開 API の網羅的な仕様は [英語 TypeDoc API Reference](../../api/modules.html) を参照してください。本ページは Guide 向けの概念補足（表・設計メモ）です。


公開 API は、1 つのファクトリ（`createSerialSession`）、1 つのランタイムインターフェイス（`SerialSession`）、1 つの options 型、1 つの状態ユニオン、2 つのエラー型のみで構成されます。

## 対応範囲（テキスト / バイナリ / 文字コード）

本ライブラリは **UTF-8 テキスト中心**です。内部の read pump は常にストリーミング `TextDecoder`（UTF-8、`fatal: false`、`stream: true`）でデコードします。公開のエンコーディングオプションはありません。

| 項目 | 現在の対応 |
| --- | --- |
| UTF-8 テキスト送受信 | 対応 |
| チャンク単位の文字列受信 | `receive$` — **デコード済みチャンク**（行未分割のテキスト。ワイヤ上の生バイトではない） |
| 改行区切りの文字列受信 | `lines$` |
| `\r` を含むターミナル表示 | `receive$` / `terminalText$` |
| バイナリ送信 | `send$(Uint8Array)` — バイト列をそのまま送信 |
| バイナリ受信 | **非対応** — `receiveBytes$` や生 `Uint8Array` 受信ストリームなし |
| UTF-8 以外の文字コード（例: Shift_JIS） | **非対応** |
| 特定プロトコル（Modbus RTU / COBS / SLIP / 独自バイナリフレーム） | **利用側で実装** — デコード済みテキスト上で組み立てるか、本ライブラリ外で扱う |

用途から `receive$` / `lines$` / `terminalText$` を選ぶ手順は [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) を参照してください。

### `receive$` における「raw」の意味

ドキュメントや JSDoc で言う **raw** は、**行未分割のデコード済みテキストチャンク**（`\r` などの制御文字を保持）を指します。ワイヤ上の生バイトや `Uint8Array` ストリームではありません。

`send$(string)` は共有 `TextEncoder`（UTF-8）でエンコードします。`send$(Uint8Array)` はバイト列をそのまま書き込みます。受信は常に UTF-8 テキストのみのため、バイナリについては送受信が**非対称**です。

### 将来のバイナリ受信（設計論点のみ）

将来の API（例: `receiveBytes$`）は**本リリースでは実装しません**。再検討する場合は少なくとも次を整理する必要があります。

- Web Serial `ReadableStream` の read サイズとチャンク境界
- 購読が遅い場合のバックプレッシャー / 未読バッファ増大
- 既存の `receive$` / `lines$` / `terminalText$` との関係（並列ストリームか置換か）
- バイト列 API 追加が破壊的変更か、加算的な opt-in か
- 不正な UTF-8 / バイナリプロトコルを先に `TextDecoder` へ通してはいけない点

後続の設計検討は [#545](https://github.com/gurezo/web-serial-rxjs/issues/545)（親 Issue [#535](https://github.com/gurezo/web-serial-rxjs/issues/535)）で追跡し、現行の対応範囲の明文化は [#540](https://github.com/gurezo/web-serial-rxjs/issues/540) です。

## 公開 export

```typescript
import {
  createSerialSession,
  isWebSerialSupported,
  createTerminalBuffer,
  DEFAULT_TERMINAL_BUFFER_OPTIONS,
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSession,
  type SerialSessionState,
  type SerialSessionOptions,
  type SerialSessionFeatureOptions,
  type SerialConnectionOptions,
  type TerminalBufferOptions,
} from '@gurezo/web-serial-rxjs';
```

## Deprecated exports

以下は **v4** でも引き続き public export から利用できますが、canonical API ではありません。**非推奨**であり、将来の major（**v5 以降**）で削除予定です。監査の経緯は [v3 への移行 – §9 `assertNever` public export 監査](./migration-v3.md#9-public-export-監査) を参照してください。v4 で既に削除された API（`destroy$`、`isConnected$`、`portInfo$`、`getPortInfo()`、`getCurrentPort()`、`receiveReplay$`、`isBrowserSupported()` など）は [v4 への移行](./migration-v4.md) を参照してください。

| Export | 状態 | 移行先 |
| --- | --- | --- |
| `assertNever` | v4 で `@deprecated` | アプリケーション側でローカル helper を定義するか、`switch (state.status)` + `SerialSessionStatus` を使用する |

```typescript
// 非推奨（v4 でも利用可能だが警告が出る）
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

`SerialSessionOptions` は W3C connection parameters（`SerialConnectionOptions`）と library-specific session features（`SerialSessionFeatureOptions`）の composition です。`createSerialSession` の factory 引数として使用します。

```text
SerialSessionOptions = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

最小構成では通常 `baudRate` だけで十分です。他のフィールドは安全な既定値が適用されます。

```typescript
const session = createSerialSession({ baudRate: 115200 });
```

詳細は [v3 への移行 – §10 Session options 型責務監査](./migration-v3.md#10-session-options-型責務監査) を参照してください。
Phase 2 のオプション責務整理は [Issue #488](https://github.com/gurezo/web-serial-rxjs/issues/488) も参照してください。

### Connection options（`SerialConnectionOptions`）

W3C `SerialOptions` から派生し、`port.open` に渡されます。factory 時点ではすべて optional で、省略時は下表の既定値が適用されます。

| フィールド    | 型                                  | 既定値    | 説明                                                                         |
| ------------- | ----------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `baudRate`    | `number`                            | `9600`    | ボーレート（bps）。safe integer かつ `> 0`                                   |
| `dataBits`    | `7 \| 8`                            | `8`       | データビット                                                                 |
| `stopBits`    | `1 \| 2`                            | `1`       | ストップビット                                                               |
| `parity`      | `'none' \| 'even' \| 'odd'`         | `'none'`  | パリティ                                                                     |
| `bufferSize`  | `number`                            | `255`     | リードストリームのバッファサイズ（バイト）。safe integer かつ `> 0`          |
| `flowControl` | `'none' \| 'hardware'`              | `'none'`  | フロー制御                                                                   |

### Session feature options（`SerialSessionFeatureOptions`）

`web-serial-rxjs` 固有の session 機能です。W3C `port.open` には渡されません。

| フィールド    | 型                                  | 既定値    | 説明                                                                         |
| ------------- | ----------------------------------- | --------- | ---------------------------------------------------------------------------- |
| `filters`     | `SerialPortFilter[]` \| `undefined` | —         | ポート選択ダイアログに渡される `navigator.serial.requestPort` 用フィルタ     |
| `terminalBuffer` | `TerminalBufferOptions` | `{ maxLines: 10000, maxChars: 1048576, stripAnsi: true }` | `terminalText$` のメモリ上限と ANSI 除去。`createTerminalBuffer` を参照。 |
| `lineBuffer` | `LineBufferOptions` | `{ maxChars: 1048576 }` | `lines$` の未完成行 tail のメモリ上限。下記を参照。 |

`createSerialSession` 呼び出し時（factory 時）に `resolveSerialSessionOptions` が以下を検証します。不正値は `SerialError` として throw されます。

| 対象 | 検証内容 | エラーコード |
| --- | --- | --- |
| `baudRate` | safe integer かつ `> 0` | `INVALID_CONNECTION_OPTIONS` |
| `bufferSize` | safe integer かつ `> 0` | `INVALID_CONNECTION_OPTIONS` |
| `filters` | USB vendor/product ID の範囲 | `INVALID_FILTER_OPTIONS` |
| `terminalBuffer` | `maxLines` / `maxChars` が safe integer かつ `>= 0` | `INVALID_TERMINAL_BUFFER_OPTIONS` |
| `lineBuffer` | `maxChars` が safe integer かつ `>= 0` | `INVALID_LINE_BUFFER_OPTIONS` |

#### 数値境界値の意味

| 値 | 接続（`baudRate` / `bufferSize`） | バッファ上限（`terminalBuffer` / `lineBuffer`） |
| --- | --- | --- |
| `undefined` | 既定値を適用 | ネスト側の既定値を適用 |
| `0` | **拒否** | **無制限**（その制限を無効化） |
| 負数 / 非整数 / `NaN` / `Infinity` | 拒否 | 拒否 |

接続フィールドで `0` を無制限と解釈しないでください。

### `TerminalBufferOptions`

`createTerminalBuffer` と `SerialSessionOptions.terminalBuffer` で使います。上限を超えたときは、**古い**完了行や先頭の文字から破棄し、長時間のターミナル表示でメモリが際限なく増えないようにします。`0` を指定するとその制限を無効化します。文字数は UTF-16 の文字列長（JavaScript の `.length`）です。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxLines`   | `number`  | `10000`    | 累積表示テキストに保持する完了行数の上限。 |
| `maxChars`   | `number`  | `1048576`  | 表示テキスト全体（完了部分 + 編集中行）の文字数上限。 |
| `stripAnsi`  | `boolean` | `true`     | `true` のとき、`\r` 折りたたみ前に ANSI エスケープシーケンスを除去します。`false` にすると `terminalText$` に生のエスケープが残ります。`receive$` は常に変更されません。 |

無効な `maxLines` / `maxChars` は `createSerialSession` および単独の `createTerminalBuffer` 時に `INVALID_TERMINAL_BUFFER_OPTIONS` で throw します。

### `LineBufferOptions`

`SerialSessionOptions.lineBuffer` で `lines$` の**未完成行 tail**（改行未到達の保持データ）の上限を指定します。`maxChars` を超えたときは tail の**先頭**文字から破棄し、non-fatal の `SerialErrorCode.LINE_BUFFER_OVERFLOW` を `errors$` に emit します（セッションは切断されません）。完了した行は trim 前にそのまま emit されます。`0` で制限を無効化します。文字数は UTF-16 の文字列長です。

| フィールド   | 型        | 既定値     | 説明 |
| ------------ | --------- | ---------- | ---- |
| `maxChars`   | `number`  | `1048576`  | 未完成行 tail に保持する最大文字数。 |

無効な `maxChars` は `createSerialSession` 時に `INVALID_LINE_BUFFER_OPTIONS` で throw します。

## createTerminalBuffer(receive$, options?)

デコード済みチャンクの `Observable<string>`（通常は `SerialSession.receive$`）から、ターミナル向けの累積テキストストリームを構築します。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。既定値は `DEFAULT_TERMINAL_BUFFER_OPTIONS` と同じです。無効な `maxLines` / `maxChars` はセッション生成時と同じ `INVALID_TERMINAL_BUFFER_OPTIONS` を throw します。

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

v2 からの移行は [v3 移行ガイド](./migration-v3.md) を参照してください。

## SerialSession

```typescript
interface SerialSession {
  connect$(): Observable<void>;
  disconnect$(): Observable<void>;
  dispose$(): Observable<void>;

  readonly state$: Observable<SerialSessionState>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;
  readonly terminalText$: Observable<string>;
  readonly lines$: Observable<string>;

  send$(data: string | Uint8Array): Observable<void>;
}
```

### 差し替え可能な公開契約（Decision #536）

`SerialSession` はクラスではなく、package から export される **公開 interface** です。アプリケーションコードは具象の `createSerialSession()` 戻り値に直接依存せず、この型に依存してください。生成は DI 境界・ファクトリ・Composition root に閉じます。

**Decision:** 別名の `SerialSessionLike` などは **追加しません**。

| 理由 | 説明 |
| --- | --- |
| 既存契約で十分 | `SerialSession` がすでに差し替え可能な公開契約 |
| 構造的型付け | 同形の Fake は `SerialSession` にそのまま代入できる |
| 二重管理を避ける | 別名 interface は長期互換・文書・型のコストだけが増える |
| Parent #535 | コア API を安易に拡張しない |

制御可能な Fake、Vitest 例、Angular / React への注入、および **npm 同梱の判断**（Fake は **公開しない**）は **[Fake SerialSession による実機なしテスト](./testing.md)**（#537）を参照してください。

#### 推奨パターン

```typescript
import {
  createSerialSession,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';

// アプリ層: SerialSession だけを受け取る
function createSerialUi(session: SerialSession) {
  return session.state$.subscribe((state) => {
    // UI 更新
  });
}

// 境界でのみ具象を生成
const session = createSerialSession({ baudRate: 115200 });
createSerialUi(session);
```

#### フレームワークへの適用メモ

| 環境 | 型の置き方（例） |
| --- | --- |
| Angular | `InjectionToken<SerialSession>` で注入し、本番は `createSerialSession()`、テストは Fake — [testing](./testing.md#angular-serialsession-を注入する) |
| React | props / Context の型を `SerialSession` にする — [testing](./testing.md#react-serialsession-型の-context) |
| Vue | `provide` / `inject` の値の型を `SerialSession` にする |
| Svelte | `setContext` / `getContext` の型を `SerialSession` にする |
| Vanilla TS | コンストラクタやファクトリ引数を `SerialSession` にする |

### `isWebSerialSupported(): boolean`

同期的な **feature detection**。`navigator.serial` が存在すれば `true` を返します。セッション生成**前**に使ってください。生成後の unsupported UI は `state$` の `SerialSessionStatus.Unsupported` を推奨します。

これは**互換性や公式サポートの保証ではありません** — [ブラウザサポートと公式サポート方針](./browser-support.md) を参照してください。セキュアコンテキストは別条件です。移行メモ: [v4 への移行 – ブラウザー対応判定](./migration-v4.md#ブラウザー対応判定)。

### `connect$(): Observable<void>`

ユーザーが選択したシリアルポートをオープンし、内部の read pump を起動します。成功時は complete し、失敗時は subscriber と `errors$` の両方にエラーを流します。状態遷移は `idle → connecting → connected`。**購読により実行されます。**

### `disconnect$(): Observable<void>`

read pump を停止してポートを閉じます。すでに idle の場合もそのまま complete します。状態遷移は `connected → disconnecting → idle`。`'error'` からも呼べて、ポートをテアダウンして `idle` に戻します。`disconnect$` 後もセッションは再利用可能です。永久破棄には `dispose$` を使います。**購読により実行されます。**

### `dispose$(): Observable<void>`

セッションを永久破棄します。アクティブな接続があれば `disconnect$` と同様にポートと read pump を teardown し、`state$` に `'disposed'` を emit したうえで、すべてのセッション Observable（`state$`、`errors$`、`receive$`、`lines$`、`terminalText$`）を complete します。複数回呼んでも安全で、2 回目以降は即 complete します。**購読により実行されます。**

dispose 後の `connect$` と `send$` は `SerialErrorCode.SESSION_DISPOSED` で失敗します。`disconnect$` は即 complete します。baud rate 変更時の session 作り替えなどでは、破棄したインスタンスを再利用せず新しい `SerialSession` を作成してください。

### `state$: Observable<SerialSessionState>`

購読時に現在値をリプレイします。`BehaviorSubject` を自前で再構築する代わりに、このストリームを UI の駆動源として使ってください。`state.status` が `SerialSessionStatus.Connected` のときは **`state.portInfo`** でデバイス識別します。公開 API に `portInfo$` / `getPortInfo()` / `isConnected$` / `destroy$()` / `getCurrentPort()` / `receiveReplay$` / `isBrowserSupported()` はありません — [v4 への移行](./migration-v4.md) を参照してください。

### `errors$: Observable<SerialError>`

主エラーチャネル。接続・読み取り・書き込み・クローズで発生したすべての失敗が `SerialError` に正規化されて流れます。致命的な失敗は `state$` を `{ status: 'error', error }` に遷移させ、read pump とポートをテアダウンします。

### `receive$: Observable<string>`

内部の read pump が push する UTF-8 デコード済みテキスト（**行揃いではない**デコードチャンク列。**ワイヤ上の生バイトではありません**）。**subscription-lazy ではありません**：pump は `connect$` によって起動され、チャンクは multicast されます。遅れて購読した consumer は新しいデータのみを受け取ります。`\r` を含む制御文字もそのまま保持されます。**ターミナル風の表示**や **`\r` による上書き行**が必要なときは `receive$` を使います。**改行区切りのログ**や **1 行ずつの解析**には `lines$` を使います。詳細は [対応範囲](#対応範囲テキスト--バイナリ--文字コード) を参照してください。

### `terminalText$: Observable<string>`

`receive$` 由来のターミナル表示向け累積テキスト。`\r` による再描画を畳み込みつつ、通常の改行挙動は維持します。既定ではプレーンテキスト表示（`<textarea>` など）向けに ANSI エスケープを除去します。生のエスケープは `receive$` で参照できます。`createTerminalBuffer(receive$, options.terminalBuffer).text$` と同等です。既定では完了行 10,000 行・文字数 1,048,576 文字まで保持し、`SerialSessionOptions.terminalBuffer` で変更できます。無制限にしたい場合は `{ maxLines: 0, maxChars: 0 }` を指定してください。

### `lines$: Observable<string>`

`\n` / `\r\n` など（実装に従い単独の `\r` も扱い）を区切りとした**行単位**の文字列。行末の改行が揃うまで内部バッファに保持し、揃った行だけが emit されます。既定では未完成 tail は `SerialSessionOptions.lineBuffer` により最大 1,048,576 文字まで保持し、超過時は先頭を破棄して `LINE_BUFFER_OVERFLOW` を `errors$` に通知します（切断はしません）。read pump については `receive$` と同様に **subscription-lazy ではありません**。ログ・パーサ向けであり、`\r` をそのまま活かす未フレーミングのターミナル表示には **`receive$`** を使ってください。

### `send$(data: string | Uint8Array): Observable<void>`

ペイロードを送信キューに投入します。文字列は共有 `TextEncoder` で UTF-8 エンコードされます。`Uint8Array` はそのまま書き込まれます（バイナリ**送信**のみ — 対応するバイナリ受信 API はありません）。並行する `send$` 呼び出しは内部 FIFO キューで呼び出し順に直列化されます。書き込み失敗は `SerialErrorCode.WRITE_FAILED` の `SerialError` に正規化され、subscriber と `errors$` の両方に流れます。`'connected'` 以外の状態で呼ぶと、`SerialErrorCode.PORT_NOT_OPEN` で即失敗します。**購読により実行されます。**詳細は [対応範囲](#対応範囲テキスト--バイナリ--文字コード) を参照してください。

## SerialError / SerialErrorCode

`SerialError` は `Error` を継承し、`code: SerialErrorCode` と code 別の構造化メタデータ `context` を持ちます。`is(code)` は `code` と `context` を literal 型に narrow します。

cause 系 error code では **`context.cause`**（`unknown`）が原因エラーの canonical source です。`originalError` は後方互換のため **v4** にも残っていますが **非推奨** で、将来の major（**v5 以降**）で削除予定です。詳細は [v3 移行ガイド – originalError の非推奨化](./migration-v3.md#3-originalerror-の非推奨化) を参照してください。

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

上記と同じ文字列のユニオン型に加え、**定数オブジェクト** `SerialErrorCode`（例: `SerialErrorCode.READ_FAILED` は `'READ_FAILED'`）が export され、補完やタイポ防止に使えます。従来どおり文字列リテラルで型注釈・比較しても問題ありません。enum から const object への宣言変更は [v3 移行ガイド](./migration-v3.md) を参照してください。

実装済み code の runtime emission coverage は [v3 移行ガイド §8](./migration-v3.md#8-serialerrorcode-runtime-emission-監査) で監査済みです。receive-replay 関連 code は [v4 への移行 – Phase 2](./migration-v4.md#phase-2-api-削除) で削除されました。

| Code                     | `context` の形 | emit されるタイミング                                              |
| ------------------------ | -------------- | ------------------------------------------------------------------ |
| `LINE_BUFFER_OVERFLOW`   | `{ maxChars: number }` | `lines$` の未完成 tail が `lineBuffer.maxChars` を超過。先頭データを破棄（non-fatal） |
| `INVALID_*` validation code | `ValidationErrorContext` | factory 時の options 検証。下表参照。`error.is(code)` で narrow |
| `PORT_OPEN_FAILED` など cause 系 | `{ cause: unknown }` | 下表の各タイミング。`error.is(code)` で narrow してから `context.cause` を参照 |
| その他                   | `undefined`    | 下表の各タイミング                                                 |

`ValidationErrorContext` は `{ field: string; value: unknown; constraint: ValidationErrorConstraint; filterIndex?: number }` です。`message` は人間向け、`context` はプログラム向けの metadata として利用してください。

### Implemented（v4 で emit される）

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
| `INVALID_TERMINAL_BUFFER_OPTIONS` | `terminalBuffer.maxLines` または `terminalBuffer.maxChars` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `INVALID_LINE_BUFFER_OPTIONS` | `lineBuffer.maxChars` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `INVALID_CONNECTION_OPTIONS` | `baudRate` が範囲外（セッション生成時） | `ValidationErrorContext` |
| `OPERATION_CANCELLED`    | ユーザーがポート選択ダイアログをキャンセル                         |
| `SESSION_DISPOSED`       | `dispose$` 後に `connect$` または `send$` を呼んだ                 |
| `UNKNOWN`                | dispose / disconnect の分類不能 fallback。`context.cause` を確認     |

### Reserved（v4 では emit されない・将来の major / v5 以降で削除予定）

| Code                     | 備考                                                               |
| ------------------------ | ------------------------------------------------------------------ |
| `PORT_NOT_AVAILABLE`     | **非推奨。** `getPorts` 系 API 未実装のため到達不能。ポート取得失敗は `PORT_OPEN_FAILED` / `OPERATION_CANCELLED` を使用 |
| `OPERATION_TIMEOUT`      | **非推奨。** timeout / transaction API 未実装のため到達不能        |

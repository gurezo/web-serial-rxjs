# v3 への移行

v3 では TypeScript 向けに次の 2 つの破壊的変更があります。

1. **`SerialErrorCode`** — `enum` から const object + union type へ（ランタイム値は不変）。
2. **`state$` の payload** — フラットな文字列から、状態ごとの詳細を持つ discriminated union へ。

本ガイドでは両方を説明します。エラーコードのランタイム文字列は変わりません（`SerialErrorCode.READ_FAILED` は引き続き `'READ_FAILED'` です）。

## TL;DR

```typescript
import {
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state: SerialSessionState) => {
  switch (state.status) {
    case SerialSessionStatus.Connected:
      console.log(state.portInfo);
      break;
    case SerialSessionStatus.Error:
      console.error(state.error);
      break;
  }
});

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error(error.context.cause);
  }
});
```

---

## 1. `SerialErrorCode` const object

### 変更内容

| v2 | v3 |
| --- | --- |
| `export enum SerialErrorCode { ... }` | `export const SerialErrorCode = { ... } as const` + `export type SerialErrorCode` |
| TypeDoc: `enums/SerialErrorCode.html` | TypeDoc: `variables/SerialErrorCode.html` |

### 移行不要（典型的なパターン）

- `SerialErrorCode.BROWSER_NOT_SUPPORTED`（他のメンバーも同様）
- `error.code === SerialErrorCode.WRITE_FAILED`
- `error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)` による `context` の narrowing
- `switch (error.code) { case SerialErrorCode.READ_FAILED: ... }`

### 更新が必要な場合

- **型のみの import** — `import type { SerialErrorCode } from '@gurezo/web-serial-rxjs'` のまま利用可能。
- **TypeDoc の深いリンク** — `enums/SerialErrorCode.html` から `variables/SerialErrorCode.html` へ更新。
- **`.d.ts` を解析するツール** — 宣言形が `enum` から `const` + type alias に変わります。

---

## 2. discriminated union `state$`

### 変更内容

| v2 | v3 |
| --- | --- |
| `state$: Observable<'idle' \| 'connected' \| ...>` | `state$: Observable<SerialSessionState>`（discriminated union） |
| `SerialSessionState` const（文字列リテラル） | **`SerialSessionStatus`** const（文字列リテラル） |
| `state === SerialSessionState.Connected` | `state.status === SerialSessionStatus.Connected` |
| `state$` と `portInfo$` / `errors$` を手動で相関 | `connected` に `portInfo`、`error` に `SerialError` を同梱 |

### v2（変更前）

```typescript
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state === SerialSessionState.Connected) {
    session.getPortInfo(); // 別途取得
  }
});
```

### v3（変更後）

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  switch (state.status) {
    case SerialSessionStatus.Connected:
      console.log(state.portInfo);
      break;
    case SerialSessionStatus.Error:
      console.error(state.error);
      break;
  }
});
```

### 型の形

```typescript
export const SerialSessionStatus = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
  Unsupported: 'unsupported',
  Error: 'error',
  Disposed: 'disposed',
} as const;

export type SerialSessionState =
  | { readonly status: typeof SerialSessionStatus.Idle }
  | { readonly status: typeof SerialSessionStatus.Connecting }
  | { readonly status: typeof SerialSessionStatus.Connected; readonly portInfo: SerialPortInfo }
  | { readonly status: typeof SerialSessionStatus.Disconnecting }
  | { readonly status: typeof SerialSessionStatus.Unsupported }
  | { readonly status: typeof SerialSessionStatus.Error; readonly error: SerialError }
  | { readonly status: typeof SerialSessionStatus.Disposed };
```

### 移行チェックリスト

- [ ] **定数**として使っていた `SerialSessionState` を `SerialSessionStatus` に置き換える。
- [ ] `state === SerialSessionState.X` を `state.status === SerialSessionStatus.X` に置き換える。
- [ ] `switch (state)` を `switch (state.status)` に置き換える（または `if` で `state.status` を比較）。
- [ ] `connected` 時は `state.portInfo` を利用する（推奨 — `portInfo$` と `getPortInfo()` は非推奨）。
- [ ] `error` 時は `state.error` を利用（fatal error は `errors$` と同一インスタンス）。

### 変更なし

- `errors$` は引き続き利用可能です。
- `portInfo$` と `getPortInfo()` は v3.x では引き続き利用可能ですが、**非推奨**です（[§5](#5-portinfo--getportinfo-の非推奨化) を参照）。
- `isConnected$` は v3.x では引き続き利用可能ですが、**非推奨**です（[§6](#6-isconnected-の非推奨化) を参照）。

---

## 3. `originalError` の非推奨化

v3.0.0 では typed `SerialError.context` を導入しました。cause 系 error code では **`context.cause`** が原因エラーの canonical source です。

後方互換のため `SerialError.originalError` と constructor の legacy 第 3 引数は v3.x で残っていますが、**非推奨**です。次回 major version で削除予定です。

### v2 / 旧パターン（非推奨）

```typescript
session.errors$.subscribe((error) => {
  if (error.code === SerialErrorCode.READ_FAILED) {
    console.error(error.originalError);
  }
});
```

### v3 推奨パターン

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    // error.context.cause は unknown — Error 以外の throw も保持
    console.error(error.context.cause);
  }
});
```

### 移行チェックリスト

- [ ] `error.originalError` を `error.context.cause` に置き換える（`error.is(code)` で narrowing してからアクセス）。
- [ ] 独自に `new SerialError(code, message, cause)` としていた場合は `new SerialError(code, message, undefined, { cause })` に変更する。
- [ ] TypeScript の `@deprecated` 警告が出たら、上記パターンへ移行する。

### v3.x での互換性

- `originalError` は v3.x では引き続き利用可能です。
- `context.cause` が `Error` インスタンスの場合、`originalError` も同期して設定されます（legacy 利用者向け）。
- `context.cause` の型は `unknown` です（JavaScript では `Error` 以外も throw 可能なため）。

---

## 4. `destroy$` の非推奨化

`SerialSession` は `dispose$()` と `destroy$()` の両方を公開しています。これらは同一関数であり、`destroy$` は legacy エイリアスです。lifecycle terminology（`dispose`、`disposed`、`SESSION_DISPOSED`）はすでに **`dispose$`** を canonical API として使用しています。

後方互換のため `destroy$()` は v3.x に残っていますが、**非推奨**です。次回 major version で削除予定です。

### v2 / 旧パターン（非推奨）

```typescript
session.destroy$().subscribe({
  complete: () => console.log('session destroyed'),
});
```

### v3 推奨パターン

```typescript
session.dispose$().subscribe({
  complete: () => console.log('session disposed'),
});
```

### 移行チェックリスト

- [ ] `session.destroy$()` を `session.dispose$()` に置き換える。
- [ ] TypeScript の `@deprecated` 警告が出たら `dispose$` へ移行する。
- [ ] 新規コードとドキュメントでは `dispose$` を使用する。

### v3.x での互換性

- `destroy$` は v3.x では引き続き利用可能で、`dispose$` と同じ実装に委譲します。
- ランタイム挙動は変更されません。非推奨化されるのはエイリアスのみです。

---

## 5. `portInfo$` / `getPortInfo()` の非推奨化

v3.0.0 では `state$` が discriminated union になりました。`state.status` が `SerialSessionStatus.Connected` のとき、**`state.portInfo`** がアクティブポートの `SerialPort.getInfo()` スナップショットの canonical source です。TypeScript の narrowing により、存在が型で保証されます。

`portInfo$` と `getPortInfo()` は後方互換のため v3.x に残っていますが、**非推奨**で、次回 major version で削除予定です。これらは `SerialPortInfo | null` を返すため、接続状態とポート情報の関係を型で表現できません。

### v2 / 旧パターン（非推奨）

```typescript
session.portInfo$.subscribe((portInfo) => {
  if (portInfo) {
    console.log(portInfo);
  }
});

const snapshot = session.getPortInfo();
```

### v3 推奨パターン

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

### 移行チェックリスト

- [ ] `portInfo$` の購読を `state$` に置き換え、`state.status === SerialSessionStatus.Connected` のとき `state.portInfo` を参照する。
- [ ] `getPortInfo()` を `state$` の narrowing と `state.portInfo` に置き換える。
- [ ] TypeScript の `@deprecated` 警告が出たら、上記パターンへ移行する。
- [ ] 新規コードとドキュメントでは `state.portInfo` を使用する。

### v3.x での互換性

- `portInfo$` と `getPortInfo()` は v3.x では引き続き利用可能です。
- ランタイム挙動は変更されません。接続中は `state.portInfo` と値が同期します。
- `errors$` は非推奨化の対象ではありません。lifecycle state ではなく、独立した error event channel です。

---

## 6. `isConnected$` の非推奨化

v3.0.0 では `state$` が discriminated union になりました。`state.status` が `SerialSessionStatus.Connected` のとき、TypeScript の narrowing により接続状態と `state.portInfo` などの state-specific データへ型安全にアクセスできます。

`isConnected$` は `Observable<boolean>` として接続の真偽値だけを返すため、discriminated union が持つ型情報を失います。後方互換のため v3.x に残っていますが、**非推奨**で、次回 major version で削除予定です。

### v2 / 旧パターン（非推奨）

```typescript
session.isConnected$.subscribe((isConnected) => {
  if (isConnected) {
    // session state is not narrowed
  }
});
```

### v3 推奨パターン（`state$` narrowing）

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    // state.portInfo and other connected fields are available
  }
});
```

### RxJS で boolean を derive する場合

```typescript
import { distinctUntilChanged, map } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

const isConnected$ = session.state$.pipe(
  map((state) => state.status === SerialSessionStatus.Connected),
  distinctUntilChanged(),
);
```

### RxJS `filter` で connected state を narrowing する場合

pipeline 内で `portInfo` など connected 専用フィールドにアクセスするには、`filter()` と `isConnectedSessionState` を組み合わせます。inline の `filter((s) => s.status === SerialSessionStatus.Connected)` では TypeScript の narrowing は行われません。

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';

session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

### Angular Signals で boolean を derive する場合

```typescript
import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

const sessionState = toSignal(session.state$);

const isConnected = computed(
  () => sessionState().status === SerialSessionStatus.Connected,
);
```

### 移行チェックリスト

- [ ] `isConnected$` の購読を `state$` に置き換え、`state.status === SerialSessionStatus.Connected` で narrowing する。
- [ ] boolean だけ必要な UI では `state$` から `map` / `computed` で derive する。
- [ ] TypeScript の `@deprecated` 警告が出たら、上記パターンへ移行する。
- [ ] 新規コードとドキュメントでは `state$` narrowing を使用する。

### v3.x での互換性

- `isConnected$` は v3.x では引き続き利用可能です。
- ランタイム挙動は変更されません。接続中は `state.status === SerialSessionStatus.Connected` と値が同期します。
- framework-specific convenience state は framework adapter / example 側で `state$` から derive してください。

---

## 7. `getCurrentPort()` の削除

`SerialSession.getCurrentPort()` は raw `SerialPort` を返す escape hatch でした。利用者が `port.close()` や `writable.getWriter()` を直接呼び出すと、session が管理する lifecycle と競合し、internal runtime invariant を破壊する可能性がありました。

利用状況監査（[#437](https://github.com/gurezo/web-serial-rxjs/issues/437)）の結果、本リポジトリ内のライブラリ・example コードに `getCurrentPort()` の実利用はなく、デバイス識別は `state.portInfo` で代替可能と判断し、**public API から削除**しました。

### 監査結果

| 区分 | 結果 |
| --- | --- |
| ライブラリ本番コード | `getCurrentPort()` の呼び出しなし |
| example アプリ | テスト mock のみ |
| デバイス識別の代替 | `state$` narrowing 後の `state.portInfo`（canonical） |
| signals（DTR/RTS 等） | 現時点で代替 API なし（将来の feature addition として検討） |

### 旧パターン（削除済み）

```typescript
const port = session.getCurrentPort();
if (port) {
  console.log(port.getInfo());
}
```

### 推奨パターン（デバイス識別）

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

### signals 等の native Web Serial operation

`getSignals()` / `setSignals()` など、raw port 経由でのみ可能だった操作には現時点で `SerialSession` 上の代替 API がありません。必要になった場合は別 Issue で first-class API の追加を検討します。

### 移行チェックリスト

- [ ] `getCurrentPort()` の呼び出しを削除する。
- [ ] デバイス識別は `state$` を `SerialSessionStatus.Connected` で narrowing し `state.portInfo` を使用する。
- [ ] signals 等の native operation に依存している場合は、代替 API の追加を Issue で提案する。

---

## 8. `SerialErrorCode` runtime emission 監査

public API contract として定義されている `SerialErrorCode` のうち、一部は v3.x の runtime implementation から emit されていませんでした。到達不能な error handling を防ぐため、全 19 code の emission coverage を監査し（[#438](https://github.com/gurezo/web-serial-rxjs/issues/438)）、結果を本セクションと [API リファレンス](./API_REFERENCE.ja.md#serialerror--serialerrorcode) に反映しました。

### 分類

| 分類 | 件数 | 説明 |
| --- | --- | --- |
| **Implemented** | 17 | v3.x で runtime から emit される（または factory 時に throw される） |
| **Reserved** | 2 | public API に存在するが v3.x では emit されない。次回 major version で削除予定 |

### Reserved code（v3.x では emit されない）

| Code | 理由 | 代替 |
| --- | --- | --- |
| `PORT_NOT_AVAILABLE` | 現行実装は `navigator.serial.requestPort` のみ使用。`getPorts` 系 API 未実装のため emit 経路がない | ポート取得失敗は `PORT_OPEN_FAILED` または `OPERATION_CANCELLED` を参照 |
| `OPERATION_TIMEOUT` | timeout / prompt detection / transaction API が未実装 | 該当なし（将来 API 追加時に再評価） |

v3.x では `@deprecated` 注記のみ付与し、runtime 値と export は維持します。削除は次回 major version に集約します。

### Implemented code 一覧

| Code | emit 箇所 | fatal / non-fatal | `context` | テスト |
| --- | --- | --- | --- | --- |
| `BROWSER_NOT_SUPPORTED` | `connect$`（`navigator.serial` なし） | non-fatal | `undefined` | 統合 |
| `PORT_OPEN_FAILED` | `connect$`（`port.open()` reject） | fatal | `{ cause }` | 統合 |
| `PORT_ALREADY_OPEN` | `connect$`（`'idle'` / `'error'` 以外） | non-fatal | `undefined` | 統合 |
| `PORT_NOT_OPEN` | `send$` / `disconnect$`（不正状態） | non-fatal | `undefined` | 統合 |
| `READ_FAILED` | read pump エラー | fatal | `{ cause }` | 統合 |
| `WRITE_FAILED` | `send$` 書き込み失敗 | non-fatal | `{ cause }` | 統合 |
| `CONNECTION_LOST` | `port.close()` 失敗 / ストリーム切断 | fatal | `{ cause }` | 統合 |
| `INVALID_FILTER_OPTIONS` | `createSerialSession` factory | throw | `undefined` | 単体 + 統合 |
| `OPERATION_CANCELLED` | `requestPort` ダイアログキャンセル | fatal | `{ cause }` | 統合 |
| `LINE_BUFFER_OVERFLOW` | `lines$` tail 超過 | non-fatal | `{ maxChars }` | 統合 |
| `INVALID_RECEIVE_REPLAY_OPTIONS` | factory | throw | `undefined` | 単体 + 統合 |
| `INVALID_TERMINAL_BUFFER_OPTIONS` | factory | throw | `undefined` | 単体 |
| `INVALID_LINE_BUFFER_OPTIONS` | factory | throw | `undefined` | 単体 |
| `INVALID_CONNECTION_OPTIONS` | factory | throw | `undefined` | 単体 + 統合 |
| `RECEIVE_REPLAY_BUFFER_OVERFLOW` | `receiveReplay$` 超過 | non-fatal | `{ maxChars, bufferSize }` | 統合 |
| `SESSION_DISPOSED` | `dispose$` 後の `connect$` / `send$` | fatal | `undefined` | 統合 |
| `UNKNOWN` | dispose / disconnect の分類不能 fallback | fatal | `{ cause }` | 単体 |

fatal / non-fatal の判定は `reportError` 経由の `ERROR_SEVERITY` に従います。factory throw の `INVALID_*` code は `reportError` を通らず、呼び出し元に直接 throw されます。

### 移行チェックリスト

- [ ] `PORT_NOT_AVAILABLE` / `OPERATION_TIMEOUT` 向けの error handling を削除する（v3.x では到達しない）。
- [ ] ポート取得失敗は `PORT_OPEN_FAILED` / `OPERATION_CANCELLED` で処理する。
- [ ] 全 code の emit 条件は [API リファレンス – SerialError / SerialErrorCode](./API_REFERENCE.ja.md#serialerror--serialerrorcode) を参照する。

### 後続作業

validation error（`INVALID_*`）への structured context 追加は [#439](https://github.com/gurezo/web-serial-rxjs/issues/439) で実施予定です。

---

## 関連ドキュメント

- [v1 から v2 への移行](./MIGRATION_V2.ja.md)
- [API リファレンス – SerialSessionState / SerialSessionStatus](./API_REFERENCE.ja.md#serialsessionstate--serialsessionstatus)
- [API リファレンス – SerialError / SerialErrorCode](./API_REFERENCE.ja.md#serialerror--serialerrorcode)
- [API リファレンス – dispose$ / destroy$](./API_REFERENCE.ja.md#dispose-observablevoid)
- [API リファレンス – portInfo$ / getPortInfo()](./API_REFERENCE.ja.md#portinfo-observableserialportinfo--null)
- [API リファレンス – isConnected$](./API_REFERENCE.ja.md#isconnected-observableboolean)

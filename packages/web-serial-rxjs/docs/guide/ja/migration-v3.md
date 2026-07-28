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

## Phase 1 API 削除

[#472](https://github.com/gurezo/web-serial-rxjs/issues/472) の Phase 1 では、重複・escape hatch な API を削除し、ライフサイクルと破棄の正規情報源を `state$` と `dispose$()` に統一しました。ドキュメント整備は [#478](https://github.com/gurezo/web-serial-rxjs/issues/478) です。

| 削除 API | 移行先 |
| --- | --- |
| `destroy$()` | `dispose$()` |
| `isConnected$` | `state$` の `state.status`（または `state$` から boolean を derive） |
| `portInfo$` | `state.status === SerialSessionStatus.Connected` 時の `state.portInfo` |
| `getPortInfo()` | 同上（Connected 時の `state.portInfo`） |
| `getCurrentPort()` | 直接の代替なし。識別は `state.portInfo`。生の `SerialPort` は公開しない |

詳細: [§4](#4-の削除)、[§5](#5-の削除)、[§6](#6-の削除)、[§7](#7-の削除)。

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
- [ ] `connected` 時は `state.portInfo` を利用する（`portInfo$` と `getPortInfo()` は削除済み — [§5](#5-の削除) を参照）。
- [ ] `error` 時は `state.error` を利用（fatal error は `errors$` と同一インスタンス）。

### 変更なし

- `errors$` は独立した error event channel として引き続き利用可能です。
- ライフサイクル convenience API（`portInfo$`、`getPortInfo()`、`isConnected$`、`destroy$()`）は **削除済み** です — [§4](#4-の削除)–[§6](#6-の削除) で移行してください。

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

## 4. `destroy$()` の削除

`destroy$()` は `dispose$()` の legacy エイリアスでした。lifecycle terminology（`dispose`、`disposed`、`SESSION_DISPOSED`）はすでに **`dispose$`** を canonical API として使用していました。Phase 1（[#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)）で公開 API から **削除**し、セッション破棄の入口を一本化しました。

### 旧パターン（削除済み）

```typescript
session.destroy$().subscribe({
  complete: () => console.log('session destroyed'),
});
```

### 推奨パターン

```typescript
session.dispose$().subscribe({
  complete: () => console.log('session disposed'),
});
```

### 移行チェックリスト

- [ ] `session.destroy$()` を `session.dispose$()` に置き換える。
- [ ] 新規コードとドキュメントでは `dispose$` を使用する。

### エイリアスを残さない理由

同じ処理に二つの名前があると、利用者がどちらを使うべきか判断を迫られ、ドキュメントとテストも二重になります。破棄 API は `dispose$()` のみです。

---

## 5. `portInfo$` / `getPortInfo()` の削除

v3.0.0 では `state$` が discriminated union になりました。`state.status` が `SerialSessionStatus.Connected` のとき、**`state.portInfo`** がアクティブポートの `SerialPort.getInfo()` スナップショットの canonical source です。TypeScript の narrowing により、存在が型で保証されます。

`portInfo$` と `getPortInfo()` は `SerialPortInfo | null` を返すため、接続状態とポート情報の関係を型で表現できませんでした。Phase 1 で両方を **削除**しました（[#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)）。

### 旧パターン（削除済み）

```typescript
session.portInfo$.subscribe((portInfo) => {
  if (portInfo) {
    console.log(portInfo);
  }
});

const snapshot = session.getPortInfo();
```

### 推奨パターン

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
- [ ] 新規コードとドキュメントでは `state.portInfo` を使用する。

### 補足

- `errors$` は lifecycle state の重複ではありません。独立した error event channel として残ります。

---

## 6. `isConnected$` の削除

v3.0.0 では `state$` が discriminated union になりました。`state.status` が `SerialSessionStatus.Connected` のとき、TypeScript の narrowing により接続状態と `state.portInfo` などの state-specific データへ型安全にアクセスできます。

`isConnected$` は `Observable<boolean>` として接続の真偽値だけを返すため、discriminated union が持つ型情報を失い、`idle` / `connecting` / `disconnecting` / `error` / `disposed` を区別できませんでした。Phase 1 で **削除**しました（[#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)）。

### 旧パターン（削除済み）

```typescript
session.isConnected$.subscribe((isConnected) => {
  if (isConnected) {
    // session state is not narrowed
  }
});
```

### 推奨パターン（`state$` narrowing）

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

上記のローカル `isConnected$` は **`state$` からアプリ側で derive したもの**であり、`SerialSession` のメンバーではありません。

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
- [ ] 新規コードとドキュメントでは `state$` narrowing を使用する。

---

## 7. `getCurrentPort()` の削除

`SerialSession.getCurrentPort()` は raw `SerialPort` を返す escape hatch でした。利用者が `port.close()` や `writable.getWriter()` を直接呼び出すと、session が管理する lifecycle と競合し、internal runtime invariant を破壊する可能性がありました。**直接の代替 API はありません** — ライブラリ管理下の `SerialPort` を公開せず、セッション I/O の迂回を防ぎます。

利用状況監査（[#437](https://github.com/gurezo/web-serial-rxjs/issues/437)）の結果、本リポジトリ内のライブラリ・example コードに `getCurrentPort()` の実利用はなく、デバイス識別は `state.portInfo` で代替可能と判断し、**public API から削除**しました（[#448](https://github.com/gurezo/web-serial-rxjs/pull/448)）。Phase 1 の親 Issue [#472](https://github.com/gurezo/web-serial-rxjs/issues/472) / 子 Issue [#474](https://github.com/gurezo/web-serial-rxjs/issues/474) でも、同じ削除方針を完了条件として追跡しています。

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

public API contract として定義されている `SerialErrorCode` のうち、一部は v3.x の runtime implementation から emit されていませんでした。到達不能な error handling を防ぐため、全 19 code の emission coverage を監査し（[#438](https://github.com/gurezo/web-serial-rxjs/issues/438)）、結果を本セクションと [概念と設計メモ](./concepts.md#serialerror--serialerrorcode) に反映しました。

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
| `INVALID_FILTER_OPTIONS` | `createSerialSession` factory | throw | `ValidationErrorContext` | 単体 + 統合 |
| `OPERATION_CANCELLED` | `requestPort` ダイアログキャンセル | fatal | `{ cause }` | 統合 |
| `LINE_BUFFER_OVERFLOW` | `lines$` tail 超過 | non-fatal | `{ maxChars }` | 統合 |
| `INVALID_RECEIVE_REPLAY_OPTIONS` | factory | throw | `ValidationErrorContext` | 単体 + 統合 |
| `INVALID_TERMINAL_BUFFER_OPTIONS` | factory | throw | `ValidationErrorContext` | 単体 |
| `INVALID_LINE_BUFFER_OPTIONS` | factory | throw | `ValidationErrorContext` | 単体 |
| `INVALID_CONNECTION_OPTIONS` | factory | throw | `ValidationErrorContext` | 単体 + 統合 |
| `RECEIVE_REPLAY_BUFFER_OVERFLOW` | `receiveReplay$` 超過 | non-fatal | `{ maxChars, bufferSize }` | 統合 |
| `SESSION_DISPOSED` | `dispose$` 後の `connect$` / `send$` | fatal | `undefined` | 統合 |
| `UNKNOWN` | dispose / disconnect の分類不能 fallback | fatal | `{ cause }` | 単体 |

fatal / non-fatal の判定は `reportError` 経由の `ERROR_SEVERITY` に従います。factory throw の `INVALID_*` code は `reportError` を通らず、呼び出し元に直接 throw されます。

### 移行チェックリスト

- [ ] `PORT_NOT_AVAILABLE` / `OPERATION_TIMEOUT` 向けの error handling を削除する（v3.x では到達しない）。
- [ ] ポート取得失敗は `PORT_OPEN_FAILED` / `OPERATION_CANCELLED` で処理する。
- [ ] 全 code の emit 条件は [概念と設計メモ – SerialError / SerialErrorCode](./concepts.md#serialerror--serialerrorcode) を参照する。

### 後続作業

validation error（`INVALID_*`）への structured context 追加は [#439](https://github.com/gurezo/web-serial-rxjs/issues/439) で実施済みです。`message` のパースではなく `ValidationErrorContext`（`field`、`value`、`constraint`、任意の `filterIndex`）を利用してください。

---

## 9. `assertNever` public export 監査

`assertNever` は exhaustive switch checking 用の TypeScript utility です。package internal の exhaustiveness helper として追加されましたが（[#394](https://github.com/gurezo/web-serial-rxjs/issues/394) / PR #410）、public export としても公開されていました。Web Serial / SerialSession domain API ではないため、利用状況を監査し（[#440](https://github.com/gurezo/web-serial-rxjs/issues/440)）、結果を本セクションと [概念と設計メモ](./concepts.md#deprecated-exports) に反映しました。

### 監査結果

| 確認項目 | 結果 |
| --- | --- |
| package internal usage | `session-runtime.ts` のみ（`assertNeverRuntime` 経由） |
| examples usage | `apps/` / `libs/` に利用なし |
| documentation usage | canonical export 一覧（API_REFERENCE）に未掲載。MIGRATION ドキュメントにも未記載 |
| 公開履歴 | Phase A（#394）で `src/internal/assert-never.ts` として追加、`index.ts` から re-export |

### 判断

`assertNever` は内部実装用 utility であり、canonical public API ではありません。`SerialSessionState` の exhaustive handling は `switch (state.status)` + `SerialSessionStatus`、または `isConnectedSessionState` による narrowing が推奨パターンです。

v3.x では `@deprecated` 注記のみ付与し、public export は維持します。削除は次回 major version に集約します。

### v2 / 旧パターン（非推奨）

```typescript
import { assertNever } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  switch (state.status) {
    case SerialSessionStatus.Connected:
      console.log(state.portInfo);
      break;
    default:
      assertNever(state);
  }
});
```

### v3 推奨パターン

`switch (state.status)` で全 case を網羅するか、RxJS では `filter(isConnectedSessionState)` で narrowing してください。exhaustiveness helper が必要な場合はアプリケーション側でローカル helper を定義します。

```typescript
import {
  SerialSessionStatus,
  isConnectedSessionState,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';

function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}

session.state$.subscribe((state: SerialSessionState) => {
  switch (state.status) {
    case SerialSessionStatus.Connected:
      console.log(state.portInfo);
      break;
    case SerialSessionStatus.Idle:
    case SerialSessionStatus.Connecting:
    case SerialSessionStatus.Disconnecting:
    case SerialSessionStatus.Unsupported:
    case SerialSessionStatus.Error:
    case SerialSessionStatus.Disposed:
      break;
    default:
      assertNever(state);
  }
});
```

### 移行チェックリスト

- [ ] `@gurezo/web-serial-rxjs` からの `assertNever` import を削除する。
- [ ] exhaustive handling が必要ならローカル helper を定義する。
- [ ] `SerialSessionState` の分岐は `switch (state.status)` + `SerialSessionStatus` を優先する。
- [ ] TypeScript の `@deprecated` 警告が出たら、上記パターンへ移行する。

### v3.x での互換性

`assertNever` は v3.x では引き続き public export から利用可能です。次回 major version で削除予定です。

---

## 10. Session options 型責務監査

`SerialSessionOptions` は W3C `SerialOptions` 由来の connection fields と、`web-serial-rxjs` 固有の session feature options を 1 つの型として公開しています。TypeScript-first の domain model 整理の一環として、public type と generated documentation の表示を監査しました（[#441](https://github.com/gurezo/web-serial-rxjs/issues/441)）。

### 監査結果

| 確認項目 | 結果 |
| --- | --- |
| existing assignability | 既存の `createSerialSession({ ... })` 呼び出しは問題なし |
| generated `.d.ts` | public `SerialConnectionOptions` と internal `SerialSessionConnectionFields` が同一 Pick で重複 |
| TypeDoc readability | connection / feature fields が 1 つの flat list に混在し、hierarchy が internal 型名を表示 |
| readonly input compatibility | mutable 配列のまま維持。readonly 入力の assignability は regression test で確認 |
| examples | `libs/examples-shared` は `SerialConnectionOptions['baudRate']` を既に利用。example apps の変更は不要 |
| W3C `SerialOptions` drift detection | connection fields は `SerialConnectionOptions` 経由で W3C 型から Pick。分離後も維持 |

### 判断

型安全性に問題はありませんが、責務分離と TypeDoc 可読性の改善のため、以下の型モデルを canonical とします。

```text
SerialConnectionOptions     = port.open 用 W3C connection parameters
SerialSessionFeatureOptions = library-specific session features
SerialSessionOptions        = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

- `SerialConnectionOptions` — `baudRate`, `dataBits`, `stopBits`, `parity`, `bufferSize`, `flowControl`（`port.open` に渡される）
- `SerialSessionFeatureOptions` — `filters`, `terminalBuffer`, `lineBuffer`（library-specific。`receiveReplay` は v4 Phase 2 で削除）
- `SerialSessionOptions` — 上記 2 つの composition（factory 引数）

詳細は [概念と設計メモ – SerialSessionOptions](./concepts.md#serialsessionoptions) を参照してください。境界値の意味（バッファ上限のみ `0` = 無制限、接続フィールドは `> 0` 必須）も同ページに記載しています（[#488](https://github.com/gurezo/web-serial-rxjs/issues/488)）。

### v3.x での互換性

`createSerialSession(options?)` のシグネチャと、既存の options オブジェクトリテラルは **変更不要** です。`SerialSessionFeatureOptions` は新規 public export として追加されます。

---

## 関連ドキュメント

- [v1 から v2 への移行](./migration-v2.md)
- [概念と設計メモ – SerialSessionState / SerialSessionStatus](./concepts.md#serialsessionstate--serialsessionstatus)
- [概念と設計メモ – SerialError / SerialErrorCode](./concepts.md#serialerror--serialerrorcode)
- [概念と設計メモ – dispose$ / state$](./concepts.md#serialsession)
- [概念と設計メモ – Deprecated exports](./concepts.md#deprecated-exports)
- [概念と設計メモ – SerialSessionOptions](./concepts.md#serialsessionoptions)

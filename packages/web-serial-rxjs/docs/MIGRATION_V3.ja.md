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
- [ ] `connected` 時は `state.portInfo` を利用（任意 — `portInfo$` も引き続き利用可能）。
- [ ] `error` 時は `state.error` を利用（fatal error は `errors$` と同一インスタンス）。

### 変更なし

- `portInfo$`、`getPortInfo()`、`errors$`、`isConnected$` は引き続き利用可能。
- `isConnected$` は内部で connected 状態から派生します。

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

## 関連ドキュメント

- [v1 から v2 への移行](./MIGRATION_V2.ja.md)
- [API リファレンス – SerialSessionState / SerialSessionStatus](./API_REFERENCE.ja.md#serialsessionstate--serialsessionstatus)
- [API リファレンス – SerialError / SerialErrorCode](./API_REFERENCE.ja.md#serialerror--serialerrorcode)

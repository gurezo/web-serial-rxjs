# Migrating to v3

v3 introduces two TypeScript-facing breaking changes:

1. **`SerialErrorCode`** — `enum` → const object + union type (runtime values unchanged).
2. **`state$` payload** — flat string → discriminated union with per-status detail.

This guide covers both. Runtime string values for error codes are unchanged (`SerialErrorCode.READ_FAILED` is still `'READ_FAILED'`).

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

### What changed

| v2 | v3 |
| --- | --- |
| `export enum SerialErrorCode { ... }` | `export const SerialErrorCode = { ... } as const` + `export type SerialErrorCode` |
| TypeDoc: `enums/SerialErrorCode.html` | TypeDoc: `variables/SerialErrorCode.html` |

### No migration needed (typical patterns)

- `SerialErrorCode.BROWSER_NOT_SUPPORTED` (and any other member)
- `error.code === SerialErrorCode.WRITE_FAILED`
- `error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)` with narrowed `context`
- `switch (error.code) { case SerialErrorCode.READ_FAILED: ... }`

### When you may need to update

- **Type-only imports** — continue using `import type { SerialErrorCode } from '@gurezo/web-serial-rxjs'`.
- **TypeDoc deep links** — update bookmarks from `enums/SerialErrorCode.html` to `variables/SerialErrorCode.html`.
- **Tools parsing `.d.ts`** — declaration shape changes from `enum` to `const` + type alias.

---

## 2. Discriminated union `state$`

### What changed

| v2 | v3 |
| --- | --- |
| `state$: Observable<'idle' \| 'connected' \| ...>` | `state$: Observable<SerialSessionState>` (discriminated union) |
| `SerialSessionState` const (string literals) | **`SerialSessionStatus`** const (string literals) |
| Compare `state === SerialSessionState.Connected` | Compare `state.status === SerialSessionStatus.Connected` |
| Correlate `state$` + `portInfo$` / `errors$` manually | `connected` carries `portInfo`; `error` carries `SerialError` |

### v2 (before)

```typescript
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state === SerialSessionState.Connected) {
    session.getPortInfo(); // separate call
  }
});
```

### v3 (after)

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

### Type shape

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

### Migration checklist

- [ ] Replace `import { SerialSessionState }` used as **constants** with `SerialSessionStatus`.
- [ ] Replace `state === SerialSessionState.X` with `state.status === SerialSessionStatus.X`.
- [ ] Replace `switch (state)` with `switch (state.status)` (or compare `state.status` in `if`).
- [ ] Use `state.portInfo` when `state.status === SerialSessionStatus.Connected` (recommended — `portInfo$` and `getPortInfo()` are deprecated).
- [ ] Use `state.error` when `state.status === 'error'` (same instance as `errors$` for fatal errors).

### Unchanged

- `errors$` remains available.
- `portInfo$` and `getPortInfo()` remain available in v3.x but are **deprecated** (see [§5](#5-portinfo--getportinfo-deprecation)).
- `isConnected$` remains available in v3.x but is **deprecated** (see [§6](#6-isconnected-deprecation)).

---

## 3. `originalError` deprecation

v3.0.0 introduced typed `SerialError.context`. For cause-bearing error codes, **`context.cause`** is the canonical source for the underlying failure.

`SerialError.originalError` and the legacy constructor third argument remain in v3.x for backward compatibility but are **deprecated** and scheduled for removal in the next major version.

### v2 / legacy pattern (deprecated)

```typescript
session.errors$.subscribe((error) => {
  if (error.code === SerialErrorCode.READ_FAILED) {
    console.error(error.originalError);
  }
});
```

### v3 recommended pattern

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    // error.context.cause is unknown — non-Error throws are preserved
    console.error(error.context.cause);
  }
});
```

### Migration checklist

- [ ] Replace `error.originalError` with `error.context.cause` (narrow with `error.is(code)` first).
- [ ] If you construct errors with `new SerialError(code, message, cause)`, switch to `new SerialError(code, message, undefined, { cause })`.
- [ ] Address TypeScript `@deprecated` warnings by migrating to the patterns above.

### Compatibility in v3.x

- `originalError` remains available in v3.x.
- When `context.cause` is an `Error` instance, `originalError` is kept in sync for legacy callers.
- `context.cause` is typed as `unknown` because JavaScript allows throwing non-`Error` values.

---

## 4. `destroy$` deprecation

`SerialSession` exposes both `dispose$()` and `destroy$()`. They are the same function — `destroy$` is a legacy alias. Lifecycle terminology (`dispose`, `disposed`, `SESSION_DISPOSED`) already uses **`dispose$`** as the canonical API.

`destroy$()` remains in v3.x for backward compatibility but is **deprecated** and scheduled for removal in the next major version.

### v2 / legacy pattern (deprecated)

```typescript
session.destroy$().subscribe({
  complete: () => console.log('session destroyed'),
});
```

### v3 recommended pattern

```typescript
session.dispose$().subscribe({
  complete: () => console.log('session disposed'),
});
```

### Migration checklist

- [ ] Replace `session.destroy$()` with `session.dispose$()`.
- [ ] Address TypeScript `@deprecated` warnings by migrating to `dispose$`.
- [ ] Prefer `dispose$` in new code and documentation.

### Compatibility in v3.x

- `destroy$` remains available in v3.x and delegates to the same implementation as `dispose$`.
- Runtime behavior is unchanged; only the alias is deprecated.

---

## 5. `portInfo$` / `getPortInfo()` deprecation

v3.0.0 made `state$` a discriminated union. When `state.status` is `SerialSessionStatus.Connected`, **`state.portInfo`** is the canonical source for the active port's `SerialPort.getInfo()` snapshot — TypeScript narrowing guarantees it is present.

`portInfo$` and `getPortInfo()` remain in v3.x for backward compatibility but are **deprecated** and scheduled for removal in the next major version. They expose `SerialPortInfo | null`, which does not encode the relationship between connection state and port information.

### v2 / legacy pattern (deprecated)

```typescript
session.portInfo$.subscribe((portInfo) => {
  if (portInfo) {
    console.log(portInfo);
  }
});

const snapshot = session.getPortInfo();
```

### v3 recommended pattern

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

### Migration checklist

- [ ] Replace `portInfo$` subscriptions with `state$` and read `state.portInfo` when `state.status === SerialSessionStatus.Connected`.
- [ ] Replace `getPortInfo()` with `state$` narrowing and `state.portInfo`.
- [ ] Address TypeScript `@deprecated` warnings by migrating to the pattern above.
- [ ] Prefer `state.portInfo` in new code and documentation.

### Compatibility in v3.x

- `portInfo$` and `getPortInfo()` remain available in v3.x.
- Runtime behavior is unchanged; values stay in sync with `state.portInfo` while connected.
- `errors$` is not deprecated — it is an independent error event channel, not a duplicate of lifecycle state.

---

## 6. `isConnected$` deprecation

v3.0.0 made `state$` a discriminated union. When `state.status` is `SerialSessionStatus.Connected`, TypeScript narrowing gives type-safe access to `state.portInfo` and other state-specific fields.

`isConnected$` is an `Observable<boolean>` that only projects whether the session is connected, so it loses the type information carried by the discriminated union. It remains in v3.x for backward compatibility but is **deprecated** and scheduled for removal in the next major version.

### v2 / legacy pattern (deprecated)

```typescript
session.isConnected$.subscribe((isConnected) => {
  if (isConnected) {
    // session state is not narrowed
  }
});
```

### v3 recommended pattern (`state$` narrowing)

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    // state.portInfo and other connected fields are available
  }
});
```

### Deriving a boolean with RxJS

```typescript
import { distinctUntilChanged, map } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

const isConnected$ = session.state$.pipe(
  map((state) => state.status === SerialSessionStatus.Connected),
  distinctUntilChanged(),
);
```

### RxJS `filter` with connected-state narrowing

When you need `portInfo` or other connected-only fields inside a pipeline, use `isConnectedSessionState` with `filter()`. Inline `filter((s) => s.status === SerialSessionStatus.Connected)` does not narrow types in TypeScript.

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';

session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

### Deriving a boolean with Angular Signals

```typescript
import { computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

const sessionState = toSignal(session.state$);

const isConnected = computed(
  () => sessionState().status === SerialSessionStatus.Connected,
);
```

### Migration checklist

- [ ] Replace `isConnected$` subscriptions with `state$` and narrow on `state.status === SerialSessionStatus.Connected`.
- [ ] When you only need a boolean for UI, derive it from `state$` with `map` or `computed`.
- [ ] Address TypeScript `@deprecated` warnings by migrating to the patterns above.
- [ ] Prefer `state$` narrowing in new code and documentation.

### Compatibility in v3.x

- `isConnected$` remains available in v3.x.
- Runtime behavior is unchanged; values stay in sync with `state.status === SerialSessionStatus.Connected`.
- Framework-specific convenience state should be derived from `state$` in framework adapters and examples.

---

## See also

- [Migrating from v1 to v2](./MIGRATION_V2.md)
- [API Reference – SerialSessionState / SerialSessionStatus](./API_REFERENCE.md#serialsessionstate--serialsessionstatus)
- [API Reference – SerialError / SerialErrorCode](./API_REFERENCE.md#serialerror--serialerrorcode)
- [API Reference – dispose$ / destroy$](./API_REFERENCE.md#dispose-observablevoid)
- [API Reference – portInfo$ / getPortInfo()](./API_REFERENCE.md#portinfo-observableserialportinfo--null)
- [API Reference – isConnected$](./API_REFERENCE.md#isconnected-observableboolean)

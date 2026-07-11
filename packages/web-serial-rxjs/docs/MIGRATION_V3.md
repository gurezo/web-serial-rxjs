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
- [ ] Use `state.portInfo` when `state.status === 'connected'` instead of correlating `portInfo$` (optional — `portInfo$` still works).
- [ ] Use `state.error` when `state.status === 'error'` (same instance as `errors$` for fatal errors).

### Unchanged

- `portInfo$`, `getPortInfo()`, `errors$`, and `isConnected$` remain available.
- `isConnected$` still derives from connected status internally.

---

## See also

- [Migrating from v1 to v2](./MIGRATION_V2.md)
- [API Reference – SerialSessionState / SerialSessionStatus](./API_REFERENCE.md#serialsessionstate--serialsessionstatus)
- [API Reference – SerialError / SerialErrorCode](./API_REFERENCE.md#serialerror--serialerrorcode)

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

## Phase 1 API removals

Phase 1 of [#472](https://github.com/gurezo/web-serial-rxjs/issues/472) removed duplicate / escape-hatch APIs so `state$` and `dispose$()` are the only public sources for lifecycle and teardown. See [#478](https://github.com/gurezo/web-serial-rxjs/issues/478) for the documentation pass.

| Removed API | Replacement |
| --- | --- |
| `destroy$()` | `dispose$()` |
| `isConnected$` | `state$` with `state.status` (or derive a boolean from `state$`) |
| `portInfo$` | `state.portInfo` when `state.status === SerialSessionStatus.Connected` |
| `getPortInfo()` | `state.portInfo` when connected (same as above) |
| `getCurrentPort()` | No direct replacement. Use `state.portInfo` for identification; raw `SerialPort` is not exposed |

Details: [§4](#4-removal), [§5](#5-removal), [§6](#6-removal), [§7](#7-removal).

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
- [ ] Use `state.portInfo` when `state.status === SerialSessionStatus.Connected` (`portInfo$` and `getPortInfo()` were removed — see [§5](#5-removal)).
- [ ] Use `state.error` when `state.status === 'error'` (same instance as `errors$` for fatal errors).

### Unchanged

- `errors$` remains available as the independent error event channel.
- Lifecycle convenience APIs (`portInfo$`, `getPortInfo()`, `isConnected$`, `destroy$()`) are **removed** — migrate with [§4](#4-removal)–[§6](#6-removal).

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

## 4. `destroy$()` removal

`destroy$()` was a legacy alias of `dispose$()`. Lifecycle terminology (`dispose`, `disposed`, `SESSION_DISPOSED`) already used **`dispose$`** as the canonical API. Phase 1 ([#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)) **removed** `destroy$()` from the public API so session teardown has a single entry point.

### Old pattern (removed)

```typescript
session.destroy$().subscribe({
  complete: () => console.log('session destroyed'),
});
```

### Recommended pattern

```typescript
session.dispose$().subscribe({
  complete: () => console.log('session disposed'),
});
```

### Migration checklist

- [ ] Replace `session.destroy$()` with `session.dispose$()`.
- [ ] Prefer `dispose$` in new code and documentation.

### Why there is no alias

Keeping both names forced callers to choose between equivalent APIs and kept docs / tests dual. `dispose$()` is the only teardown method.

---

## 5. `portInfo$` / `getPortInfo()` removal

v3.0.0 made `state$` a discriminated union. When `state.status` is `SerialSessionStatus.Connected`, **`state.portInfo`** is the canonical source for the active port's `SerialPort.getInfo()` snapshot — TypeScript narrowing guarantees it is present.

`portInfo$` and `getPortInfo()` exposed `SerialPortInfo | null`, which did not encode the relationship between connection state and port information. Phase 1 **removed** both APIs ([#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)).

### Old pattern (removed)

```typescript
session.portInfo$.subscribe((portInfo) => {
  if (portInfo) {
    console.log(portInfo);
  }
});

const snapshot = session.getPortInfo();
```

### Recommended pattern

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
- [ ] Prefer `state.portInfo` in new code and documentation.

### Notes

- `errors$` is not a duplicate of lifecycle state — it remains the independent error event channel.

---

## 6. `isConnected$` removal

v3.0.0 made `state$` a discriminated union. When `state.status` is `SerialSessionStatus.Connected`, TypeScript narrowing gives type-safe access to `state.portInfo` and other state-specific fields.

`isConnected$` was an `Observable<boolean>` that only projected whether the session was connected, so it lost the type information carried by the discriminated union and could not distinguish `idle` / `connecting` / `disconnecting` / `error` / `disposed`. Phase 1 **removed** it ([#473](https://github.com/gurezo/web-serial-rxjs/issues/473) / [#479](https://github.com/gurezo/web-serial-rxjs/pull/479)).

### Old pattern (removed)

```typescript
session.isConnected$.subscribe((isConnected) => {
  if (isConnected) {
    // session state is not narrowed
  }
});
```

### Recommended pattern (`state$` narrowing)

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

The local `isConnected$` above is **application-derived** from `state$`. It is not a `SerialSession` member.

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
- [ ] Prefer `state$` narrowing in new code and documentation.

---

## 7. `getCurrentPort()` removal

`SerialSession.getCurrentPort()` was a raw `SerialPort` escape hatch. Calling `port.close()` or `writable.getWriter()` on the returned port could conflict with the session lifecycle and break internal runtime invariants. **There is no direct replacement** — the library does not expose the managed `SerialPort` so callers cannot bypass session I/O.

A usage audit ([#437](https://github.com/gurezo/web-serial-rxjs/issues/437)) found no production callers in this repository. Device identification is covered by `state.portInfo`, so **`getCurrentPort()` has been removed** from the public API ([#448](https://github.com/gurezo/web-serial-rxjs/pull/448)). Phase 1 parent issue [#472](https://github.com/gurezo/web-serial-rxjs/issues/472) / child issue [#474](https://github.com/gurezo/web-serial-rxjs/issues/474) also track this removal as a completion criterion.

### Audit results

| Area | Finding |
| --- | --- |
| Library production code | No `getCurrentPort()` callers |
| Example apps | Test mocks only |
| Device identification alternative | `state.portInfo` after `state$` narrowing (canonical) |
| Signals (DTR/RTS, etc.) | No replacement API yet (future feature addition) |

### Old pattern (removed)

```typescript
const port = session.getCurrentPort();
if (port) {
  console.log(port.getInfo());
}
```

### Recommended pattern (device identification)

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

### Native Web Serial operations (signals, etc.)

Operations such as `getSignals()` / `setSignals()` that previously required a raw port have no `SerialSession` replacement yet. If you need them, open a separate issue to propose first-class APIs.

### Migration checklist

- [ ] Remove all `getCurrentPort()` calls.
- [ ] Use `state$` narrowed on `SerialSessionStatus.Connected` and read `state.portInfo` for device identification.
- [ ] If you depend on signals or other native operations, request a dedicated API via an issue.

---

## 8. `SerialErrorCode` runtime emission audit

Some members of the public `SerialErrorCode` contract were not emitted by the v3.x runtime. To prevent unreachable error-handling branches, all 19 codes were audited ([#438](https://github.com/gurezo/web-serial-rxjs/issues/438)) and the results are recorded here and in the [API Reference](./concepts.md#serialerror--serialerrorcode).

### Classification

| Category | Count | Description |
| --- | --- | --- |
| **Implemented** | 17 | Emitted at runtime in v3.x (or thrown at factory time) |
| **Reserved** | 2 | Present in the public API but not emitted in v3.x; scheduled for removal in the next major version |

### Reserved codes (not emitted in v3.x)

| Code | Reason | Alternative |
| --- | --- | --- |
| `PORT_NOT_AVAILABLE` | Current implementation uses only `navigator.serial.requestPort`; no `getPorts` API path exists | Use `PORT_OPEN_FAILED` or `OPERATION_CANCELLED` for port acquisition failures |
| `OPERATION_TIMEOUT` | No timeout / prompt detection / transaction API yet | None (revisit when a future API is added) |

v3.x adds `@deprecated` annotations only; runtime values and exports are unchanged. Removal is deferred to the next major version.

### Implemented codes

| Code | Emit location | fatal / non-fatal | `context` | Tests |
| --- | --- | --- | --- | --- |
| `BROWSER_NOT_SUPPORTED` | `connect$` (no `navigator.serial`) | non-fatal | `undefined` | integration |
| `PORT_OPEN_FAILED` | `connect$` (`port.open()` reject) | fatal | `{ cause }` | integration |
| `PORT_ALREADY_OPEN` | `connect$` (not in `'idle'` / `'error'`) | non-fatal | `undefined` | integration |
| `PORT_NOT_OPEN` | `send$` / `disconnect$` (invalid state) | non-fatal | `undefined` | integration |
| `READ_FAILED` | read pump error | fatal | `{ cause }` | integration |
| `WRITE_FAILED` | `send$` write failure | non-fatal | `{ cause }` | integration |
| `CONNECTION_LOST` | `port.close()` failure / stream drop | fatal | `{ cause }` | integration |
| `INVALID_FILTER_OPTIONS` | `createSerialSession` factory | throw | `ValidationErrorContext` | unit + integration |
| `OPERATION_CANCELLED` | `requestPort` dialog cancelled | fatal | `{ cause }` | integration |
| `LINE_BUFFER_OVERFLOW` | `lines$` tail overflow | non-fatal | `{ maxChars }` | integration |
| `INVALID_RECEIVE_REPLAY_OPTIONS` | factory | throw | `ValidationErrorContext` | unit + integration |
| `INVALID_TERMINAL_BUFFER_OPTIONS` | factory | throw | `ValidationErrorContext` | unit |
| `INVALID_LINE_BUFFER_OPTIONS` | factory | throw | `ValidationErrorContext` | unit |
| `INVALID_CONNECTION_OPTIONS` | factory | throw | `ValidationErrorContext` | unit + integration |
| `RECEIVE_REPLAY_BUFFER_OVERFLOW` | `receiveReplay$` overflow | non-fatal | `{ maxChars, bufferSize }` | integration |
| `SESSION_DISPOSED` | `connect$` / `send$` after `dispose$` | fatal | `undefined` | integration |
| `UNKNOWN` | unclassified dispose / disconnect fallback | fatal | `{ cause }` | unit |

Fatal vs non-fatal follows `ERROR_SEVERITY` inside `reportError`. Factory-thrown `INVALID_*` codes bypass `reportError` and throw directly to the caller.

### Migration checklist

- [ ] Remove error handling for `PORT_NOT_AVAILABLE` / `OPERATION_TIMEOUT` (unreachable in v3.x).
- [ ] Handle port acquisition failures with `PORT_OPEN_FAILED` / `OPERATION_CANCELLED`.
- [ ] See [API Reference – SerialError / SerialErrorCode](./concepts.md#serialerror--serialerrorcode) for per-code emit conditions.

### Follow-up

Structured context for validation errors (`INVALID_*`) was added in [#439](https://github.com/gurezo/web-serial-rxjs/issues/439). Use `ValidationErrorContext` (`field`, `value`, `constraint`, optional `filterIndex`) instead of parsing `message`.

---

## 9. `assertNever` public export audit

`assertNever` is a TypeScript utility for exhaustive switch checking. It was added as an internal exhaustiveness helper ([#394](https://github.com/gurezo/web-serial-rxjs/issues/394) / PR #410) but was also exposed as a public export. Because it is not part of the Web Serial / SerialSession domain API, usage was audited ([#440](https://github.com/gurezo/web-serial-rxjs/issues/440)) and the results are recorded here and in the [API Reference](./concepts.md#deprecated-exports).

### Audit results

| Check | Result |
| --- | --- |
| package internal usage | `session-runtime.ts` only (via `assertNeverRuntime`) |
| examples usage | none in `apps/` or `libs/` |
| documentation usage | not listed in canonical exports (API_REFERENCE); not mentioned in migration docs |
| export history | added in Phase A (#394) as `src/internal/assert-never.ts`, re-exported from `index.ts` |

### Decision

`assertNever` is an internal implementation utility, not a canonical public API. For exhaustive handling of `SerialSessionState`, prefer `switch (state.status)` with `SerialSessionStatus`, or narrowing with `isConnectedSessionState`.

v3.x adds `@deprecated` annotations only; the public export is retained. Removal is deferred to the next major version.

### Legacy pattern (deprecated)

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

### Recommended pattern

Cover all `switch (state.status)` cases, or use `filter(isConnectedSessionState)` in RxJS pipelines. If you need an exhaustiveness helper, define one locally in application code.

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

### Migration checklist

- [ ] Remove `assertNever` imports from `@gurezo/web-serial-rxjs`.
- [ ] Define a local helper if you still need exhaustiveness checking.
- [ ] Prefer `switch (state.status)` with `SerialSessionStatus` for `SerialSessionState` branches.
- [ ] Migrate when TypeScript shows `@deprecated` warnings.

### v3.x compatibility

`assertNever` remains available from the public export in v3.x. It is scheduled for removal in the next major version.

---

## 10. Session options type responsibility audit

`SerialSessionOptions` exposes W3C `SerialOptions`-derived connection fields and library-specific session feature options in a single type. As part of the TypeScript-first domain model consolidation, the public type surface and generated documentation were audited ([#441](https://github.com/gurezo/web-serial-rxjs/issues/441)).

### Audit results

| Check | Result |
| --- | --- |
| existing assignability | Existing `createSerialSession({ ... })` calls work without changes |
| generated `.d.ts` | public `SerialConnectionOptions` duplicated the internal `SerialSessionConnectionFields` Pick |
| TypeDoc readability | connection and feature fields appeared in one flat list; hierarchy showed an internal type name |
| readonly input compatibility | mutable arrays retained; readonly input assignability verified by regression tests |
| examples | `libs/examples-shared` already uses `SerialConnectionOptions['baudRate']`; example apps unchanged |
| W3C `SerialOptions` drift detection | connection fields remain a Pick from W3C types via `SerialConnectionOptions` |

### Decision

Type safety was already sound, but conceptual separation improves documentation clarity. The canonical model is:

```text
SerialConnectionOptions     = W3C connection parameters for port.open
SerialSessionFeatureOptions = library-specific session features
SerialSessionOptions        = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

- `SerialConnectionOptions` — `baudRate`, `dataBits`, `stopBits`, `parity`, `bufferSize`, `flowControl` (passed to `port.open`)
- `SerialSessionFeatureOptions` — `filters`, `receiveReplay`, `terminalBuffer`, `lineBuffer` (library-specific)
- `SerialSessionOptions` — composition of the two (factory argument)

See [API Reference – SerialSessionOptions](./concepts.md#serialsessionoptions) for details.

### v3.x compatibility

The `createSerialSession(options?)` signature and existing options object literals remain **unchanged**. `SerialSessionFeatureOptions` is added as a new public export.

---

## See also

- [Migrating from v1 to v2](./migration-v2.md)
- [API Reference – SerialSessionState / SerialSessionStatus](./concepts.md#serialsessionstate--serialsessionstatus)
- [API Reference – SerialError / SerialErrorCode](./concepts.md#serialerror--serialerrorcode)
- [API Reference – dispose$ / state$](./concepts.md#serialsession)
- [API Reference – Deprecated exports](./concepts.md#deprecated-exports)
- [API Reference – SerialSessionOptions](./concepts.md#serialsessionoptions)

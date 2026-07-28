# Migrating to v4

v4 consolidates public API cleanup from Phase 1 ([#472](https://github.com/gurezo/web-serial-rxjs/issues/472)) and Phase 2 ([#485](https://github.com/gurezo/web-serial-rxjs/issues/485)) into one major upgrade. This guide covers both phases so you can migrate once.

TypeScript-facing changes introduced in v3 (`SerialErrorCode` const object, discriminated-union `state$`) remain as documented in [Migrating to v3](./migration-v3.md).

## TL;DR

```typescript
import {
  createSerialSession,
  isWebSerialSupported,
  SerialSessionStatus,
} from '@gurezo/web-serial-rxjs';
import { shareReplay } from 'rxjs';

if (!isWebSerialSupported()) {
  // fallback UI before creating a session
}

const session = createSerialSession({ baudRate: 9600 });

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    // unsupported UI after session creation
  }
});

// Prefer the stream that matches your use case:
session.receive$.subscribe(/* decoded chunks */);
session.lines$.subscribe(/* complete lines */);
session.terminalText$.subscribe(/* terminal display text */);

// If you previously used receiveReplay$, compose operators yourself.
// This is NOT a drop-in replacement for the removed API.
const replayedReceive$ = session.receive$.pipe(
  shareReplay({
    bufferSize: 1,
    refCount: true,
  }),
);
```

---

## Phase 1 API removals

Phase 1 of [#472](https://github.com/gurezo/web-serial-rxjs/issues/472) removed duplicate / escape-hatch APIs so `state$` and `dispose$()` are the only public sources for lifecycle and teardown. Documentation pass: [#478](https://github.com/gurezo/web-serial-rxjs/issues/478).

| Removed API | Replacement |
| --- | --- |
| `destroy$()` | `dispose$()` |
| `isConnected$` | `state$` with `state.status` (or derive a boolean from `state$`) |
| `portInfo$` | `state.portInfo` when `state.status === SerialSessionStatus.Connected` |
| `getPortInfo()` | `state.portInfo` when connected (same as above) |
| `getCurrentPort()` | No direct replacement. Use `state.portInfo` for identification; raw `SerialPort` is not exposed |

Longer examples and checklists: [Migrating to v3 – Phase 1 API removals](./migration-v3.md#phase-1-api-removals).

---

## Phase 2 API removals

Phase 2 of [#485](https://github.com/gurezo/web-serial-rxjs/issues/485) removes session-attached derived APIs and options that did not match their names or session responsibilities. Implementation: [#486](https://github.com/gurezo/web-serial-rxjs/issues/486), [#487](https://github.com/gurezo/web-serial-rxjs/issues/487), [#488](https://github.com/gurezo/web-serial-rxjs/issues/488). Docs: [#490](https://github.com/gurezo/web-serial-rxjs/issues/490).

| Before (v3 and earlier) | After (v4) |
| --- | --- |
| `session.receiveReplay$` | `session.receive$` composed with the RxJS operators you need |
| `options.receiveReplay` | Removed |
| `session.isBrowserSupported()` | Top-level `isWebSerialSupported()`, or `state$` with `Unsupported` |
| Mixed / opaque session options | `SerialConnectionOptions` + `SerialSessionFeatureOptions` composition |

### `receiveReplay$` and `receiveReplay` option

`receiveReplay$` only replayed past chunks when `receiveReplay.enabled` was set at session creation. When disabled it behaved like `receive$`, so the name and behavior did not match. Replay applied to decoded receive chunks only—not to `lines$` or `terminalText$`—and required separate `bufferSize` / `maxChars` limits.

**v4 removes both the stream and the option.** If your app needs replay-like caching, compose operators on `receive$` yourself.

```typescript
import { shareReplay } from 'rxjs';

const replayedReceive$ = session.receive$.pipe(
  shareReplay({
    bufferSize: 1,
    refCount: true,
  }),
);
```

#### Not a drop-in replacement

This pattern is **not** guaranteed to be fully compatible with the removed `receiveReplay$` API:

- `shareReplay` `bufferSize` counts **events**, not characters. The old option also supported `maxChars`.
- There is **no** built-in `maxChars` / character-budget limit in this recipe.
- Cache lifetime across connect / disconnect / dispose must be designed in application code.
- Decide how errors and completion are re-notified (`shareReplay` reset / refCount behavior differs from the old session-owned buffer).

Do not treat `shareReplay` as a complete substitute for the deleted feature.

### Browser support detection

Web Serial availability is not per-session state. Calling `createSerialSession()` only to check support was confusing.

**Before creating a session** (sync feature detection):

```typescript
import { isWebSerialSupported } from '@gurezo/web-serial-rxjs';

if (!isWebSerialSupported()) {
  // fallback UI
}
```

**After the session exists**, prefer `state$` for UI that follows lifecycle:

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    // unsupported UI
  }
});
```

`session.isBrowserSupported()` is removed. See also [API concepts – `isWebSerialSupported`](./concepts.md#iswebserialsupported-boolean).

### Session options layout

`SerialSessionOptions` remains a single factory argument, but responsibilities are clearer:

```text
SerialConnectionOptions     = W3C connection parameters for port.open
SerialSessionFeatureOptions = library-specific session features
SerialSessionOptions        = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

- **Connection:** `baudRate`, `dataBits`, `stopBits`, `parity`, `bufferSize`, `flowControl`
- **Features:** `filters`, `terminalBuffer`, `lineBuffer` (`receiveReplay` is gone)

Boundary semantics (`0` = unlimited for buffer limits only; connection fields require `> 0`) are documented in [API concepts – SerialSessionOptions](./concepts.md#serialsessionoptions).

---

## Streams kept in v4

These are **not** duplicates. Each abstracts a different use case:

| API | Use it for |
| --- | --- |
| `receive$` | Decoded UTF-8 **chunks** from the read pump |
| `lines$` | Newline-framed **complete lines** (logs / protocols) |
| `terminalText$` | Cumulative text for **terminal display** (including `\r` redraw behavior) |

They stay on `SerialSession` so apps do not reimplement framing, incomplete tails, or terminal buffer limits. Details: [API concepts – SerialSession](./concepts.md#serialsession).

---

## Unchanged in Phase 2

The following stay as in v3 / Phase 1 completion:

- Operation Observables (`connect$`, `send$`, `disconnect$`, `dispose$`) run when **subscribed** (cold)
- No Promise-based duplicate APIs are added
- `errors$` and operation-Observable error notification semantics are unchanged
- `lines$` / `terminalText$` are **not** moved to user-land operators
- No new selector / convenience APIs are added in Phase 2

Target public shape:

```typescript
export interface SerialSession {
  readonly state$: Observable<SerialSessionState>;
  readonly errors$: Observable<SerialError>;

  readonly receive$: Observable<string>;
  readonly lines$: Observable<string>;
  readonly terminalText$: Observable<string>;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;
  send$(data: SerialPayload): Observable<void>;
  dispose$(): Observable<void>;
}
```

Plus the top-level helper:

```typescript
export function isWebSerialSupported(): boolean;
```

---

## Migration checklist

- [ ] Replace `destroy$()` with `dispose$()`; drive lifecycle UI from `state$`
- [ ] Replace `isConnected$` / `portInfo$` / `getPortInfo()` / `getCurrentPort()` with `state$` / `state.portInfo`
- [ ] Remove `receiveReplay$` subscriptions and `receiveReplay` options
- [ ] If you need replay, compose RxJS operators on `receive$` and accept the differences above
- [ ] Replace `session.isBrowserSupported()` with `isWebSerialSupported()` or `state$` `Unsupported`
- [ ] Drop handling for removed receive-replay error codes (`INVALID_RECEIVE_REPLAY_OPTIONS`, `RECEIVE_REPLAY_BUFFER_OVERFLOW`)
- [ ] Confirm you pick `receive$` / `lines$` / `terminalText$` by use case, not as interchangeable aliases

---

## Release notes (Phase 2)

- Removed `SerialSession.receiveReplay$` and `SerialSessionOptions.receiveReplay`
- Removed related receive-replay error codes and internal buffer implementation
- Removed `SerialSession.isBrowserSupported()`; use top-level `isWebSerialSupported()`
- Clarified `SerialSessionOptions` as connection fields + feature options (`filters`, `terminalBuffer`, `lineBuffer`)
- Public API boundary locked by regression tests ([#489](https://github.com/gurezo/web-serial-rxjs/issues/489))

---

## See also

- [Migrating to v3](./migration-v3.md) — `SerialErrorCode`, discriminated-union `state$`, Phase 1 detail sections
- [Migrating from v1 to v2](./migration-v2.md) — `SerialClient` → `SerialSession` (note: v4 browser check is top-level again)
- [API concepts and design notes](./concepts.md)
- Parent issue [#485](https://github.com/gurezo/web-serial-rxjs/issues/485)

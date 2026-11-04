# Migrating to v5

This page collects v5 contract changes. Sections so far: the error notification contract ([#633](https://github.com/gurezo/web-serial-rxjs/issues/633)), session disposal ([#655](https://github.com/gurezo/web-serial-rxjs/issues/655)), and removed deprecated APIs ([#658](https://github.com/gurezo/web-serial-rxjs/issues/658)).

The shape of `state$` is unchanged from v4. `SerialError` no longer takes a legacy cause argument or exposes `originalError`. `PORT_NOT_AVAILABLE`, `OPERATION_TIMEOUT`, and the public `assertNever` export are gone. One failure is no longer emitted on both `errors$` and the operation Observable. Permanent teardown prefers `dispose(): Promise<void>`. `dispose$()` remains and is deprecated.

## TL;DR

- Failures of `connect$`, `send$`, and `disconnect$` go only to that subscriber. They are not emitted on `errors$`.
- `errors$` emits post-connect read-pump errors, an unexpected disconnect while connected, and `LINE_BUFFER_OVERFLOW`.
- On a fatal failure, `state.error` is that same `SerialError`, even when `errors$` does not emit it.
- Cancelling the port picker makes `connect$` error with `OPERATION_CANCELLED`. `state$` returns to `'idle'`.
- Prefer `await session.dispose()`. It starts immediately and resolves when the port and read pump are released. `dispose$()` stays as a deprecated cold Observable: subscribe it, or it does nothing.
- `PORT_NOT_AVAILABLE`, `OPERATION_TIMEOUT`, public `assertNever`, `originalError`, and the legacy `SerialError` cause argument are removed. See [Removed deprecated APIs](#removed-deprecated-apis).

## Error notification

### Before (v4)

Watching only `errors$` also observed connect, send, and disconnect failures.

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
    showToast(error.message);
  }
  if (error.is(SerialErrorCode.WRITE_FAILED)) {
    showToast(error.message);
  }
});

session.connect$().subscribe();
session.send$('hello\n').subscribe();
```

### After (v5)

Read an operation result from that Observable. Use `errors$` when the session fails on its own.

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.connect$().subscribe({
  error: (error) => {
    if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
      return;
    }
    if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
      showToast(error.message);
    }
  },
});

session.send$('hello\n').subscribe({
  error: (error) => {
    if (error.is(SerialErrorCode.WRITE_FAILED)) {
      showToast(error.message);
    }
  },
});

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    showToast(error.message);
  }
});
```

Toasting both channels in v4 showed the same failure twice. In v5 the channels are exclusive, so subscribing to both still reports each failure once.

## Channels

| Source | Where it is delivered | `state$` |
| --- | --- | --- |
| `connect$` failure (open, pump startup, picker cancel) | `connect$` `error` | fatal moves to `'error'`; cancel returns to `'idle'` |
| `send$` `WRITE_FAILED` / `PORT_NOT_OPEN` | `send$` `error` | unchanged |
| `disconnect$` close failure | `disconnect$` `error` | fatal moves to `'error'` |
| Read pump after connected | `errors$` | `'error'` |
| Unexpected stream close while connected | `errors$` | `'error'` |
| `LINE_BUFFER_OVERFLOW` | `errors$` | unchanged |
| `SESSION_DISPOSED` after `dispose()` | that operation's `error` | already `'disposed'` |

A `send$` dropped because the connection ended is a separate `PORT_NOT_OPEN` from the pump's `READ_FAILED`. It goes only to the `send$` subscriber.

## Dispose

`dispose$()` is still present. It is deprecated. The preferred teardown is `dispose()`.

### Before (v4)

```typescript
session.dispose$().subscribe({ error: () => void 0 });
```

Calling `dispose$()` without `subscribe()` did nothing.

### After (v5)

```typescript
await session.dispose();
```

In a cleanup hook that cannot be `async`, `void session.dispose()` still starts teardown.

If you keep `dispose$()`, subscribe it. A subscription joins the same teardown as `dispose()` and completes when release finishes.

### Completion

- `dispose()` resolves when the port and read pump are released. `state$` may emit `'disposed'` before that.
- `port.close()` failures do not reject the promise. An unexpected teardown failure rejects with `SerialError`.
- A second `dispose()`, or a later `dispose$()` subscription, waits for the same in-flight release.
- During `'connecting'`, if `open()` has started, both `dispose()` and a subscribed `dispose$()` resolve only after that port is released. If `open()` has not started, including while `requestPort()` is pending, they resolve without waiting. The port picker is not dismissed, and a port selected afterward is not opened.
- `[Symbol.asyncDispose]` is not part of this release.

## Removed deprecated APIs

These v4 surfaces were deprecated and are removed ([#658](https://github.com/gurezo/web-serial-rxjs/issues/658)).

### `PORT_NOT_AVAILABLE` and `OPERATION_TIMEOUT`

They were never emitted. Delete branches that match them. Treat port acquisition failures as `PORT_OPEN_FAILED` or `OPERATION_CANCELLED`.

#### Before (v4)

```typescript
if (error.is(SerialErrorCode.PORT_NOT_AVAILABLE)) {
  showToast(error.message);
}
if (error.is(SerialErrorCode.OPERATION_TIMEOUT)) {
  showToast(error.message);
}
```

#### After (v5)

```typescript
if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
  showToast(error.message);
}
if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
  return;
}
```

### `assertNever`

The helper stays inside the package. It is no longer a public export. Define a local helper, or cover every `state.status` with `SerialSessionStatus`.

#### Before (v4)

```typescript
import { assertNever } from '@gurezo/web-serial-rxjs';

assertNever(state);
```

#### After (v5)

```typescript
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

### `SerialError` cause argument and `originalError`

The constructor is `(code, message, context?)`. Cause-bearing codes take `{ cause }` as that third argument. Read the underlying failure from `context.cause`.

#### Before (v4)

```typescript
console.error(error.originalError);

new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', cause);
new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', undefined, {
  cause,
});
```

#### After (v5)

```typescript
if (error.is(SerialErrorCode.READ_FAILED)) {
  console.error(error.context.cause);
}

new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', { cause });
```

## Related

- [Quick Start – Error handling](./quick-start.md#error-handling)
- [Quick Start – Dispose](./quick-start.md#dispose-resource-cleanup)
- [Concepts – `dispose()`](./concepts.md#dispose-promisevoid)
- [Concepts – `errors$`](./concepts.md#errors-observableserialerror)
- [Framework session lifecycle](./framework-session-lifecycle.md)
- [Troubleshooting – Recovery Matrix](./troubleshooting.md#error-recovery-matrix)

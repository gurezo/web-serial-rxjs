# Migrating to v5

This page collects breaking changes for v5. Later changes add sections. This section is the error notification contract ([#633](https://github.com/gurezo/web-serial-rxjs/issues/633)).

The shapes of `state$` and `SerialError` are unchanged from v4. What changed is that one failure is no longer emitted on both `errors$` and the operation Observable.

## TL;DR

- Failures of `connect$`, `send$`, and `disconnect$` go only to that subscriber. They are not emitted on `errors$`.
- `errors$` emits post-connect read-pump errors, an unexpected disconnect while connected, and `LINE_BUFFER_OVERFLOW`.
- On a fatal failure, `state.error` is that same `SerialError`, even when `errors$` does not emit it.
- Cancelling the port picker makes `connect$` error with `OPERATION_CANCELLED`. `state$` returns to `'idle'`.

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
| `SESSION_DISPOSED` after `dispose$` | that operation's `error` | already `'disposed'` |

A `send$` dropped because the connection ended is a separate `PORT_NOT_OPEN` from the pump's `READ_FAILED`. It goes only to the `send$` subscriber.

## Related

- [Quick Start – Error handling](./quick-start.md#error-handling)
- [Concepts – `errors$`](./concepts.md#errors-observableserialerror)
- [Troubleshooting – Recovery Matrix](./troubleshooting.md#error-recovery-matrix)

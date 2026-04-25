# API Reference

The v2 public surface consists of a single factory (`createSerialSession`), the runtime `SerialSession` interface, one options type, one state union, and two error types.

## Public exports

```typescript
import {
  createSerialSession,
  SerialError,
  SerialErrorCode,
  SerialSessionState,
  type SerialSession,
  type SerialSessionOptions,
} from '@gurezo/web-serial-rxjs';
```

## createSerialSession(options?)

Factory that returns a new `SerialSession`. Safe to call when `navigator.serial` is unavailable; in that case `state$` is seeded with `'unsupported'` and `connect$` rejects with `SerialErrorCode.BROWSER_NOT_SUPPORTED`.

### Signature

```typescript
function createSerialSession(options?: SerialSessionOptions): SerialSession;
```

## SerialSessionOptions

| Field         | Type                                | Default  | Description                                                       |
| ------------- | ----------------------------------- | -------- | ----------------------------------------------------------------- |
| `baudRate`    | `number`                            | `9600`   | Bits per second.                                                  |
| `dataBits`    | `7 \| 8`                            | `8`      | Data bits per frame.                                              |
| `stopBits`    | `1 \| 2`                            | `1`      | Stop bits per frame.                                              |
| `parity`      | `'none' \| 'even' \| 'odd'`         | `'none'` | Parity checking mode.                                             |
| `bufferSize`  | `number`                            | `255`    | Read-stream buffer size in bytes.                                 |
| `flowControl` | `'none' \| 'hardware'`              | `'none'` | Flow control mode.                                                |
| `filters`     | `SerialPortFilter[]` \| `undefined` | —        | Forwarded to `navigator.serial.requestPort` when selecting a port.|

## SerialSessionState

The same union is available as a **const object** `SerialSessionState` (e.g. `SerialSessionState.Connected` is `'connected'`) for IDE completion and to avoid string typos. String literals stay valid for types and runtime comparisons.

`state$` emits one of:

- `'idle'` — no active port; initial state when Web Serial is supported.
- `'connecting'` — `connect$` is in flight.
- `'connected'` — port is open and the read pump is running.
- `'disconnecting'` — `disconnect$` is in flight.
- `'unsupported'` — `navigator.serial` was not available at session creation time.
- `'error'` — a fatal failure occurred. Call `disconnect$` or recreate the session to recover.

Valid transitions:

```
idle -> connecting -> connected -> disconnecting -> idle
                              \-> error
idle / connected / connecting / disconnecting / error -> error (fatal failure)
any -> unsupported (when navigator.serial is missing at construction)
```

## SerialSession

```typescript
interface SerialSession {
  isBrowserSupported(): boolean;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;

  readonly state$: Observable<SerialSessionState>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;

  send$(data: string | Uint8Array): Observable<void>;
}
```

### `isBrowserSupported(): boolean`

Synchronous feature check. Returns `true` when `navigator.serial` is available.

### `connect$(): Observable<void>`

Opens a user-selected serial port and starts the internal read pump. Completes on success; errors via `errors$` and the subscriber on failure. Transitions `idle → connecting → connected`.

### `disconnect$(): Observable<void>`

Stops the read pump and closes the port. Safe to call when already idle. Transitions `connected → disconnecting → idle`. When called from `'error'` it still tears the port down and returns to `idle`.

### `state$: Observable<SerialSessionState>`

Replays the current state on subscribe. Prefer driving your UI from this stream instead of rebuilding a `BehaviorSubject`.

### `errors$: Observable<SerialError>`

Primary error channel. Every connect / read / write / close failure is normalised to `SerialError` and pushed here. Fatal failures additionally drive `state$` to `'error'` and tear down the live pump and port.

### `receive$: Observable<string>`

UTF-8 decoded text pushed by the internal read pump. **Not subscription-lazy** — the pump is started by `connect$` and chunks are multicast. Late subscribers see only new data.

### `send$(data: string | Uint8Array): Observable<void>`

Enqueues a payload for ordered transmission. Strings are UTF-8 encoded through a shared `TextEncoder`. Concurrent `send$` calls are serialised in call order by an internal FIFO queue. Write failures are normalised to `SerialError` with `SerialErrorCode.WRITE_FAILED`, multiplexed on `errors$`, and surfaced to the subscriber. Calling `send$` while not `'connected'` fails fast with `SerialErrorCode.PORT_NOT_OPEN`.

## SerialError / SerialErrorCode

`SerialError` extends `Error` with a `code: SerialErrorCode` and an optional `originalError: Error`. It exposes `is(code): boolean` for ergonomic comparison.

| Code                     | When it is emitted                                                  |
| ------------------------ | ------------------------------------------------------------------- |
| `BROWSER_NOT_SUPPORTED`  | Session construction / `connect$` without `navigator.serial`.       |
| `PORT_NOT_AVAILABLE`     | Requested port cannot be accessed.                                  |
| `PORT_OPEN_FAILED`       | `port.open()` rejected.                                             |
| `PORT_ALREADY_OPEN`      | `connect$` called while not in `'idle'` / `'error'`.                |
| `PORT_NOT_OPEN`          | `send$` / `disconnect$` called in a state that disallows it.        |
| `READ_FAILED`            | Internal read pump errored.                                         |
| `WRITE_FAILED`           | `port.writable.getWriter().write()` rejected.                       |
| `CONNECTION_LOST`        | `port.close()` failed or the port dropped mid-session.              |
| `INVALID_FILTER_OPTIONS` | `filters` contained an invalid entry.                               |
| `OPERATION_CANCELLED`    | User cancelled the port picker.                                     |
| `OPERATION_TIMEOUT`      | Internal operation timed out.                                       |
| `UNKNOWN`                | Unclassified failure; see `originalError`.                          |

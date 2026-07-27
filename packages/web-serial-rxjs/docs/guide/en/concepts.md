# API concepts and design notes

For exhaustive public API specifications, see the [English TypeDoc API Reference](modules.html). This page is a Guide supplement (tables and design notes)—not a TypeDoc substitute.


The public surface consists of a single factory (`createSerialSession`), the runtime `SerialSession` interface, one options type, one state union, and two error types.

## Public exports

```typescript
import {
  createSerialSession,
  createTerminalBuffer,
  DEFAULT_TERMINAL_BUFFER_OPTIONS,
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSession,
  type SerialSessionState,
  type SerialSessionOptions,
  type SerialSessionFeatureOptions,
  type SerialConnectionOptions,
  type TerminalBufferOptions,
} from '@gurezo/web-serial-rxjs';
```

## Deprecated exports

The following remain available from the public export in v3.x but are not part of the canonical API. They are scheduled for removal in the next major version. See [Migrating to v3 – §9 `assertNever` public export audit](./migration-v3.md#9-public-export-audit).

| Export | Status | Migration |
| --- | --- | --- |
| `assertNever` | `@deprecated` in v3.x | Define a local helper in application code, or use `switch (state.status)` with `SerialSessionStatus` |

```typescript
// Deprecated (still works in v3.x but triggers warnings)
import { assertNever } from '@gurezo/web-serial-rxjs';

// Recommended: local helper
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

## createSerialSession(options?)

Factory that returns a new `SerialSession`. Safe to call when `navigator.serial` is unavailable; in that case `state$` is seeded with `{ status: 'unsupported' }` and `connect$` rejects with `SerialErrorCode.BROWSER_NOT_SUPPORTED`.

### Signature

```typescript
function createSerialSession(options?: SerialSessionOptions): SerialSession;
```

## SerialSessionOptions

`SerialSessionOptions` composes W3C connection parameters (`SerialConnectionOptions`) with library-specific session features (`SerialSessionFeatureOptions`). It is the factory argument for `createSerialSession`.

```text
SerialSessionOptions = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

See [Migrating to v3 – §10 Session options type responsibility audit](./migration-v3.md#10-session-options-type-responsibility-audit) for the audit rationale.

### Connection options (`SerialConnectionOptions`)

Derived from W3C `SerialOptions` and passed to `port.open`. All fields are optional at factory time; omitted values fall back to the defaults below.

| Field         | Type                                | Default  | Description                                                       |
| ------------- | ----------------------------------- | -------- | ----------------------------------------------------------------- |
| `baudRate`    | `number`                            | `9600`   | Bits per second.                                                  |
| `dataBits`    | `7 \| 8`                            | `8`      | Data bits per frame.                                              |
| `stopBits`    | `1 \| 2`                            | `1`      | Stop bits per frame.                                              |
| `parity`      | `'none' \| 'even' \| 'odd'`         | `'none'` | Parity checking mode.                                             |
| `bufferSize`  | `number`                            | `255`    | Read-stream buffer size in bytes.                                 |
| `flowControl` | `'none' \| 'hardware'`              | `'none'` | Flow control mode.                                                |

### Session feature options (`SerialSessionFeatureOptions`)

Library-specific session features. Not passed to W3C `port.open`.

| Field         | Type                                | Default  | Description                                                       |
| ------------- | ----------------------------------- | -------- | ----------------------------------------------------------------- |
| `filters`     | `SerialPortFilter[]` \| `undefined` | —        | Forwarded to `navigator.serial.requestPort` when selecting a port.|
| `terminalBuffer` | `TerminalBufferOptions` | `{ maxLines: 10000, maxChars: 1048576, stripAnsi: true }` | Memory limits and ANSI stripping for `terminalText$`; see `createTerminalBuffer`. |
| `lineBuffer` | `LineBufferOptions` | `{ maxChars: 1048576 }` | Memory limit for the incomplete line tail used by `lines$`; see below. |

At `createSerialSession` time (factory), `resolveSerialSessionOptions` validates the following. Invalid values throw `SerialError`:

| Target | Validation | Error code |
| --- | --- | --- |
| `baudRate` | safe integer and `> 0` | `INVALID_CONNECTION_OPTIONS` |
| `filters` | USB vendor/product ID ranges | `INVALID_FILTER_OPTIONS` |
| `terminalBuffer` | `maxLines` / `maxChars` are safe integers and `>= 0` | `INVALID_TERMINAL_BUFFER_OPTIONS` |
| `lineBuffer` | `maxChars` is a safe integer and `>= 0` | `INVALID_LINE_BUFFER_OPTIONS` |

### `TerminalBufferOptions`

Used by `createTerminalBuffer` and `SerialSessionOptions.terminalBuffer`. When a limit is exceeded, the **oldest** completed lines or leading characters are dropped so long-running terminal views do not grow without bound. Pass `0` for either field to disable that constraint.

| Field      | Type     | Default    | Description |
| ---------- | -------- | ---------- | ----------- |
| `maxLines` | `number` | `10000`    | Max number of completed lines retained in the cumulative display text. |
| `maxChars` | `number` | `1048576`  | Max total characters in the display text (`completed` + current line). |
| `stripAnsi` | `boolean` | `true` | When `true`, removes ANSI escape sequences before folding `\r` redraws. Set `false` to preserve raw escape codes in `terminalText$`. `receive$` is always unchanged. |

Invalid `maxLines` or `maxChars` values cause `createSerialSession` to throw `SerialError` with `INVALID_TERMINAL_BUFFER_OPTIONS`.

### `LineBufferOptions`

Used by `SerialSessionOptions.lineBuffer` for the **incomplete line tail** held while framing `lines$`. When `maxChars` is exceeded, **leading** characters of the tail are discarded and a non-fatal `SerialError` with `SerialErrorCode.LINE_BUFFER_OVERFLOW` is emitted on `errors$`. Completed lines are emitted in full before the tail is trimmed. Pass `0` to disable the limit.

| Field      | Type     | Default    | Description |
| ---------- | -------- | ---------- | ----------- |
| `maxChars` | `number` | `1048576`  | Max characters retained in the incomplete line tail (no line terminator yet). |

Invalid `maxChars` values cause `createSerialSession` to throw `SerialError` with `INVALID_LINE_BUFFER_OPTIONS`.

## createTerminalBuffer(receive$, options?)

Builds a terminal-oriented cumulative text stream from any `Observable<string>` of decoded chunks (typically `SerialSession.receive$`). Folds `\r` redraws while preserving normal newline behavior. Defaults match `DEFAULT_TERMINAL_BUFFER_OPTIONS`.

```typescript
function createTerminalBuffer(
  receive$: Observable<string>,
  options?: TerminalBufferOptions,
): TerminalBuffer;
```

## SerialSessionState / SerialSessionStatus

v3 exposes **`SerialSessionStatus`** as lifecycle string constants (e.g. `SerialSessionStatus.Connected` is `'connected'`) and **`SerialSessionState`** as the discriminated union type emitted by `state$`.

`state$` emits objects such as:

- `{ status: 'idle' }` — no active port; initial state when Web Serial is supported.
- `{ status: 'connecting' }` — `connect$` is in flight.
- `{ status: 'connected', portInfo }` — port is open and the read pump is running.
- `{ status: 'disconnecting' }` — `disconnect$` is in flight.
- `{ status: 'unsupported' }` — `navigator.serial` was not available at session creation time.
- `{ status: 'error', error }` — fatal failure; `error` is the same `SerialError` instance on `errors$`.
- `{ status: 'disposed' }` — session permanently torn down via `dispose$`.

Example:

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState, SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});

// RxJS pipelines: use the type predicate so TypeScript keeps ConnectedSessionState
session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

### `isConnectedSessionState(state)`

Type predicate for `ConnectedSessionState`. Use with RxJS `filter()` to preserve discriminated union narrowing in pipelines. Inline `filter((s) => s.status === SerialSessionStatus.Connected)` does not narrow types in TypeScript.

```typescript
import { filter } from 'rxjs';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';

session.state$
  .pipe(filter(isConnectedSessionState))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
```

See [Migrating to v3](./migration-v3.md) for the v2 string migration.

## SerialSession

```typescript
interface SerialSession {
  isBrowserSupported(): boolean;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;
  dispose$(): Observable<void>;

  readonly state$: Observable<SerialSessionState>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;
  readonly terminalText$: Observable<string>;
  readonly lines$: Observable<string>;

  send$(data: string | Uint8Array): Observable<void>;
}
```

### `isBrowserSupported(): boolean`

Synchronous feature check. Returns `true` when `navigator.serial` is available.

### `connect$(): Observable<void>`

Opens a user-selected serial port and starts the internal read pump. Completes on success; errors via `errors$` and the subscriber on failure. Transitions `idle → connecting → connected`. **Runs when subscribed.**

### `disconnect$(): Observable<void>`

Stops the read pump and closes the port. Safe to call when already idle or while a disconnect is already in progress. When called during `'connecting'`, cancels the in-flight `connect$()` (closes any opened port) and returns to `'idle'` without reaching `'connected'`. Transitions `connected → disconnecting → idle`. When called from `'error'` it still tears the port down and returns to `idle`. The session remains reusable after `disconnect$`; use `dispose$` for permanent teardown. **Runs when subscribed.**

### `dispose$(): Observable<void>`

Permanently tears down the session. Closes any active connection (same port/pump cleanup as `disconnect$`), emits `'disposed'` on `state$`, and **completes every session observable** (`state$`, `errors$`, `receive$`, `lines$`, `terminalText$`). Safe to call multiple times; subsequent calls complete immediately. **Runs when subscribed.**

After disposal, `connect$` and `send$` fail with `SerialErrorCode.SESSION_DISPOSED`. `disconnect$` completes immediately. Create a new `SerialSession` instead of reusing a disposed instance (for example when replacing a session after a baud-rate change).

### `state$: Observable<SerialSessionState>`

Replays the current state on subscribe. Prefer driving your UI from this stream instead of rebuilding a `BehaviorSubject`. When `state.status` is `SerialSessionStatus.Connected`, read **`state.portInfo`** for device identification. There is no separate `portInfo$` / `getPortInfo()` / `isConnected$` / `destroy$()` / `getCurrentPort()` on the public API — see [Migrating to v3 – Phase 1 API removals](./migration-v3.md#phase-1-api-removals).

### `errors$: Observable<SerialError>`

Primary error channel. Every connect / read / write / close failure is normalised to `SerialError` and pushed here. Fatal failures additionally drive `state$` to `{ status: 'error', error }` and tear down the live pump and port.

### `receive$: Observable<string>`

UTF-8 decoded text pushed by the internal read pump as **decoder chunks** (not line-oriented). **Not subscription-lazy** — the pump is started by `connect$` and chunks are multicast. Late subscribers see only new data. Carriage returns and other control characters are preserved. Use **`receive$`** for terminal-like mirrors and any output that depends on `\r` (for example interactive shells or progress lines). Use **`lines$`** for newline-framed logs and line-by-line parsing.

### `terminalText$: Observable<string>`

Terminal-display oriented cumulative text derived from `receive$`. Collapses `\r` redraws while keeping normal newline behavior. By default strips ANSI escape sequences for plain-text views (for example `<textarea>`). Raw escape codes remain available on `receive$`. Equivalent to `createTerminalBuffer(receive$, options.terminalBuffer).text$`. By default retains at most 10,000 completed lines and 1,048,576 characters; configure via `SerialSessionOptions.terminalBuffer` or pass `{ maxLines: 0, maxChars: 0 }` for unlimited growth.

### `lines$: Observable<string>`

The same UTF-8 stream split into **complete lines** using `\n`, `\r\n`, and a lone interior `\r` (see library implementation). Trailing data without a line ending is buffered; incomplete tails are not emitted. By default the incomplete tail is capped at 1,048,576 characters via `SerialSessionOptions.lineBuffer`; overflow discards leading tail data and emits `LINE_BUFFER_OVERFLOW` on `errors$` without disconnecting. **Not subscription-lazy** with respect to the read pump, like `receive$`. Choose **`lines$`** for logs and parsers; for raw terminal display where `\r` redraw semantics matter, subscribe to **`receive$`** instead.

### `send$(data: string | Uint8Array): Observable<void>`

Enqueues a payload for ordered transmission. Strings are UTF-8 encoded through a shared `TextEncoder`. Concurrent `send$` calls are serialised in call order by an internal FIFO queue. Write failures are normalised to `SerialError` with `SerialErrorCode.WRITE_FAILED`, multiplexed on `errors$`, and surfaced to the subscriber. Calling `send$` while not `'connected'` fails fast with `SerialErrorCode.PORT_NOT_OPEN`. **Runs when subscribed.**

## SerialError / SerialErrorCode

`SerialError` extends `Error` with a `code: SerialErrorCode` and structured per-code metadata on `context`. `is(code)` narrows both `code` and `context` to the literal types for that code.

For cause-bearing error codes, **`context.cause`** (`unknown`) is the canonical source for the underlying failure. `originalError` remains in v3.x for backward compatibility but is **deprecated** and scheduled for removal in the next major version. See [Migrating to v3 – originalError deprecation](./migration-v3.md#3-originalerror-deprecation).

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error(error.context.cause);
  }
});

try {
  createSerialSession({ baudRate: 0 });
} catch (error) {
  if (error instanceof SerialError && error.is(SerialErrorCode.INVALID_CONNECTION_OPTIONS)) {
    console.error(error.context.field, error.context.value, error.context.constraint);
  }
}
```

The same union is available as a **const object** `SerialErrorCode` (e.g. `SerialErrorCode.READ_FAILED` is `'READ_FAILED'`) for IDE completion and to avoid string typos. String literals stay valid for types and runtime comparisons. See [Migrating to v3](./migration-v3.md) for the enum-to-const declaration change.

Runtime emission coverage for all 17 codes is audited in [Migrating to v3 §8](./migration-v3.md#8-serialerrorcode-runtime-emission-audit).

| Code                     | `context` shape | When it is emitted                                                  |
| ------------------------ | --------------- | ------------------------------------------------------------------- |
| `LINE_BUFFER_OVERFLOW`   | `{ maxChars: number }` | `lines$` incomplete tail exceeded `lineBuffer.maxChars`; leading data discarded (non-fatal). |
| `INVALID_*` validation codes | `ValidationErrorContext` | Factory-time options validation; see below. Narrow with `error.is(code)`. |
| Cause-bearing codes (e.g. `PORT_OPEN_FAILED`) | `{ cause: unknown }` | See table below. Narrow with `error.is(code)` before reading `context.cause`. |
| Other codes              | `undefined`     | See table below.                                                    |

`ValidationErrorContext` is `{ field: string; value: unknown; constraint: ValidationErrorConstraint; filterIndex?: number }`. `message` stays human-readable; use `context` for programmatic handling.

### Implemented (emitted in v3.x)

| Code                     | When it is emitted                                                  |
| ------------------------ | ------------------------------------------------------------------- |
| `BROWSER_NOT_SUPPORTED`  | `connect$` without `navigator.serial`.                              |
| `PORT_OPEN_FAILED`       | `port.open()` rejected.                                             |
| `PORT_ALREADY_OPEN`      | `connect$` called while not in `'idle'` / `'error'`.                |
| `PORT_NOT_OPEN`          | `send$` or `disconnect$` called in an invalid session state.        |
| `READ_FAILED`            | Internal read pump errored.                                         |
| `WRITE_FAILED`           | `port.writable.getWriter().write()` rejected.                       |
| `CONNECTION_LOST`        | `port.close()` failed or the port dropped mid-session.              |
| `INVALID_FILTER_OPTIONS` | `filters` contained an invalid entry (at session creation).         | `ValidationErrorContext` |
| `INVALID_TERMINAL_BUFFER_OPTIONS` | `terminalBuffer.maxLines` or `terminalBuffer.maxChars` was out of range at session creation. | `ValidationErrorContext` |
| `INVALID_LINE_BUFFER_OPTIONS` | `lineBuffer.maxChars` was out of range at session creation. | `ValidationErrorContext` |
| `INVALID_CONNECTION_OPTIONS` | `baudRate` was out of range at session creation. | `ValidationErrorContext` |
| `OPERATION_CANCELLED`    | User cancelled the port picker.                                     |
| `SESSION_DISPOSED`       | `connect$` or `send$` called after `dispose$`.                       |
| `UNKNOWN`                | Unclassified dispose / disconnect fallback; see `context.cause`.    |

### Reserved (not emitted in v3.x; scheduled for removal in next major)

| Code                     | Notes                                                               |
| ------------------------ | ------------------------------------------------------------------- |
| `PORT_NOT_AVAILABLE`     | **Deprecated.** Unreachable without a `getPorts` API. Use `PORT_OPEN_FAILED` / `OPERATION_CANCELLED` for port acquisition failures. |
| `OPERATION_TIMEOUT`      | **Deprecated.** Unreachable without a timeout / transaction API.    |

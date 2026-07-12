# Quick Start

This is the **shortest path** to opening a serial port, receiving **newline-delimited lines**, sending data, and closing the port. For the full map of `state$`, `errors$`, `receive$`, `lines$`, and the imperative methods, read [SerialSession overview](./overview.md#serialsession-at-a-glance) first.

Use **`lines$`** for standard newline-framed text (`\n`, `\r\n`). **`receive$`** is the raw UTF-8 decoder chunk stream when you need custom framing (see [Advanced Usage](./advanced-usage.md#line-framing)). Prefer **`state$`** with `state.status` narrowing for lifecycle UI. **`isConnected$`** is deprecated in v3.x — derive a boolean from `state$` instead.

## Installation

Install the package with npm or pnpm.

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer dependency

**RxJS** `^7.8.0` is required as a peer dependency.

```bash
npm install rxjs
# or
pnpm add rxjs
```

For monorepo-wide browser support and example app index, see the [repository README.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md).

## Connect, receive, and send

### SerialSessionStatus (quick reference)

| Constant | Value | Meaning |
| --- | --- | --- |
| `SerialSessionStatus.Idle` | `'idle'` | No open port; initial when Web Serial is supported. |
| `SerialSessionStatus.Connecting` | `'connecting'` | `connect$` in progress. |
| `SerialSessionStatus.Connected` | `'connected'` | Port open; read pump running (`portInfo` included). |
| `SerialSessionStatus.Disconnecting` | `'disconnecting'` | `disconnect$` in progress. |
| `SerialSessionStatus.Unsupported` | `'unsupported'` | Web Serial unavailable at session creation. |
| `SerialSessionStatus.Error` | `'error'` | Fatal failure (`error` included). |
| `SerialSessionStatus.Disposed` | `'disposed'` | Session permanently torn down via `dispose$`. |

Details: [API concepts and design notes](./concepts.md#serialsessionstate--serialsessionstatus) and [Migrating to v3](./migration-v3.md).

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
}

session.lines$.subscribe((line) => console.log('line:', line));

// In production apps, subscribe to errors$ and handle SerialError
session.errors$.subscribe((err) => console.error('Serial error:', err));

session.connect$().subscribe({
  next: () => {
    session.send$('ls\r\n').subscribe({
      error: (e) => console.error('Send error:', e),
    });
  },
  error: (e) => console.error('Connection error:', e),
});
```

## Lifecycle observation (`state$`)

Branch on **`state.status`** with **`SerialSessionStatus`** constants. When connected, TypeScript narrowing gives type-safe access to **`state.portInfo`**.

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    console.warn('Web Serial is not available');
  }
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

## Error handling (`errors$`)

**`errors$`** is the **canonical error event channel** for all `SerialError` instances from connect, read, write, and close. Errors received via `connect$().subscribe({ error })` are the same instances emitted on `errors$`.

- **fatal** — stops the read pump and tears down the port; `state$` transitions to `{ status: 'error', error }`
- **non-fatal** — session continues (e.g. `WRITE_FAILED`, `LINE_BUFFER_OVERFLOW`)

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error('Read failed:', error.context.cause);
  }
  if (error.is(SerialErrorCode.WRITE_FAILED)) {
    console.warn('Write failed (session continues):', error.context.cause);
  }
});
```

For error code tables and `context` shapes, see [API concepts and design notes](./concepts.md#serialerror--serialerrorcode).

## Disconnect

Call `disconnect$` when you want to close the port while keeping the session reusable.

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

## Dispose (resource cleanup)

Call `dispose$` when you are done with the session entirely—for example before replacing it after a baud-rate change. This closes any active connection and completes all observables.

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('Dispose error:', e),
});
```

After disposal, create a new `createSerialSession()` instance instead of reusing the old one.

## Next steps

- See [API concepts and design notes](./concepts.md) for the full list of streams and methods.
- Chunk-mode reception, ordered sends, detailed error handling, port filters, and more recipes are in [Advanced Usage](./advanced-usage.md).
- Migrating from v2 typings is covered in [Migrating to v3](./migration-v3.md).
- Migrating from v1 is covered in [Migration v1 → v2](./migration-v2.md).

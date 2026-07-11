# Quick Start

This is the **shortest path** to opening a serial port, receiving **newline-delimited lines**, sending data, and closing the port. For the full map of `state$`, `isConnected$`, `receive$`, `lines$`, `errors$`, and the imperative methods, read [SerialSession (v2) overview](./OVERVIEW.md#serialsession-v2-at-a-glance) first.

Use **`lines$`** for standard newline-framed text (`\n`, `\r\n`). **`receive$`** is still the raw UTF-8 decoder chunk stream when you need custom framing (see [Advanced Usage](./ADVANCED_USAGE.md#line-framing)). For a simple "are we connected?" boolean, use **`isConnected$`** (or still derive from `state$` with `map` if you prefer).

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

Details: [API Reference](./API_REFERENCE.md#serialsessionstate--serialsessionstatus) and [Migrating to v3](./MIGRATION_V3.md).

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
}

session.isConnected$.subscribe((isConnected) =>
  console.log('Connected:', isConnected),
);
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

Compare **`state.status`** with **`SerialSessionStatus`**:

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

## Disconnect

Call `disconnect$` when you want to close the port while keeping the session reusable.

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

## Dispose

Call `dispose$` (or `destroy$`) when you are done with the session entirely—for example before replacing it after a baud-rate change. This closes any active connection and completes all observables.

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('Dispose error:', e),
});
```

After disposal, create a new `createSerialSession()` instance instead of reusing the old one.

## Next steps

- See the [API Reference](./API_REFERENCE.md) for the full list of streams and methods.
- Chunk-mode reception, ordered sends, detailed error handling, port filters, and more recipes are in [Advanced Usage](./ADVANCED_USAGE.md).
- Migrating from v1 is covered in [Migration v1 → v2](./MIGRATION_V2.md).

# Quick Start

This is the **shortest path** to opening a serial port, receiving **newline-delimited lines**, sending data, and closing the port. For the full map of `state$`, `receive$`, `lines$`, `errors$`, and the imperative methods, read the [project README](../../../README.md#serialsession-v2-at-a-glance) first.

Use **`lines$`** for standard newline-framed text (`\n`, `\r\n`). **`receive$`** is still the raw UTF-8 decoder chunk stream when you need custom framing (see [Advanced Usage](./ADVANCED_USAGE.md#line-framing)). For a simple "are we connected?" boolean, use **`isConnected$`** (or still derive from `state$` with `map` if you prefer).

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

## Disconnect

Call `disconnect$` when you want to close the port.

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

## Next steps

- See the [API Reference](./API_REFERENCE.md) for the full list of streams and methods.
- Chunk-mode reception, ordered sends, detailed error handling, port filters, and more recipes are in [Advanced Usage](./ADVANCED_USAGE.md).
- Migrating from v1 is covered in [Migration v1 → v2](./MIGRATION_V2.md).

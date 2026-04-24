# Quick Start

This is the **shortest path** to opening a serial port, receiving **newline-delimited lines**, sending data, and closing the port. For the full map of `state$`, `receive$`, `errors$`, and the imperative methods, read the [project README](../../README.md#serialsession-v2-at-a-glance) first.

`SerialSession` does not expose built-in `lines$` or `connected$`. Below they are **derived** from `receive$` and `state$` (see [Advanced Usage](./ADVANCED_USAGE.md#line-framing) for the pattern).

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
}

const connected$ = session.state$.pipe(map((s) => s === 'connected'));

const lines$ = session.receive$.pipe(
  scan(
    (acc, chunk) => {
      const combined = acc.buffer + chunk;
      const parts = combined.split('\n');
      return { buffer: parts.pop() ?? '', lines: parts };
    },
    { buffer: '', lines: [] as string[] },
  ),
  filter((s) => s.lines.length > 0),
  map((s) => s.lines),
);

connected$.subscribe((isConnected) => console.log('Connected:', isConnected));
lines$.subscribe((lines) => lines.forEach((line) => console.log('line:', line)));

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

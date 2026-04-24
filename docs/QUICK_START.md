# Quick Start

This is the **shortest path** to an open port and working subscriptions. For a one-page map of `state$` / `receive$` / `errors$` and the imperative methods, start with the [project README](../README.md#serialsession-v2-at-a-glance).

The v2 public API is a single `SerialSession` created by `createSerialSession`. Subscribe to `state$`, `receive$`, and `errors$` and drive the port through `connect$`, `disconnect$`, and `send$`.

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });

if (!session.isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
}

session.state$.subscribe((state) => console.log('State:', state));
session.receive$.subscribe((text) => console.log('Received:', text));
session.errors$.subscribe((error) => console.error('Serial error:', error));

session.connect$().subscribe({
  next: () => {
    session.send$('help\n').subscribe({
      error: (error) => console.error('Send error:', error),
    });
  },
  error: (error) => console.error('Connection error:', error),
});
```

## Usage Examples

### Basic Connection

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

session.connect$().subscribe({
  next: () => console.log('Connected'),
  error: (error) => console.error('Connection failed:', error),
});
```

### Reading Text

`receive$` emits UTF-8 decoded strings using a streaming `TextDecoder`. Multi-byte characters split across chunks are joined automatically. Subscriptions see **arbitrary chunk boundaries**—not one line per emission. For newline-delimited lines, compose operators over `receive$` (full recipes in [Advanced Usage](./ADVANCED_USAGE.md#line-framing)):

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.connect$().subscribe();
session.receive$.subscribe((chunk) => console.log('Chunk:', chunk));
```

### Ordered Sends

`send$` internally serialises concurrent calls through a FIFO queue so payloads reach the port in call order.

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';
import { from, concatMap } from 'rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.connect$().subscribe({
  next: () => {
    const messages = ['Message 1\n', 'Message 2\n', 'Message 3\n'];
    from(messages)
      .pipe(concatMap((msg) => session.send$(msg)))
      .subscribe({
        error: (error) => console.error('Send error:', error),
      });
  },
});
```

### Error Handling

Every failure (connect / read / write / close) is normalised to `SerialError` and multiplexed on `errors$`. Fatal failures additionally drive `state$` into `'error'`.

```typescript
import {
  createSerialSession,
  SerialError,
  SerialErrorCode,
} from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.errors$.subscribe((error: SerialError) => {
  switch (error.code) {
    case SerialErrorCode.BROWSER_NOT_SUPPORTED:
      console.error('Browser does not support Web Serial API');
      break;
    case SerialErrorCode.PORT_OPEN_FAILED:
      console.error('Failed to open port:', error.message);
      break;
    case SerialErrorCode.READ_FAILED:
    case SerialErrorCode.CONNECTION_LOST:
      console.error('Connection lost');
      break;
    case SerialErrorCode.WRITE_FAILED:
      console.error('Write failed:', error.message);
      break;
    default:
      console.error('Serial error:', error);
  }
});

session.connect$().subscribe({
  error: () => {
    // already surfaced via errors$
  },
});
```

### Port Filtering

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }, { usbVendorId: 0x5678 }],
});

session.connect$().subscribe({
  error: (error) => console.error('Connection error:', error),
});
```

## Next Steps

- See [API Reference](./API_REFERENCE.md) for the full `SerialSession` surface.
- Check out [Advanced Usage](./ADVANCED_USAGE.md) for line framing, request/response-style flows, and recovery.
- Coming from v1? Read the [v1 → v2 Migration Guide](./MIGRATION_V2.md).

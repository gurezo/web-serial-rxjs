# Quick Start

Start with the v1-style API (`text$`, `state$`, `send$`) so you do not need manual `TextDecoder`/`TextEncoder` handling.

```typescript
import {
  createSerialClient,
  isBrowserSupported,
} from '@gurezo/web-serial-rxjs';

// Check browser support
if (!isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
  return;
}

// Create a serial client
const client = createSerialClient({ baudRate: 9600 });

client.state$.subscribe((state) => {
  console.log('State:', state);
});

client.text$.subscribe((text) => {
  console.log('Received:', text);
});

// Connect to a serial port (prompts for port selection)
client.connect().subscribe({
  next: () => {
    client.send$('help\n').subscribe({
      next: () => console.log('Sent: help'),
      error: (error) => console.error('Send error:', error),
    });
  },
  error: (error) => {
    console.error('Connection error:', error);
  },
});
```

## Usage Examples

### Basic Connection

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

const client = createSerialClient({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

// Connect (will prompt user to select a port)
client.connect().subscribe({
  next: () => console.log('Connected'),
  error: (error) => console.error('Connection failed:', error),
});
```

### Reading Text and Lines

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    client.text$.subscribe((text) => console.log('Chunk:', text));
    client.lines$.subscribe((line) => console.log('Line:', line));
  },
});
```

### Ordered Sends

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // send$ internally queues writes in order.
    const messages = ['Message 1\n', 'Message 2\n', 'Message 3\n'];
    from(messages)
      .pipe(concatMap((msg) => client.send$(msg)))
      .subscribe({
        next: () => console.log('Message written'),
        error: (error) => console.error('Send error:', error),
      });
  },
});
```

### Error Handling

```typescript
import {
  createSerialClient,
  SerialError,
  SerialErrorCode,
} from '@gurezo/web-serial-rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => console.log('Connected'),
  error: (error) => {
    if (error instanceof SerialError) {
      switch (error.code) {
        case SerialErrorCode.BROWSER_NOT_SUPPORTED:
          console.error('Browser does not support Web Serial API');
          break;
        case SerialErrorCode.PORT_NOT_AVAILABLE:
          console.error('Serial port is not available');
          break;
        case SerialErrorCode.CONNECTION_LOST:
          console.error('Connection lost');
          break;
        default:
          console.error('Serial error:', error.message);
      }
    } else {
      console.error('Unknown error:', error);
    }
  },
});
```

### Port Filtering

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

// Filter ports by USB vendor ID
const client = createSerialClient({
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }, { usbVendorId: 0x5678 }],
});

// Request a specific port
client.requestPort().subscribe({
  next: (port) => {
    console.log('Port selected:', port);
    // Connect to the selected port
    client.connect(port).subscribe({
      next: () => console.log('Connected to filtered port'),
      error: (error) => console.error('Connection error:', error),
    });
  },
  error: (error) => console.error('Port request error:', error),
});
```

## Next Steps

- See [API Reference](./API_REFERENCE.md) for detailed API documentation
- Check out [Advanced Usage](./ADVANCED_USAGE.md) for more complex patterns
- Explore [Framework Examples](../README.md#framework-examples) for framework-specific integrations

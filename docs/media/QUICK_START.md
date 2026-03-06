# Quick Start

Here's a simple example to get you started:

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

// Connect to a serial port
client.connect().subscribe({
  next: () => {
    console.log('Connected to serial port');

    // Read data from the serial port
    client.getReadStream().subscribe({
      next: (data: Uint8Array) => {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        console.log('Received:', text);
      },
      error: (error) => {
        console.error('Read error:', error);
      },
    });

    // Write data to the serial port
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello, Serial Port!\n');
    client.write(data).subscribe({
      next: () => console.log('Data written'),
      error: (error) => console.error('Write error:', error),
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

### Reading Data

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { map } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // Read and decode data
    client
      .getReadStream()
      .pipe(
        map((data: Uint8Array) => {
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(data);
        }),
      )
      .subscribe({
        next: (text) => console.log('Received:', text),
        error: (error) => console.error('Read error:', error),
      });
  },
});
```

### Writing Data

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { from } from 'rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // Write a single chunk
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello\n');
    client.write(data).subscribe({
      next: () => console.log('Written'),
      error: (error) => console.error('Write error:', error),
    });

    // Write from an Observable stream
    const messages = ['Message 1\n', 'Message 2\n', 'Message 3\n'];
    const dataStream$ = from(messages).pipe(
      map((msg) => new TextEncoder().encode(msg)),
    );
    client.writeStream(dataStream$).subscribe({
      next: () => console.log('All messages written'),
      error: (error) => console.error('Stream write error:', error),
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

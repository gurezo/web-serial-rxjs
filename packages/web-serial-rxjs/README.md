# web-serial-rxjs

A TypeScript library that provides a reactive RxJS-based wrapper for the Web Serial API, enabling easy serial port communication in web applications.

## Table of Contents

- [Features](#features)
- [Browser Support](#browser-support)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Examples](#usage-examples)
- [API Reference](#api-reference)
- [Framework Examples](#framework-examples)
- [Advanced Usage](#advanced-usage)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

## Features

- **RxJS-based reactive API**: Leverage the power of RxJS Observables for reactive serial port communication
- **TypeScript support**: Full TypeScript type definitions included
- **Browser detection**: Built-in browser support detection and error handling
- **Error handling**: Comprehensive error handling with custom error classes and error codes
- **Framework agnostic**: Works with any JavaScript/TypeScript framework or vanilla JavaScript

## Browser Support

The Web Serial API is currently only supported in Chromium-based browsers:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

The library includes built-in browser detection utilities to check for Web Serial API support before attempting to use it.

## Installation

Install the package using npm or pnpm:

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer Dependencies

This library requires RxJS as a peer dependency:

```bash
npm install rxjs
# or
pnpm add rxjs
```

**Minimum required version**: RxJS ^7.8.0

## Quick Start

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

## API Reference

### `createSerialClient(options?)`

Creates a new `SerialClient` instance.

**Parameters:**

- `options?` (optional): `SerialClientOptions` - Configuration options for the serial client

**Returns:** `SerialClient` - A new SerialClient instance

**Example:**

```typescript
const client = createSerialClient({
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});
```

### `SerialClient` Interface

The main interface for interacting with serial ports.

#### Methods

##### `requestPort(): Observable<SerialPort>`

Requests a serial port from the user. Opens a browser dialog for port selection.

**Returns:** `Observable<SerialPort>` - Emits the selected `SerialPort` instance

##### `getPorts(): Observable<SerialPort[]>`

Gets all available serial ports that the user has previously granted access to.

**Returns:** `Observable<SerialPort[]>` - Emits an array of available `SerialPort` instances

##### `connect(port?: SerialPort): Observable<void>`

Connects to a serial port. If no port is provided, will request one from the user.

**Parameters:**

- `port?` (optional): `SerialPort` - The port to connect to

**Returns:** `Observable<void>` - Completes when the port is opened

##### `disconnect(): Observable<void>`

Disconnects from the serial port.

**Returns:** `Observable<void>` - Completes when the port is closed

##### `getReadStream(): Observable<Uint8Array>`

Gets an Observable that emits data read from the serial port.

**Returns:** `Observable<Uint8Array>` - Emits `Uint8Array` chunks as data is received

##### `writeStream(data$: Observable<Uint8Array>): Observable<void>`

Writes data to the serial port from an Observable stream.

**Parameters:**

- `data$`: `Observable<Uint8Array>` - Observable that emits `Uint8Array` chunks to write

**Returns:** `Observable<void>` - Completes when writing is finished

##### `write(data: Uint8Array): Observable<void>`

Writes a single chunk of data to the serial port.

**Parameters:**

- `data`: `Uint8Array` - Data to write

**Returns:** `Observable<void>` - Completes when the data is written

#### Properties

- `connected: boolean` - Read-only property indicating if the port is currently open
- `currentPort: SerialPort | null` - Read-only property with the current `SerialPort` instance, or `null` if not connected

### `SerialClientOptions` Interface

Configuration options for creating a `SerialClient`.

```typescript
interface SerialClientOptions {
  baudRate?: number; // Default: 9600
  dataBits?: 7 | 8; // Default: 8
  stopBits?: 1 | 2; // Default: 1
  parity?: 'none' | 'even' | 'odd'; // Default: 'none'
  bufferSize?: number; // Default: 255
  flowControl?: 'none' | 'hardware'; // Default: 'none'
  filters?: SerialPortFilter[]; // Optional port filters
}
```

**Options:**

- `baudRate` (optional): Communication speed in bits per second. Default: `9600`
- `dataBits` (optional): Number of data bits per character. Either `7` or `8`. Default: `8`
- `stopBits` (optional): Number of stop bits. Either `1` or `2`. Default: `1`
- `parity` (optional): Parity checking mode. `'none'`, `'even'`, or `'odd'`. Default: `'none'`
- `bufferSize` (optional): Size of the read buffer. Default: `255`
- `flowControl` (optional): Flow control mode. `'none'` or `'hardware'`. Default: `'none'`
- `filters` (optional): Array of `SerialPortFilter` objects to filter available ports

### Error Handling

#### `SerialError` Class

Custom error class for serial port operations.

```typescript
class SerialError extends Error {
  readonly code: SerialErrorCode;
  readonly originalError?: Error;

  is(code: SerialErrorCode): boolean;
}
```

**Properties:**

- `code`: `SerialErrorCode` - The error code
- `originalError?`: `Error` - The original error that caused this error (if any)

**Methods:**

- `is(code: SerialErrorCode): boolean` - Check if the error matches a specific error code

#### `SerialErrorCode` Enum

Error codes for different types of serial port errors:

- `BROWSER_NOT_SUPPORTED` - Browser does not support Web Serial API
- `PORT_NOT_AVAILABLE` - Serial port is not available
- `PORT_OPEN_FAILED` - Failed to open serial port
- `PORT_ALREADY_OPEN` - Serial port is already open
- `PORT_NOT_OPEN` - Serial port is not open
- `READ_FAILED` - Failed to read from serial port
- `WRITE_FAILED` - Failed to write to serial port
- `CONNECTION_LOST` - Serial port connection lost
- `INVALID_FILTER_OPTIONS` - Invalid filter options
- `OPERATION_CANCELLED` - Operation was cancelled
- `UNKNOWN` - Unknown error

### Browser Detection Utilities

#### `isBrowserSupported(): boolean`

Checks if the browser supports the Web Serial API (non-throwing version).

**Returns:** `boolean` - `true` if supported, `false` otherwise

#### `checkBrowserSupport(): void`

Checks if the browser supports the Web Serial API. Throws a `SerialError` if not supported.

**Throws:** `SerialError` with code `BROWSER_NOT_SUPPORTED` if the browser doesn't support Web Serial API

#### `detectBrowserType(): BrowserType`

Detects the browser type from the user agent.

**Returns:** `BrowserType` - One of `CHROME`, `EDGE`, `OPERA`, or `UNKNOWN`

#### `hasWebSerialSupport(): boolean`

Checks if the browser has Web Serial API support using feature detection.

**Returns:** `boolean` - `true` if Web Serial API is available, `false` otherwise

### I/O Utilities

#### `readableToObservable(stream: ReadableStream<Uint8Array>): Observable<Uint8Array>`

Converts a `ReadableStream` to an RxJS `Observable`.

**Parameters:**

- `stream`: `ReadableStream<Uint8Array>` - The stream to convert

**Returns:** `Observable<Uint8Array>` - Observable that emits data chunks

#### `observableToWritable(observable: Observable<Uint8Array>): WritableStream<Uint8Array>`

Converts an RxJS `Observable` to a `WritableStream`.

**Parameters:**

- `observable`: `Observable<Uint8Array>` - The observable to convert

**Returns:** `WritableStream<Uint8Array>` - Writable stream that writes data from the observable

#### `subscribeToWritable(observable: Observable<Uint8Array>, stream: WritableStream<Uint8Array>): { unsubscribe: () => void }`

Subscribes to an Observable and writes its values to a WritableStream.

**Parameters:**

- `observable`: `Observable<Uint8Array>` - The observable to subscribe to
- `stream`: `WritableStream<Uint8Array>` - The stream to write to

**Returns:** Subscription object with `unsubscribe()` method

## Framework Examples

This repository includes example applications demonstrating how to use web-serial-rxjs with different frameworks:

- **[Vanilla JavaScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-js)** - Basic usage with vanilla JavaScript
- **[Vanilla TypeScript](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vanilla-ts)** - TypeScript example with RxJS
- **[React](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-react)** - React example with custom hook (`useSerialClient`)
- **[Vue](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-vue)** - Vue 3 example using Composition API
- **[Svelte](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-svelte)** - Svelte example using Svelte Store
- **[Angular](https://github.com/gurezo/web-serial-rxjs/tree/main/apps/example-angular)** - Angular example using a Service

Each example includes a README with setup and usage instructions.

## Advanced Usage

### Observable Patterns

You can use RxJS operators to process serial data:

```typescript
import { map, filter, bufferTime } from 'rxjs/operators';

client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    filter((text) => text.trim().length > 0),
    bufferTime(1000), // Buffer messages for 1 second
  )
  .subscribe({
    next: (messages) => {
      console.log('Buffered messages:', messages);
    },
  });
```

### Stream Processing

Process data streams with RxJS operators:

```typescript
import { map, scan, debounceTime } from 'rxjs/operators';

// Accumulate received data
client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    scan((acc, current) => acc + current, ''),
    debounceTime(500),
  )
  .subscribe({
    next: (accumulated) => {
      console.log('Accumulated data:', accumulated);
    },
  });
```

### Custom Filters

Use port filters to limit available ports:

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

### Error Recovery

Implement error recovery patterns:

```typescript
import { retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

client
  .getReadStream()
  .pipe(
    retry({
      count: 3,
      delay: 1000,
    }),
    catchError((error) => {
      console.error('Failed after retries:', error);
      return of(null); // Return empty observable
    }),
  )
  .subscribe({
    next: (data) => {
      if (data) {
        console.log('Received:', data);
      }
    },
  });
```

## Development and Release Strategy

This project follows a **trunk-based development** approach:

- **`main` branch**: Always in a release-ready state
- **Short-lived branches**: `feature/*`, `fix/*`, `docs/*` for pull requests
- **Releases**: Managed via Git tags (e.g., `v1.0.0`), not branches
- **Version maintenance**: `release/v*` branches are added only when needed for maintaining multiple major versions

For detailed contribution guidelines, see [CONTRIBUTING.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process

For Japanese contributors, please see [CONTRIBUTING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md).

## License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) file for details.

## Links

- **GitHub Repository**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API Specification**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

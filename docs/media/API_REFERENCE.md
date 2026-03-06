# API Reference

## `createSerialClient(options?)`

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

## `SerialClient` Interface

The main interface for interacting with serial ports.

### Methods

#### `requestPort(): Observable<SerialPort>`

Requests a serial port from the user. Opens a browser dialog for port selection.

**Returns:** `Observable<SerialPort>` - Emits the selected `SerialPort` instance

#### `getPorts(): Observable<SerialPort[]>`

Gets all available serial ports that the user has previously granted access to.

**Returns:** `Observable<SerialPort[]>` - Emits an array of available `SerialPort` instances

#### `connect(port?: SerialPort): Observable<void>`

Connects to a serial port. If no port is provided, will request one from the user.

**Parameters:**

- `port?` (optional): `SerialPort` - The port to connect to

**Returns:** `Observable<void>` - Completes when the port is opened

#### `disconnect(): Observable<void>`

Disconnects from the serial port.

**Returns:** `Observable<void>` - Completes when the port is closed

#### `getReadStream(): Observable<Uint8Array>`

Gets an Observable that emits data read from the serial port.

**Returns:** `Observable<Uint8Array>` - Emits `Uint8Array` chunks as data is received

#### `writeStream(data$: Observable<Uint8Array>): Observable<void>`

Writes data to the serial port from an Observable stream.

**Parameters:**

- `data$`: `Observable<Uint8Array>` - Observable that emits `Uint8Array` chunks to write

**Returns:** `Observable<void>` - Completes when writing is finished

#### `write(data: Uint8Array): Observable<void>`

Writes a single chunk of data to the serial port.

**Parameters:**

- `data`: `Uint8Array` - Data to write

**Returns:** `Observable<void>` - Completes when the data is written

### Properties

- `connected: boolean` - Read-only property indicating if the port is currently open
- `currentPort: SerialPort | null` - Read-only property with the current `SerialPort` instance, or `null` if not connected

## `SerialClientOptions` Interface

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

## Error Handling

### `SerialError` Class

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

### `SerialErrorCode` Enum

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

## Browser Detection Utilities

### `isBrowserSupported(): boolean`

Checks if the browser supports the Web Serial API (non-throwing version).

**Returns:** `boolean` - `true` if supported, `false` otherwise

### `checkBrowserSupport(): void`

Checks if the browser supports the Web Serial API. Throws a `SerialError` if not supported.

**Throws:** `SerialError` with code `BROWSER_NOT_SUPPORTED` if the browser doesn't support Web Serial API

### `detectBrowserType(): BrowserType`

Detects the browser type from the user agent.

**Returns:** `BrowserType` - One of `CHROME`, `EDGE`, `OPERA`, or `UNKNOWN`

### `hasWebSerialSupport(): boolean`

Checks if the browser has Web Serial API support using feature detection.

**Returns:** `boolean` - `true` if Web Serial API is available, `false` otherwise

## I/O Utilities

### `readableToObservable(stream: ReadableStream<Uint8Array>): Observable<Uint8Array>`

Converts a `ReadableStream` to an RxJS `Observable`.

**Parameters:**

- `stream`: `ReadableStream<Uint8Array>` - The stream to convert

**Returns:** `Observable<Uint8Array>` - Observable that emits data chunks

### `observableToWritable(observable: Observable<Uint8Array>): WritableStream<Uint8Array>`

Converts an RxJS `Observable` to a `WritableStream`.

**Parameters:**

- `observable`: `Observable<Uint8Array>` - The observable to convert

**Returns:** `WritableStream<Uint8Array>` - Writable stream that writes data from the observable

### `subscribeToWritable(observable: Observable<Uint8Array>, stream: WritableStream<Uint8Array>): { unsubscribe: () => void }`

Subscribes to an Observable and writes its values to a WritableStream.

**Parameters:**

- `observable`: `Observable<Uint8Array>` - The observable to subscribe to
- `stream`: `WritableStream<Uint8Array>` - The stream to write to

**Returns:** Subscription object with `unsubscribe()` method

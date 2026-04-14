import { Observable } from 'rxjs';
import { SerialError } from '../errors/serial-error';
import { SerialClientOptions } from '../types/options';
import type {
  CommandResult,
  SerialCommandOptions,
  SerialRequest,
} from './protocol';
import { SerialClientImpl } from './serial-client';
import { SerialState, SerialSupport } from './serial-state';

/**
 * SerialClient interface for interacting with serial ports using RxJS Observables.
 *
 * This interface provides a reactive API for serial port communication, allowing you to
 * connect to serial devices, read and write data using RxJS Observables.
 *
 * @example
 * ```typescript
 * const client = createSerialClient({ baudRate: 9600 });
 *
 * // Connect to a port
 * client.connect().subscribe({
 *   next: () => {
 *     console.log('Connected!');
 *
 *     // Read data
 *     client.text$.subscribe({
 *       next: (text) => console.log('Received:', text),
 *     });
 *
 *     // Write data
 *     const encoder = new TextEncoder();
 *     client.write(encoder.encode('Hello')).subscribe();
 *   },
 *   error: (error) => console.error('Connection error:', error),
 * });
 * ```
 */
export interface SerialClient {
  /**
   * Get the browser support information for Web Serial API.
   *
   * This method never throws. Use it to branch UI behavior before calling connect.
   *
   * @returns Browser support information
   */
  support(): SerialSupport;

  /**
   * Request a serial port from the user.
   *
   * This method opens the browser's port selection dialog and returns an Observable
   * that emits the selected SerialPort when the user chooses a port.
   *
   * @returns An Observable that emits the selected {@link SerialPort} when the user selects a port
   * @throws {@link SerialError} with code {@link SerialErrorCode.OPERATION_CANCELLED} if the user cancels the selection
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_AVAILABLE} if the port request fails
   * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the browser doesn't support Web Serial API
   *
   * @example
   * ```typescript
   * client.requestPort().subscribe({
   *   next: (port) => console.log('Selected port:', port),
   *   error: (error) => console.error('Port selection failed:', error),
   * });
   * ```
   */
  requestPort(): Observable<SerialPort>;

  /**
   * Get available serial ports that have been previously granted access.
   *
   * This method returns an Observable that emits an array of SerialPort instances
   * that the user has previously granted access to in this browser session.
   *
   * @returns An Observable that emits an array of available {@link SerialPort} instances
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_AVAILABLE} if getting ports fails
   * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the browser doesn't support Web Serial API
   *
   * @example
   * ```typescript
   * client.getPorts().subscribe({
   *   next: (ports) => {
   *     console.log(`Found ${ports.length} available ports`);
   *     if (ports.length > 0) {
   *       client.connect(ports[0]).subscribe();
   *     }
   *   },
   * });
   * ```
   */
  getPorts(): Observable<SerialPort[]>;

  /**
   * Connect to a serial port.
   *
   * Opens the specified port (or requests one if not provided) and configures it
   * with the options passed to {@link createSerialClient}. The port must be connected
   * before reading or writing data.
   *
   * @param port - Optional {@link SerialPort} to connect to. If not provided, will call {@link requestPort} to prompt the user.
   * @returns An Observable that completes when the port is successfully opened
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_ALREADY_OPEN} if a port is already open
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_OPEN_FAILED} if opening the port fails
   * @throws {@link SerialError} with code {@link SerialErrorCode.OPERATION_CANCELLED} if the user cancels port selection
   * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the browser doesn't support Web Serial API
   *
   * @example
   * ```typescript
   * // Connect by requesting a port
   * client.connect().subscribe({
   *   next: () => console.log('Connected!'),
   *   error: (error) => console.error('Connection failed:', error),
   * });
   *
   * // Connect to a specific port
   * client.getPorts().subscribe({
   *   next: (ports) => {
   *     if (ports.length > 0) {
   *       client.connect(ports[0]).subscribe();
   *     }
   *   },
   * });
   * ```
   */
  connect(port?: SerialPort): Observable<void>;

  /**
   * Disconnect from the serial port.
   *
   * Closes the currently open port and stops all active read/write streams.
   * This method is safe to call even if no port is currently open.
   *
   * @returns An Observable that completes when the port is successfully closed
   * @throws {@link SerialError} with code {@link SerialErrorCode.CONNECTION_LOST} if closing the port fails
   *
   * @example
   * ```typescript
   * client.disconnect().subscribe({
   *   next: () => console.log('Disconnected'),
   *   error: (error) => console.error('Disconnect failed:', error),
   * });
   * ```
   */
  disconnect(): Observable<void>;

  /**
   * Get an Observable that emits received byte chunks.
   *
   * This stream is driven by an internal read pump and becomes active after connect.
   *
   * @returns An Observable that emits Uint8Array chunks from the serial port
   */
  readonly bytes$: Observable<Uint8Array>;

  /**
   * Get an Observable that emits decoded text chunks.
   *
   * This stream decodes bytes with TextDecoder in streaming mode.
   *
   * @returns An Observable that emits decoded text chunks
   */
  readonly text$: Observable<string>;

  /**
   * Get an Observable that emits newline-delimited text lines.
   *
   * Lines are emitted without trailing newline characters.
   *
   * @returns An Observable that emits parsed line strings
   */
  readonly lines$: Observable<string>;

  /**
   * Enqueue serial data for ordered writes.
   *
   * This API serializes all send operations internally so that concurrent calls
   * are written to the port one-by-one in call order.
   *
   * @param data - Text or bytes to write to the serial port
   * @returns An Observable that completes when the enqueued payload is written
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_OPEN} if the port is not open
   * @throws {@link SerialError} with code {@link SerialErrorCode.WRITE_FAILED} if writing fails
   */
  send$(data: string | Uint8Array): Observable<void>;

  /**
   * Execute a command and collect output until prompt.
   *
   * @param command - Command text to send
   * @param options - Prompt matching and timeout options
   * @returns An Observable that emits captured stdout
   */
  command$(command: string, options?: SerialCommandOptions): Observable<CommandResult>;

  /**
   * Execute a protocol transaction with custom response collector.
   *
   * @param request - Transaction request options
   * @returns An Observable that emits collected value
   */
  transact$<T>(request: SerialRequest<T>): Observable<T>;

  /**
   * Write a single chunk of data to the serial port.
   *
   * Writes a single Uint8Array chunk to the serial port immediately.
   * For queued ordering semantics, prefer {@link send$}.
   *
   * @param data - Uint8Array data to write to the serial port
   * @returns An Observable that completes when the data has been written
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_OPEN} if the port is not open
   * @throws {@link SerialError} with code {@link SerialErrorCode.WRITE_FAILED} if writing fails
   *
   * @example
   * ```typescript
   * const encoder = new TextEncoder();
   * const data = encoder.encode('Hello, Serial!');
   *
   * client.write(data).subscribe({
   *   next: () => console.log('Data written'),
   *   error: (error) => console.error('Write error:', error),
   * });
   * ```
   */
  write(data: Uint8Array): Observable<void>;

  /**
   * Write text data to the serial port.
   *
   * This is a convenience API on top of {@link send$}.
   *
   * @param data - Text data to write to the serial port
   * @returns An Observable that completes when the data has been written
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_OPEN} if the port is not open
   * @throws {@link SerialError} with code {@link SerialErrorCode.WRITE_FAILED} if writing fails
   */
  writeText(data: string): Observable<void>;

  /**
   * Check if the port is currently open and connected.
   *
   * @returns `true` if a port is currently open, `false` otherwise
   */
  readonly connected: boolean;

  /**
   * Reactive connection state stream.
   *
   * Emits `true` when connected and `false` when disconnected.
   */
  readonly connected$: Observable<boolean>;

  /**
   * Reactive serial state stream.
   *
   * Emits detailed connection lifecycle and error states.
   */
  readonly state$: Observable<SerialState>;

  /**
   * Reactive error stream.
   *
   * Emits all {@link SerialError} instances produced by this client.
   */
  readonly errors$: Observable<SerialError>;

  /**
   * Reactive connection event stream.
   *
   * Emits `'connected'` on successful connection and `'disconnected'` on disconnection.
   */
  readonly connectionEvents$: Observable<'connected' | 'disconnected'>;

  /**
   * Get the current SerialPort instance.
   *
   * Returns the currently connected SerialPort instance, or `null` if no port is open.
   * This allows direct access to the underlying Web Serial API SerialPort object if needed.
   *
   * @returns The current {@link SerialPort} instance, or `null` if no port is open
   */
  readonly currentPort: SerialPort | null;
}

/**
 * Browser support information for Web Serial API.
 */
export type { SerialState, SerialSupport };
export type {
  CommandResult,
  SerialCommandOptions,
  SerialRequest,
} from './protocol';

/**
 * Create a new SerialClient instance for interacting with serial ports.
 *
 * This is the main entry point for creating a serial client. The client provides
 * a reactive RxJS-based API for connecting to serial ports and reading/writing data.
 *
 * @param options - Optional configuration options for the serial port connection.
 *                  If not provided, default values will be used (9600 baud, 8 data bits, etc.)
 * @returns A new {@link SerialClient} instance
 * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the browser doesn't support Web Serial API
 *
 * @example
 * ```typescript
 * // Create a client with default settings (9600 baud)
 * const client = createSerialClient();
 *
 * // Create a client with custom settings
 * const client = createSerialClient({
 *   baudRate: 115200,
 *   dataBits: 8,
 *   stopBits: 1,
 *   parity: 'none',
 *   filters: [{ usbVendorId: 0x1234 }],
 * });
 *
 * // Check browser support before creating a client
 * import { isBrowserSupported } from '@gurezo/web-serial-rxjs';
 *
 * if (!isBrowserSupported()) {
 *   console.error('Web Serial API is not supported');
 * } else {
 *   const client = createSerialClient();
 * }
 * ```
 */
export function createSerialClient(
  options?: SerialClientOptions,
): SerialClient {
  return new SerialClientImpl(options);
}

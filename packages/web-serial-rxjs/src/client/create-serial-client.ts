import { Observable } from 'rxjs';
import { SerialClientOptions } from '../types/options';
import { SerialClientImpl } from './serial-client-impl';

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
 *     client.getReadStream().subscribe({
 *       next: (data) => console.log('Received:', data),
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
   * Get an Observable that emits data read from the serial port.
   *
   * Returns an Observable stream that emits Uint8Array chunks as data is received
   * from the serial port. The stream will continue until the port is disconnected
   * or an error occurs.
   *
   * @returns An Observable that emits Uint8Array chunks containing data read from the serial port
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_OPEN} if the port is not open
   *
   * @example
   * ```typescript
   * client.getReadStream().subscribe({
   *   next: (data) => {
   *     const text = new TextDecoder().decode(data);
   *     console.log('Received:', text);
   *   },
   *   error: (error) => console.error('Read error:', error),
   * });
   * ```
   */
  getReadStream(): Observable<Uint8Array>;

  /**
   * Write data to the serial port from an Observable.
   *
   * Writes data from an Observable stream to the serial port. The Observable should
   * emit Uint8Array chunks that will be written sequentially to the port. If a previous
   * write stream is active, it will be cancelled before starting the new one.
   *
   * @param data$ - Observable that emits Uint8Array chunks to write to the serial port
   * @returns An Observable that completes when all data has been written and the stream completes
   * @throws {@link SerialError} with code {@link SerialErrorCode.PORT_NOT_OPEN} if the port is not open
   * @throws {@link SerialError} with code {@link SerialErrorCode.WRITE_FAILED} if writing fails
   *
   * @example
   * ```typescript
   * const data$ = from([
   *   new TextEncoder().encode('Hello'),
   *   new TextEncoder().encode('World'),
   * ]);
   *
   * client.writeStream(data$).subscribe({
   *   next: () => console.log('Writing...'),
   *   complete: () => console.log('All data written'),
   *   error: (error) => console.error('Write error:', error),
   * });
   * ```
   */
  writeStream(data$: Observable<Uint8Array>): Observable<void>;

  /**
   * Write a single chunk of data to the serial port.
   *
   * Writes a single Uint8Array chunk to the serial port. For writing multiple chunks,
   * consider using {@link writeStream} with an Observable instead.
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
   * Check if the port is currently open and connected.
   *
   * @returns `true` if a port is currently open, `false` otherwise
   */
  readonly connected: boolean;

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

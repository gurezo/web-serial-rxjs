import { Observable } from 'rxjs';
import { SerialClientOptions } from '../types/options';
import { SerialClientImpl } from './serial-client-impl';

/**
 * SerialClient interface
 */
export interface SerialClient {
  /**
   * Request a serial port from the user
   * @returns Observable that emits the selected SerialPort
   */
  requestPort(): Observable<SerialPort>;

  /**
   * Get available serial ports
   * @returns Observable that emits an array of available SerialPorts
   */
  getPorts(): Observable<SerialPort[]>;

  /**
   * Connect to a serial port
   * @param port Optional SerialPort to connect to. If not provided, will request one.
   * @returns Observable that completes when the port is opened
   */
  connect(port?: SerialPort): Observable<void>;

  /**
   * Disconnect from the serial port
   * @returns Observable that completes when the port is closed
   */
  disconnect(): Observable<void>;

  /**
   * Get an Observable that emits data read from the serial port
   * @returns Observable that emits Uint8Array chunks
   */
  getReadStream(): Observable<Uint8Array>;

  /**
   * Write data to the serial port from an Observable
   * @param data$ Observable that emits Uint8Array chunks to write
   * @returns Observable that completes when writing is finished
   */
  writeStream(data$: Observable<Uint8Array>): Observable<void>;

  /**
   * Write a single chunk of data to the serial port
   * @param data Data to write
   * @returns Observable that completes when the data is written
   */
  write(data: Uint8Array): Observable<void>;

  /**
   * Check if the port is currently open
   */
  readonly connected: boolean;

  /**
   * Get the current SerialPort instance
   */
  readonly currentPort: SerialPort | null;
}

/**
 * Create a new SerialClient instance
 * @param options Optional configuration options
 * @returns A new SerialClient instance
 */
export function createSerialClient(
  options?: SerialClientOptions,
): SerialClient {
  return new SerialClientImpl(options);
}

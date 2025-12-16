import { Observable } from 'rxjs';
import { checkBrowserSupport } from '../browser/browser-support';
import { SerialError, SerialErrorCode } from '../errors/serial-error';
import { buildRequestOptions } from '../filters/build-request-options';
import { subscribeToWritable } from '../io/observable-to-writable';
import { readableToObservable } from '../io/readable-to-observable';
import {
  DEFAULT_SERIAL_CLIENT_OPTIONS,
  SerialClientOptions,
} from '../types/options';

/**
 * Internal implementation of SerialClient
 */
export class SerialClientImpl {
  private port: SerialPort | null = null;
  private isOpen = false;
  private readSubscription: { unsubscribe: () => void } | null = null;
  private writeSubscription: { unsubscribe: () => void } | null = null;
  private readonly options: Required<Omit<SerialClientOptions, 'filters'>> & {
    filters?: SerialClientOptions['filters'];
  };

  constructor(options?: SerialClientOptions) {
    checkBrowserSupport();
    this.options = {
      ...DEFAULT_SERIAL_CLIENT_OPTIONS,
      ...options,
      filters: options?.filters,
    };
  }

  /**
   * Request a serial port from the user
   * @returns Promise that resolves to the selected SerialPort
   */
  async requestPort(): Promise<SerialPort> {
    checkBrowserSupport();

    try {
      const requestOptions = buildRequestOptions(this.options);
      const port = await navigator.serial.requestPort(requestOptions);
      return port;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        throw new SerialError(
          SerialErrorCode.OPERATION_CANCELLED,
          'Port selection was cancelled by the user',
          error,
        );
      }
      throw new SerialError(
        SerialErrorCode.PORT_NOT_AVAILABLE,
        `Failed to request port: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get available serial ports
   * @returns Promise that resolves to an array of available SerialPorts
   */
  async getPorts(): Promise<SerialPort[]> {
    checkBrowserSupport();

    try {
      return await navigator.serial.getPorts();
    } catch (error) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_AVAILABLE,
        `Failed to get ports: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Connect to a serial port
   * @param port Optional SerialPort to connect to. If not provided, will request one.
   * @returns Promise that resolves when the port is opened
   */
  async connect(port?: SerialPort): Promise<void> {
    checkBrowserSupport();

    if (this.isOpen) {
      throw new SerialError(
        SerialErrorCode.PORT_ALREADY_OPEN,
        'Port is already open',
      );
    }

    try {
      if (!port) {
        port = await this.requestPort();
      }

      this.port = port;

      await this.port.open({
        baudRate: this.options.baudRate,
        dataBits: this.options.dataBits,
        stopBits: this.options.stopBits,
        parity: this.options.parity,
        bufferSize: this.options.bufferSize,
        flowControl: this.options.flowControl,
      });

      this.isOpen = true;
    } catch (error) {
      this.port = null;
      this.isOpen = false;

      if (error instanceof SerialError) {
        throw error;
      }

      throw new SerialError(
        SerialErrorCode.PORT_OPEN_FAILED,
        `Failed to open port: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Disconnect from the serial port
   * @returns Promise that resolves when the port is closed
   */
  async disconnect(): Promise<void> {
    if (!this.isOpen || !this.port) {
      return;
    }

    try {
      // Unsubscribe from read/write streams
      if (this.readSubscription) {
        this.readSubscription.unsubscribe();
        this.readSubscription = null;
      }

      if (this.writeSubscription) {
        this.writeSubscription.unsubscribe();
        this.writeSubscription = null;
      }

      // Close the port
      await this.port.close();
      this.port = null;
      this.isOpen = false;
    } catch (error) {
      this.port = null;
      this.isOpen = false;

      throw new SerialError(
        SerialErrorCode.CONNECTION_LOST,
        `Failed to close port: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Get an Observable that emits data read from the serial port
   * @returns Observable that emits Uint8Array chunks
   */
  getReadStream(): Observable<Uint8Array> {
    if (!this.isOpen || !this.port || !this.port.readable) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Port is not open or readable stream is not available',
      );
    }

    return readableToObservable(this.port.readable);
  }

  /**
   * Write data to the serial port from an Observable
   * @param data$ Observable that emits Uint8Array chunks to write
   * @returns Observable that completes when writing is finished
   */
  writeStream(data$: Observable<Uint8Array>): Observable<void> {
    if (!this.isOpen || !this.port || !this.port.writable) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Port is not open or writable stream is not available',
      );
    }

    // Cancel previous write subscription if exists
    if (this.writeSubscription) {
      this.writeSubscription.unsubscribe();
    }

    this.writeSubscription = subscribeToWritable(data$, this.port.writable);

    return new Observable<void>((subscriber) => {
      // The subscription is already active, we just need to track completion
      if (!this.writeSubscription) {
        subscriber.error(
          new SerialError(
            SerialErrorCode.WRITE_FAILED,
            'Write subscription is not available'
          )
        );
        return;
      }
      const originalUnsubscribe = this.writeSubscription.unsubscribe;

      this.writeSubscription = {
        unsubscribe: () => {
          originalUnsubscribe();
          subscriber.complete();
        },
      };

      // If the observable completes, complete the subscriber
      data$.subscribe({
        complete: () => {
          if (this.writeSubscription) {
            this.writeSubscription.unsubscribe();
            this.writeSubscription = null;
          }
          subscriber.complete();
        },
        error: (error) => {
          if (this.writeSubscription) {
            this.writeSubscription.unsubscribe();
            this.writeSubscription = null;
          }
          subscriber.error(error);
        },
      });
    });
  }

  /**
   * Write a single chunk of data to the serial port
   * @param data Data to write
   * @returns Promise that resolves when the data is written
   */
  async write(data: Uint8Array): Promise<void> {
    if (!this.isOpen || !this.port || !this.port.writable) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Port is not open or writable stream is not available',
      );
    }

    try {
      const writer = this.port.writable.getWriter();
      try {
        await writer.write(data);
      } finally {
        writer.releaseLock();
      }
    } catch (error) {
      throw new SerialError(
        SerialErrorCode.WRITE_FAILED,
        `Failed to write data: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  }

  /**
   * Check if the port is currently open
   */
  get connected(): boolean {
    return this.isOpen;
  }

  /**
   * Get the current SerialPort instance
   */
  get currentPort(): SerialPort | null {
    return this.port;
  }
}

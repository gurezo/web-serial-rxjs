import { Observable, defer, switchMap } from 'rxjs';
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
 * Internal implementation of SerialClient interface.
 *
 * This class implements the {@link SerialClient} interface and provides the actual
 * functionality for serial port communication. Users should not instantiate this class
 * directly; instead, use {@link createSerialClient} to create a SerialClient instance.
 *
 * @internal
 */
export class SerialClientImpl {
  /** @internal */
  private port: SerialPort | null = null;
  /** @internal */
  private isOpen = false;
  /** @internal */
  private readSubscription: { unsubscribe: () => void } | null = null;
  /** @internal */
  private writeSubscription: { unsubscribe: () => void } | null = null;
  /** @internal */
  private readonly options: Required<Omit<SerialClientOptions, 'filters'>> & {
    filters?: SerialClientOptions['filters'];
  };

  /**
   * Creates a new SerialClientImpl instance.
   *
   * @param options - Optional configuration options for the serial port connection
   * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the browser doesn't support Web Serial API
   * @internal
   */
  constructor(options?: SerialClientOptions) {
    checkBrowserSupport();
    this.options = {
      ...DEFAULT_SERIAL_CLIENT_OPTIONS,
      ...options,
      filters: options?.filters,
    };
  }

  /**
   * Request a serial port from the user.
   *
   * @returns Observable that emits the selected SerialPort
   * @internal
   */
  requestPort(): Observable<SerialPort> {
    return defer(() => {
      checkBrowserSupport();

      return navigator.serial
        .requestPort(buildRequestOptions(this.options))
        .catch((error) => {
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
        });
    });
  }

  /**
   * Get available serial ports.
   *
   * @returns Observable that emits an array of available SerialPorts
   * @internal
   */
  getPorts(): Observable<SerialPort[]> {
    return defer(() => {
      checkBrowserSupport();

      return navigator.serial.getPorts().catch((error) => {
        throw new SerialError(
          SerialErrorCode.PORT_NOT_AVAILABLE,
          `Failed to get ports: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      });
    });
  }

  /**
   * Connect to a serial port.
   *
   * @param port - Optional SerialPort to connect to. If not provided, will request one.
   * @returns Observable that completes when the port is opened
   * @internal
   */
  connect(port?: SerialPort): Observable<void> {
    checkBrowserSupport();

    if (this.isOpen) {
      return new Observable<void>((subscriber) => {
        subscriber.error(
          new SerialError(
            SerialErrorCode.PORT_ALREADY_OPEN,
            'Port is already open',
          ),
        );
      });
    }

    const port$ = port
      ? new Observable<SerialPort>((subscriber) => {
          subscriber.next(port);
          subscriber.complete();
        })
      : this.requestPort();

    return port$.pipe(
      switchMap((selectedPort) => {
        return defer(() => {
          this.port = selectedPort;

          return this.port
            .open({
              baudRate: this.options.baudRate,
              dataBits: this.options.dataBits,
              stopBits: this.options.stopBits,
              parity: this.options.parity,
              bufferSize: this.options.bufferSize,
              flowControl: this.options.flowControl,
            })
            .then(() => {
              this.isOpen = true;
            })
            .catch((error) => {
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
            });
        });
      }),
    );
  }

  /**
   * Disconnect from the serial port.
   *
   * @returns Observable that completes when the port is closed
   * @internal
   */
  disconnect(): Observable<void> {
    return defer(() => {
      if (!this.isOpen || !this.port) {
        return Promise.resolve();
      }

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
      return this.port
        .close()
        .then(() => {
          this.port = null;
          this.isOpen = false;
        })
        .catch((error) => {
          this.port = null;
          this.isOpen = false;

          throw new SerialError(
            SerialErrorCode.CONNECTION_LOST,
            `Failed to close port: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    });
  }

  /**
   * Get an Observable that emits data read from the serial port.
   *
   * @returns Observable that emits Uint8Array chunks
   * @internal
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
   * Write data to the serial port from an Observable.
   *
   * @param data$ - Observable that emits Uint8Array chunks to write
   * @returns Observable that completes when writing is finished
   * @internal
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
            'Write subscription is not available',
          ),
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
   * Write a single chunk of data to the serial port.
   *
   * @param data - Data to write
   * @returns Observable that completes when the data is written
   * @internal
   */
  write(data: Uint8Array): Observable<void> {
    return defer(() => {
      if (!this.isOpen || !this.port || !this.port.writable) {
        throw new SerialError(
          SerialErrorCode.PORT_NOT_OPEN,
          'Port is not open or writable stream is not available',
        );
      }

      const writer = this.port.writable.getWriter();
      return writer
        .write(data)
        .then(() => {
          writer.releaseLock();
        })
        .catch((error) => {
          writer.releaseLock();
          throw new SerialError(
            SerialErrorCode.WRITE_FAILED,
            `Failed to write data: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : new Error(String(error)),
          );
        });
    });
  }

  /**
   * Check if the port is currently open.
   *
   * @returns `true` if a port is currently open, `false` otherwise
   * @internal
   */
  get connected(): boolean {
    return this.isOpen;
  }

  /**
   * Get the current SerialPort instance.
   *
   * @returns The current SerialPort instance, or `null` if no port is open
   * @internal
   */
  get currentPort(): SerialPort | null {
    return this.port;
  }
}

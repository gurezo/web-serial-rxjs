import {
  BehaviorSubject,
  Observable,
  Subject,
  defaultIfEmpty,
  defer,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  switchMap,
  throwError,
} from 'rxjs';
import {
  BrowserType,
  detectBrowserType,
  hasWebSerialSupport,
} from '../browser/browser-detection';
import { SerialError, SerialErrorCode } from '../errors/serial-error';
import { buildRequestOptions } from '../filters/build-request-options';
import { readableToObservable } from '../io/readable-to-observable';
import type {
  CommandResult,
  SerialCommandOptions,
  SerialRequest,
} from './protocol';
import {
  DEFAULT_SERIAL_CLIENT_OPTIONS,
  SerialClientOptions,
} from '../types/options';
import type { SerialState, SerialSupport } from './serial-state';

const DEFAULT_PROMPT = '$ ';
const DEFAULT_PROTOCOL_TIMEOUT_MS = 10_000;
const DEFAULT_PROTOCOL_LINE_ENDING = '\r\n';

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
  private textEncoder = new TextEncoder();
  /** @internal */
  private textDecoder = new TextDecoder();
  /** @internal */
  private lineBuffer = '';
  /** @internal */
  private readonly bytesSubject$ = new Subject<Uint8Array>();
  /** @internal */
  private readonly textSubject$ = new Subject<string>();
  /** @internal */
  private readonly linesSubject$ = new Subject<string>();
  /** @internal */
  private readonly bufferTick$ = new Subject<void>();
  /** @internal */
  private operationQueue: Promise<void> = Promise.resolve();
  /** @internal */
  private readBuffer = '';
  /** @internal */
  private readonly stateSubject$: BehaviorSubject<SerialState>;
  /** @internal */
  private readonly errorsSubject$ = new Subject<SerialError>();
  /** @internal */
  private readonly connectionEventsSubject$ = new Subject<
    'connected' | 'disconnected'
  >();
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
    this.options = {
      ...DEFAULT_SERIAL_CLIENT_OPTIONS,
      ...options,
      filters: options?.filters,
    };
    this.stateSubject$ = new BehaviorSubject<SerialState>(this.getInitialState());
  }

  /**
   * Request a serial port from the user.
   *
   * @returns Observable that emits the selected SerialPort
   * @internal
   */
  requestPort(): Observable<SerialPort> {
    return defer(() => {
      const support = this.support();
      if (!support.supported) {
        const error = this.createUnsupportedError(support);
        this.setUnsupportedState(support);
        this.errorsSubject$.next(error);
        throw error;
      }

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
      const support = this.support();
      if (!support.supported) {
        const error = this.createUnsupportedError(support);
        this.setUnsupportedState(support);
        this.errorsSubject$.next(error);
        throw error;
      }

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
    const support = this.support();
    if (!support.supported) {
      this.setUnsupportedState(support);
      const error = this.createUnsupportedError(support);
      this.errorsSubject$.next(error);
      return throwError(() => error);
    }

    if (this.isOpen) {
      const error = new SerialError(
        SerialErrorCode.PORT_ALREADY_OPEN,
        'Port is already open',
      );
      this.errorsSubject$.next(error);
      this.stateSubject$.next({ kind: 'error', error });
      return throwError(() => error);
    }
    this.stateSubject$.next({ kind: 'connecting' });

    const port$ = port ? of(port) : this.requestPort();

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
              this.startReadPump();
              this.stateSubject$.next({ kind: 'connected' });
              this.connectionEventsSubject$.next('connected');
            })
            .catch((error) => {
              this.port = null;
              this.isOpen = false;

              if (error instanceof SerialError) {
                throw error;
              }

              const serialError = new SerialError(
                SerialErrorCode.PORT_OPEN_FAILED,
                `Failed to open port: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : new Error(String(error)),
              );
              this.errorsSubject$.next(serialError);
              this.stateSubject$.next({ kind: 'error', error: serialError });
              throw serialError;
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
        this.stateSubject$.next({ kind: 'idle' });
        return Promise.resolve();
      }
      this.stateSubject$.next({ kind: 'disconnecting' });

      // Unsubscribe from read/write streams
      if (this.readSubscription) {
        this.readSubscription.unsubscribe();
        this.readSubscription = null;
      }
      this.resetReceiveState();

      // Close the port
      return this.port
        .close()
        .then(() => {
          this.port = null;
          this.isOpen = false;
          this.stateSubject$.next({ kind: 'idle' });
          this.connectionEventsSubject$.next('disconnected');
        })
        .catch((error) => {
          this.port = null;
          this.isOpen = false;
          const serialError = new SerialError(
            SerialErrorCode.CONNECTION_LOST,
            `Failed to close port: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error : new Error(String(error)),
          );
          this.errorsSubject$.next(serialError);
          this.stateSubject$.next({ kind: 'error', error: serialError });

          throw serialError;
        });
    });
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.enqueueOperation(async () => {
      const payload =
        typeof data === 'string' ? this.textEncoder.encode(data) : data;
      await firstValueFrom(this.write(payload).pipe(defaultIfEmpty(undefined)));
    });
  }

  command$(
    command: string,
    options?: SerialCommandOptions,
  ): Observable<CommandResult> {
    return this.enqueueOperation(async () => {
      await this.sendCommandPayload(command, options?.lineEnding);
      const stdout = await this.waitUntilPrompt(
        options?.prompt ?? DEFAULT_PROMPT,
        options?.timeout ?? DEFAULT_PROTOCOL_TIMEOUT_MS,
      );
      return { stdout };
    });
  }

  transact$<T>(request: SerialRequest<T>): Observable<T> {
    return this.enqueueOperation(async () => {
      await this.sendRequestPayload(request.payload, request.lineEnding);
      const stdout = await this.waitUntilPrompt(
        request.prompt ?? DEFAULT_PROMPT,
        request.timeout ?? DEFAULT_PROTOCOL_TIMEOUT_MS,
      );
      return request.collect(stdout);
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
   * Write text data to the serial port.
   *
   * @param data - Text data to write
   * @returns Observable that completes when the data is written
   * @internal
   */
  writeText(data: string): Observable<void> {
    return this.send$(data);
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
   * Get an Observable that emits connection state changes.
   *
   * @returns Observable that emits `true` when connected and `false` when disconnected
   * @internal
   */
  get connected$(): Observable<boolean> {
    return this.stateSubject$
      .asObservable()
      .pipe(
        map((state) => state.kind === 'connected'),
        distinctUntilChanged(),
      );
  }

  /**
   * Get a reactive byte stream from the serial port.
   *
   * @returns Observable that emits received byte chunks while connected
   * @internal
   */
  get bytes$(): Observable<Uint8Array> {
    return this.bytesSubject$.asObservable();
  }

  /**
   * Get a reactive decoded text stream from the serial port.
   *
   * @returns Observable that emits decoded text chunks while connected
   * @internal
   */
  get text$(): Observable<string> {
    return this.textSubject$.asObservable();
  }

  /**
   * Get a reactive line-based stream from the serial port.
   *
   * @returns Observable that emits each completed line without trailing newline
   * @internal
   */
  get lines$(): Observable<string> {
    return this.linesSubject$.asObservable();
  }

  /**
   * Get detailed serial lifecycle states.
   *
   * @returns Observable of serial state machine events
   * @internal
   */
  get state$(): Observable<SerialState> {
    return this.stateSubject$.asObservable();
  }

  /**
   * Get serial error stream.
   *
   * @returns Observable of aggregated serial errors
   * @internal
   */
  get errors$(): Observable<SerialError> {
    return this.errorsSubject$.asObservable();
  }

  /**
   * Get an Observable that emits connection lifecycle events.
   *
   * @returns Observable that emits 'connected' or 'disconnected'
   * @internal
   */
  get connectionEvents$(): Observable<'connected' | 'disconnected'> {
    return this.connectionEventsSubject$.asObservable();
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

  /**
   * Check Web Serial support information.
   *
   * @returns Browser support data
   * @internal
   */
  support(): SerialSupport {
    const browser = detectBrowserType();
    const supported = hasWebSerialSupport();
    if (supported) {
      return { supported: true, browser };
    }

    return {
      supported: false,
      browser,
      reason: this.buildUnsupportedMessage(browser),
    };
  }

  private getInitialState(): SerialState {
    const support = this.support();
    if (!support.supported) {
      return { kind: 'unsupported', support };
    }
    return { kind: 'idle' };
  }

  private setUnsupportedState(support: SerialSupport): void {
    this.stateSubject$.next({ kind: 'unsupported', support });
  }

  private createUnsupportedError(support: SerialSupport): SerialError {
    return new SerialError(
      SerialErrorCode.BROWSER_NOT_SUPPORTED,
      support.supported
        ? 'Web Serial API is supported'
        : support.reason,
    );
  }

  private buildUnsupportedMessage(browser: BrowserType): string {
    const browserName =
      browser === BrowserType.UNKNOWN ? 'your browser' : browser.toUpperCase();
    return `Web Serial API is not supported in ${browserName}. Please use a Chromium-based browser (Chrome, Edge, or Opera).`;
  }

  private startReadPump(): void {
    if (!this.port?.readable) {
      return;
    }
    this.readSubscription?.unsubscribe();
    this.readSubscription = readableToObservable(this.port.readable).subscribe({
      next: (chunk) => this.handleIncomingChunk(chunk),
      error: (error) => {
        const serialError =
          error instanceof SerialError
            ? error
            : new SerialError(
                SerialErrorCode.CONNECTION_LOST,
                `Read stream failed: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error : new Error(String(error)),
              );
        this.errorsSubject$.next(serialError);
        this.stateSubject$.next({ kind: 'error', error: serialError });
      },
    });
  }

  private handleIncomingChunk(chunk: Uint8Array): void {
    this.bytesSubject$.next(chunk);
    const decodedText = this.textDecoder.decode(chunk, { stream: true });
    this.textSubject$.next(decodedText);
    this.readBuffer += decodedText;
    this.bufferTick$.next();

    const merged = `${this.lineBuffer}${decodedText}`.replace(/\r\n/g, '\n');
    const parts = merged.split('\n');
    this.lineBuffer = parts.pop() ?? '';
    for (const line of parts) {
      this.linesSubject$.next(line);
    }
  }

  private resetReceiveState(): void {
    this.textDecoder = new TextDecoder();
    this.lineBuffer = '';
    this.readBuffer = '';
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Observable<T> {
    return defer(
      () =>
        new Observable<T>((subscriber) => {
          let cancelled = false;
          const run = async (): Promise<void> => {
            try {
              const value = await operation();
              if (!cancelled) {
                subscriber.next(value);
                subscriber.complete();
              }
            } catch (error) {
              if (!cancelled) {
                subscriber.error(error);
              }
            }
          };

          const scheduled = this.operationQueue.then(run, run);
          this.operationQueue = scheduled.then(
            () => undefined,
            () => undefined,
          );

          return () => {
            cancelled = true;
          };
        }),
    );
  }

  private async sendCommandPayload(
    command: string,
    lineEnding = DEFAULT_PROTOCOL_LINE_ENDING,
  ): Promise<void> {
    await this.sendRequestPayload(command, lineEnding);
  }

  private async sendRequestPayload(
    payload: string | Uint8Array,
    lineEnding = DEFAULT_PROTOCOL_LINE_ENDING,
  ): Promise<void> {
    const normalized =
      typeof payload === 'string'
        ? this.textEncoder.encode(payload + lineEnding)
        : payload;
    await firstValueFrom(this.write(normalized).pipe(defaultIfEmpty(undefined)));
  }

  private waitUntilPrompt(
    prompt: string | RegExp,
    timeoutMs: number,
  ): Promise<string> {
    const immediate = this.tryConsumePrompt(prompt);
    if (immediate !== null) {
      return Promise.resolve(immediate);
    }

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        subscription.unsubscribe();
        reject(
          new SerialError(
            SerialErrorCode.OPERATION_TIMEOUT,
            `Timed out waiting for prompt after ${timeoutMs}ms`,
          ),
        );
      }, timeoutMs);

      const complete = (value: string): void => {
        clearTimeout(timer);
        subscription.unsubscribe();
        resolve(value);
      };

      const fail = (error: unknown): void => {
        clearTimeout(timer);
        subscription.unsubscribe();
        reject(error);
      };

      const tryResolve = (): void => {
        const output = this.tryConsumePrompt(prompt);
        if (output !== null) {
          complete(output);
        }
      };

      const subscription = this.bufferTick$.subscribe({
        next: () => tryResolve(),
        error: (error) => fail(error),
        complete: () => fail(new Error('Read stream completed before prompt was found')),
      });
    });
  }

  private tryConsumePrompt(prompt: string | RegExp): string | null {
    if (typeof prompt === 'string') {
      if (
        this.readBuffer.length >= prompt.length &&
        this.readBuffer.endsWith(prompt)
      ) {
        const body = this.readBuffer.slice(0, this.readBuffer.length - prompt.length);
        this.readBuffer = '';
        return body.trimEnd();
      }
      return null;
    }

    const regex = this.createAnchoredRegex(prompt);
    const match = regex.exec(this.readBuffer);
    if (!match || match.index == null) {
      return null;
    }

    const body = this.readBuffer.slice(0, match.index);
    this.readBuffer = '';
    return body.trimEnd();
  }

  private createAnchoredRegex(source: RegExp): RegExp {
    const flags = source.flags.replace(/g/g, '');
    return new RegExp(`(?:${source.source})$`, flags);
  }
}

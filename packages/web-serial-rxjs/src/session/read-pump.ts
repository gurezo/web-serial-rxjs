import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';

/**
 * Callback invoked for every decoded chunk the read pump produces.
 *
 * The text is decoded from the raw bytes using a shared `TextDecoder` with
 * `{ stream: true }`, so multi-byte characters that straddle chunk
 * boundaries are joined correctly before reaching the callback.
 *
 * @internal
 */
export type ReadPumpChunkHandler = (text: string) => void;

/**
 * Callback invoked when the read pump cannot continue.
 *
 * The provided error is always a {@link SerialError}; raw platform errors
 * are normalized by the pump before they reach the caller so consumers only
 * ever observe the library's error type.
 *
 * @internal
 */
export type ReadPumpErrorHandler = (error: SerialError) => void;

/**
 * Options accepted by {@link createReadPump}.
 *
 * @internal
 */
export interface ReadPumpOptions {
  onChunk: ReadPumpChunkHandler;
  onError: ReadPumpErrorHandler;
}

/**
 * Handle returned by {@link createReadPump}.
 *
 * @internal
 */
export interface ReadPump {
  /**
   * Start reading from the associated `SerialPort.readable` stream.
   *
   * Subsequent calls are ignored while the pump is already running.
   */
  start(): void;
  /**
   * Stop the read loop and release the underlying reader lock.
   *
   * Safe to call multiple times or before `start()`.
   */
  stop(): Promise<void>;
  /**
   * `true` while the internal loop is actively reading.
   */
  readonly isRunning: boolean;
}

/**
 * Create an internal read pump for a {@link SerialPort}.
 *
 * The pump is an implementation detail of the v2 `SerialSession` API: it
 * owns a single `TextDecoder` (with `stream: true`), drives a
 * `reader.read()` loop against `port.readable`, and forwards decoded text
 * to the provided sink. It is **not** subscription-lazy - the `SerialSession`
 * starts the pump as soon as `connect$` succeeds so that `receive$`
 * subscribers never miss data because of subscription timing.
 *
 * Errors are normalized into {@link SerialError} with
 * {@link SerialErrorCode.READ_FAILED} for read-side failures and
 * {@link SerialErrorCode.CONNECTION_LOST} for missing readable streams, so
 * the session can forward them to `errors$` without rewrapping.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/202 | Issue #202}
 */
export function createReadPump(
  port: SerialPort,
  { onChunk, onError }: ReadPumpOptions,
): ReadPump {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let running = false;
  let stopped = false;
  const decoder = new TextDecoder(undefined, { fatal: false });

  const normalizeError = (error: unknown, code: SerialErrorCode): SerialError => {
    if (error instanceof SerialError) {
      return error;
    }
    const cause = error instanceof Error ? error : new Error(String(error));
    return new SerialError(code, `Read pump failed: ${cause.message}`, cause);
  };

  const releaseReader = (): void => {
    if (!reader) {
      return;
    }
    try {
      reader.releaseLock();
    } catch {
      // releaseLock may throw when the reader is already detached; ignore.
    }
    reader = null;
  };

  const pump = async (stream: ReadableStream<Uint8Array>): Promise<void> => {
    reader = stream.getReader();
    running = true;
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value && value.byteLength > 0) {
          const text = decoder.decode(value, { stream: true });
          if (text.length > 0) {
            onChunk(text);
          }
        }
      }
      if (!stopped) {
        const tail = decoder.decode();
        if (tail.length > 0) {
          onChunk(tail);
        }
      }
    } catch (error) {
      if (!stopped) {
        onError(normalizeError(error, SerialErrorCode.READ_FAILED));
      }
    } finally {
      running = false;
      releaseReader();
    }
  };

  return {
    start(): void {
      if (running || stopped) {
        return;
      }
      const stream = port.readable;
      if (!stream) {
        stopped = true;
        onError(
          new SerialError(
            SerialErrorCode.CONNECTION_LOST,
            'Read pump failed: port.readable is not available',
          ),
        );
        return;
      }
      void pump(stream);
    },
    async stop(): Promise<void> {
      if (stopped) {
        return;
      }
      stopped = true;
      if (!reader) {
        return;
      }
      try {
        await reader.cancel();
      } catch {
        // Cancel can reject when the stream is already errored; ignore so
        // the caller's disconnect flow is not derailed by a read failure.
      } finally {
        releaseReader();
      }
    },
    get isRunning(): boolean {
      return running;
    },
  };
}

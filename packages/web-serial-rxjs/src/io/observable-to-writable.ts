import { Observable } from 'rxjs';
import { SerialError, SerialErrorCode } from '../errors/serial-error';

/**
 * Convert an RxJS Observable to a WritableStream.
 *
 * This utility function converts an RxJS Observable into a Web Streams API WritableStream.
 * Values emitted by the Observable will be written to the returned WritableStream. The stream
 * will close when the Observable completes or abort if the Observable errors.
 *
 * Note: This function creates a new WritableStream. For directly subscribing to an Observable
 * and writing to an existing WritableStream, use {@link subscribeToWritable} instead.
 *
 * @param observable - The Observable to convert to a WritableStream
 * @returns A WritableStream that writes Uint8Array chunks emitted by the Observable
 *
 * @example
 * ```typescript
 * const data$ = from([
 *   new TextEncoder().encode('Hello'),
 *   new TextEncoder().encode('World'),
 * ]);
 *
 * const writableStream = observableToWritable(data$);
 * // Use the writable stream with other Web Streams APIs
 * ```
 */
export function observableToWritable(
  observable: Observable<Uint8Array>,
): WritableStream<Uint8Array> {
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let subscription: { unsubscribe: () => void } | null = null;
  let stream: WritableStream<Uint8Array> | null = null;

  stream = new WritableStream<Uint8Array>({
    async start() {
      if (!stream) {
        return;
      }
      writer = stream.getWriter();

      subscription = observable.subscribe({
        next: async (chunk) => {
          if (writer) {
            try {
              await writer.write(chunk);
            } catch (error) {
              subscription?.unsubscribe();
              if (writer) {
                writer.releaseLock();
              }
              throw error;
            }
          }
        },
        error: async (error) => {
          if (writer) {
            try {
              await writer.abort(error);
            } catch {
              // Ignore abort errors
            } finally {
              writer.releaseLock();
              writer = null;
            }
          }
        },
        complete: async () => {
          if (writer) {
            try {
              await writer.close();
            } catch {
              // Ignore close errors
            } finally {
              writer.releaseLock();
              writer = null;
            }
          }
        },
      });
    },

    abort(reason) {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      if (writer) {
        writer.abort(reason).catch(() => {
          // Ignore abort errors
        });
        writer.releaseLock();
        writer = null;
      }
    },
  });

  return stream;
}

/**
 * Subscribe to an Observable and write its values to a WritableStream.
 *
 * This utility function subscribes to an RxJS Observable and writes all emitted values
 * to the provided WritableStream. This is commonly used to write Observable data to a
 * serial port's writable stream.
 *
 * The function returns a subscription object that can be used to unsubscribe and clean up.
 * When unsubscribed, the writer lock will be released properly.
 *
 * @param observable - The Observable to subscribe to and read data from
 * @param stream - The WritableStream to write data to
 * @returns A subscription object with an `unsubscribe` method for cleanup
 * @throws {@link SerialError} with code {@link SerialErrorCode.WRITE_FAILED} if writing to the stream fails
 *
 * @example
 * ```typescript
 * const data$ = from([
 *   new TextEncoder().encode('Hello'),
 *   new TextEncoder().encode('World'),
 * ]);
 *
 * const subscription = subscribeToWritable(data$, port.writable);
 *
 * // Later, to cancel and clean up:
 * subscription.unsubscribe();
 *
 * // Use with RxJS operators
 * const processedData$ = of('Hello, Serial!').pipe(
 *   map((text) => new TextEncoder().encode(text))
 * );
 *
 * subscribeToWritable(processedData$, port.writable);
 * ```
 */
export function subscribeToWritable(
  observable: Observable<Uint8Array>,
  stream: WritableStream<Uint8Array>,
): { unsubscribe: () => void } {
  const writer = stream.getWriter();

  // Define error handler separately so we can call it directly
  const errorHandler = async (error: unknown) => {
    try {
      await writer.abort(error);
    } catch {
      // Ignore abort errors
    } finally {
      writer.releaseLock();
    }
  };

  const subscription = observable.subscribe({
    next: async (chunk) => {
      try {
        await writer.write(chunk);
      } catch (error) {
        subscription.unsubscribe();
        writer.releaseLock();
        // Convert write error to SerialError and pass to error handler
        const serialError = new SerialError(
          SerialErrorCode.WRITE_FAILED,
          `Failed to write to stream: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : new Error(String(error)),
        );
        // Manually trigger error handler to avoid unhandled rejection
        await errorHandler(serialError);
      }
    },
    error: errorHandler,
    complete: async () => {
      try {
        await writer.close();
      } catch {
        // Ignore close errors
      } finally {
        writer.releaseLock();
      }
    },
  });

  return {
    unsubscribe: () => {
      subscription.unsubscribe();
      writer.releaseLock();
    },
  };
}

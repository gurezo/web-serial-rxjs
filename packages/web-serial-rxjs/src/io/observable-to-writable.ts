import { Observable } from 'rxjs';
import { SerialError, SerialErrorCode } from '../errors/serial-error';

/**
 * Convert an RxJS Observable to a WritableStream
 * @param observable The Observable to convert
 * @returns A WritableStream that writes Uint8Array chunks from the observable
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
            } catch (abortError) {
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
            } catch (error) {
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
 * Subscribe to an Observable and write its values to a WritableStream
 * @param observable The Observable to subscribe to
 * @param stream The WritableStream to write to
 * @returns A subscription that can be used to unsubscribe
 */
export function subscribeToWritable(
  observable: Observable<Uint8Array>,
  stream: WritableStream<Uint8Array>,
): { unsubscribe: () => void } {
  const writer = stream.getWriter();

  const subscription = observable.subscribe({
    next: async (chunk) => {
      try {
        await writer.write(chunk);
      } catch (error) {
        subscription.unsubscribe();
        writer.releaseLock();
        throw new SerialError(
          SerialErrorCode.WRITE_FAILED,
          `Failed to write to stream: ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    },
    error: async (error) => {
      try {
        await writer.abort(error);
      } catch (abortError) {
        // Ignore abort errors
      } finally {
        writer.releaseLock();
      }
    },
    complete: async () => {
      try {
        await writer.close();
      } catch (error) {
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

import { Observable } from 'rxjs';
import { SerialError, SerialErrorCode } from '../errors/serial-error';

/**
 * Convert an RxJS Observable to a WritableStream
 * @param observable The Observable to convert
 * @returns A WritableStream that writes Uint8Array chunks from the observable
 */
export function observableToWritable(
  observable: Observable<Uint8Array>
): WritableStream<Uint8Array> {
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let subscription: { unsubscribe: () => void } | null = null;

  return new WritableStream<Uint8Array>({
    async start(controller) {
      writer = controller;
    },

    async write(chunk) {
      return new Promise<void>((resolve, reject) => {
        if (!writer) {
          reject(
            new SerialError(
              SerialErrorCode.WRITE_FAILED,
              'Writer is not available'
            )
          );
          return;
        }

        writer
          .write(chunk)
          .then(() => resolve())
          .catch((error) => {
            reject(
              new SerialError(
                SerialErrorCode.WRITE_FAILED,
                `Failed to write chunk: ${error.message}`,
                error instanceof Error ? error : new Error(String(error))
              )
            );
          });
      });
    },

    async close() {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      if (writer) {
        await writer.close();
        writer = null;
      }
    },

    async abort(reason) {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
      if (writer) {
        await writer.abort(reason);
        writer = null;
      }
    },
  });
}

/**
 * Subscribe to an Observable and write its values to a WritableStream
 * @param observable The Observable to subscribe to
 * @param stream The WritableStream to write to
 * @returns A subscription that can be used to unsubscribe
 */
export function subscribeToWritable(
  observable: Observable<Uint8Array>,
  stream: WritableStream<Uint8Array>
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
          error instanceof Error ? error : new Error(String(error))
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

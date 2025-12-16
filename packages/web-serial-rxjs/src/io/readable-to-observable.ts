import { Observable } from 'rxjs';
import { SerialError, SerialErrorCode } from '../errors/serial-error';

/**
 * Convert a ReadableStream to an RxJS Observable
 * @param stream The ReadableStream to convert
 * @returns An Observable that emits Uint8Array chunks from the stream
 */
export function readableToObservable(
  stream: ReadableStream<Uint8Array>,
): Observable<Uint8Array> {
  return new Observable<Uint8Array>((subscriber) => {
    const reader = stream.getReader();

    const pump = async (): Promise<void> => {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            subscriber.complete();
            break;
          }

          if (value) {
            subscriber.next(value);
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          subscriber.error(
            new SerialError(
              SerialErrorCode.READ_FAILED,
              `Failed to read from stream: ${error.message}`,
              error,
            ),
          );
        } else {
          subscriber.error(
            new SerialError(
              SerialErrorCode.READ_FAILED,
              'Failed to read from stream: Unknown error',
              error as Error,
            ),
          );
        }
      } finally {
        reader.releaseLock();
      }
    };

    pump().catch((error) => {
      if (!subscriber.closed) {
        subscriber.error(error);
      }
    });

    // Cleanup function
    return () => {
      reader.releaseLock();
    };
  });
}

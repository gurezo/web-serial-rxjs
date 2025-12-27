import { Observable } from 'rxjs';
import { SerialError, SerialErrorCode } from '../errors/serial-error';

/**
 * Convert a ReadableStream to an RxJS Observable.
 *
 * This utility function converts a Web Streams API ReadableStream into an RxJS Observable,
 * allowing you to use RxJS operators with stream data. The Observable will emit Uint8Array
 * chunks as they are read from the stream, complete when the stream ends, or error if
 * the stream encounters an error.
 *
 * The returned Observable handles stream cleanup automatically - if you unsubscribe before
 * the stream completes, the reader lock will be released properly.
 *
 * @param stream - The ReadableStream to convert to an Observable
 * @returns An Observable that emits Uint8Array chunks from the stream
 * @throws {@link SerialError} with code {@link SerialErrorCode.READ_FAILED} if reading from the stream fails
 *
 * @example
 * ```typescript
 * // Convert a serial port's readable stream to an Observable
 * const readable$ = readableToObservable(port.readable);
 *
 * readable$.subscribe({
 *   next: (chunk) => {
 *     console.log('Received chunk:', chunk);
 *   },
 *   complete: () => {
 *     console.log('Stream completed');
 *   },
 *   error: (error) => {
 *     console.error('Stream error:', error);
 *   },
 * });
 *
 * // Use with RxJS operators
 * readableToObservable(port.readable)
 *   .pipe(
 *     map((chunk) => new TextDecoder().decode(chunk)),
 *     filter((text) => text.includes('OK'))
 *   )
 *   .subscribe((text) => console.log('Filtered text:', text));
 * ```
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

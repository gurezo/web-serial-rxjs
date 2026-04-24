import { Observable, defer } from 'rxjs';

/**
 * A single enqueued unit of work. Operations are awaited sequentially so
 * that `send$` guarantees call order even when the caller fires multiple
 * observables concurrently.
 *
 * @internal
 */
export type SendQueueOperation<T> = () => Promise<T>;

/**
 * Internal helper returned by {@link createSendQueue}.
 *
 * The queue is intentionally not an RxJS operator because Issue #199 calls
 * out explicitly that `send$` must not be re-implemented with `mergeMap`
 * (or any other concurrency-altering operator). A chained `Promise<void>`
 * is the simplest way to guarantee strict FIFO ordering while still
 * surfacing per-operation completion back to the caller.
 *
 * @internal
 */
export interface SendQueue {
  /**
   * Schedule an operation to run after all previously enqueued operations
   * have settled (resolved or rejected). The returned Observable completes
   * with the operation's resolved value, or errors with its rejection.
   *
   * Subscribing is what actually schedules the work - the queue is driven
   * by `defer`, so late/never-subscribed Observables never enqueue.
   */
  enqueue<T>(operation: SendQueueOperation<T>): Observable<T>;
  /**
   * Reset the internal promise chain. Existing in-flight operations keep
   * running because we do not cancel native promises, but no newly
   * enqueued work will wait for them. Use this when the session is torn
   * down so a fresh `connect$` starts with a clean chain.
   */
  clear(): void;
}

/**
 * Create an internal send queue that serialises `send$` writes.
 *
 * Ordering model:
 *
 * - Each `enqueue` call appends its operation to a single `Promise<void>`
 *   chain.
 * - A failure in one operation does not poison the chain - the next
 *   operation still runs (the chain is advanced with a `.then(() => {},
 *   () => {})` safety tail).
 * - Unsubscribing before the operation resolves suppresses `next` /
 *   `complete` / `error` for that subscriber; the underlying promise is
 *   still awaited so later operations continue to respect call order.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/203 | Issue #203}
 */
export function createSendQueue(): SendQueue {
  let chain: Promise<void> = Promise.resolve();

  return {
    enqueue<T>(operation: SendQueueOperation<T>): Observable<T> {
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

            const scheduled = chain.then(run, run);
            chain = scheduled.then(
              () => undefined,
              () => undefined,
            );

            return () => {
              cancelled = true;
            };
          }),
      );
    },
    clear(): void {
      chain = Promise.resolve();
    },
  };
}

import { Observable, defer } from 'rxjs';

/**
 * A single enqueued unit of work. Operations are awaited sequentially so
 * that `send$` guarantees call order even when the caller fires multiple
 * observables concurrently.
 *
 * @internal
 */
type SendQueueOperation<T> = () => Promise<T>;

/**
 * Raised when {@link SendQueue.clear} drops an operation that has not
 * started. Session code maps this to a subscriber-only error so `errors$`
 * does not observe a stale send.
 *
 * @internal
 */
export class SendQueueClearedError extends Error {
  constructor() {
    super('Send queue was cleared before the operation started');
    this.name = 'SendQueueClearedError';
  }
}

type PendingSend = {
  generation: number;
  cancelled: boolean;
  failed: boolean;
  fail: () => void;
};

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
 * - Unsubscribing before `operation()` starts skips that operation. Later
 *   operations still run in FIFO order.
 * - Unsubscribing after `operation()` has started suppresses `next` /
 *   `complete` / `error` for that subscriber. The in-flight promise is
 *   still awaited, so the underlying write is not aborted. Later
 *   operations continue to respect call order.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/203 | Issue #203}
 */
export function createSendQueue(): SendQueue {
  let chain: Promise<void> = Promise.resolve();
  let epoch = 0;
  // Settled promise for the operation that has already entered `operation()`.
  // `clear()` waits on this so a new generation cannot overlap that write.
  let inFlight: Promise<void> = Promise.resolve();
  const pending = new Set<PendingSend>();

  return {
    enqueue<T>(operation: SendQueueOperation<T>): Observable<T> {
      return defer(
        () =>
          new Observable<T>((subscriber) => {
            const entry: PendingSend = {
              generation: epoch,
              cancelled: false,
              failed: false,
              fail: () => {
                subscriber.error(new SendQueueClearedError());
              },
            };
            pending.add(entry);

            const run = async (): Promise<void> => {
              pending.delete(entry);
              if (
                entry.cancelled ||
                entry.failed ||
                entry.generation !== epoch
              ) {
                return;
              }

              const task = (async (): Promise<void> => {
                try {
                  const value = await operation();
                  if (!entry.cancelled) {
                    subscriber.next(value);
                    subscriber.complete();
                  }
                } catch (error) {
                  if (!entry.cancelled) {
                    subscriber.error(error);
                  }
                }
              })();

              const settled = task.then(
                () => undefined,
                () => undefined,
              );
              inFlight = settled;
              await task;
            };

            const scheduled = chain.then(run, run);
            chain = scheduled.then(
              () => undefined,
              () => undefined,
            );

            return () => {
              entry.cancelled = true;
              pending.delete(entry);
            };
          }),
      );
    },
    clear(): void {
      epoch += 1;
      chain = inFlight;
      const stale = [...pending];
      for (const entry of stale) {
        pending.delete(entry);
        if (entry.cancelled || entry.failed) {
          continue;
        }
        entry.failed = true;
        try {
          entry.fail();
        } catch {
          // A subscriber that throws must not keep the rest of the queue.
        }
      }
    },
  };
}

import { Observable, Subject } from 'rxjs';

/**
 * Options for {@link createReceiveReplayBuffer}.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/372 | Issue #372}
 */
export interface ReceiveReplayBufferOptions {
  /** Maximum number of chunks to retain. */
  bufferSize: number;
  /**
   * Maximum total characters across retained chunks. `0` disables the limit.
   */
  maxChars: number;
}

/** Result of {@link ReceiveReplayBuffer.next}. */
export interface ReceiveReplayBufferNextResult {
  /** `true` when oldest chunks were discarded to satisfy limits. */
  overflowed: boolean;
}

/**
 * Bounded replay buffer for {@link SerialSession.receiveReplay$}.
 * Replays retained chunks to new subscribers, then forwards live emissions.
 *
 * @internal
 */
export interface ReceiveReplayBuffer {
  next(chunk: string): ReceiveReplayBufferNextResult;
  asObservable(): Observable<string>;
  complete(): void;
}

function totalChars(chunks: string[]): number {
  return chunks.reduce((sum, chunk) => sum + chunk.length, 0);
}

/**
 * Create a per-connection receive replay buffer.
 *
 * @internal
 */
export function createReceiveReplayBuffer(
  options: ReceiveReplayBufferOptions,
): ReceiveReplayBuffer {
  const chunks: string[] = [];
  const live$ = new Subject<string>();
  let completed = false;

  const trim = (): boolean => {
    let overflowed = false;

    while (chunks.length > options.bufferSize) {
      chunks.shift();
      overflowed = true;
    }

    if (options.maxChars > 0) {
      let chars = totalChars(chunks);
      while (chars > options.maxChars && chunks.length > 1) {
        chars -= chunks.shift()!.length;
        overflowed = true;
      }
    }

    return overflowed;
  };

  const next = (chunk: string): ReceiveReplayBufferNextResult => {
    if (completed) {
      return { overflowed: false };
    }

    chunks.push(chunk);
    const overflowed = trim();
    live$.next(chunk);
    return { overflowed };
  };

  const asObservable = (): Observable<string> =>
    new Observable((subscriber) => {
      for (const chunk of chunks) {
        subscriber.next(chunk);
      }
      if (completed) {
        subscriber.complete();
        return;
      }
      return live$.subscribe(subscriber);
    });

  const complete = (): void => {
    if (completed) {
      return;
    }
    completed = true;
    chunks.length = 0;
    live$.complete();
  };

  return { next, asObservable, complete };
}

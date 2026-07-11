import {
  BehaviorSubject,
  type Observable,
  share,
  Subject,
  switchMap,
} from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { createLineBuffer, type LineBuffer } from './line-buffer';
import {
  createReceiveReplayBuffer,
  type ReceiveReplayBuffer,
} from './receive-replay-buffer';
import type { NormalizeSerialErrorOptions } from '../normalize-serial-error';
import type { ResolvedSerialSessionOptions } from '../serial-session-options';

/**
 * Dependencies for {@link createReceivePipeline}.
 *
 * @internal
 */
export interface ReceivePipelineDeps {
  resolvedOptions: ResolvedSerialSessionOptions;
  reportError: (
    error: unknown,
    options: NormalizeSerialErrorOptions,
  ) => SerialError;
}

/**
 * Receive-side stream wiring for {@link createSerialSession}.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/401 | Issue #401}
 */
export interface ReceivePipeline {
  receive$: Observable<string>;
  lines$: Observable<string>;
  receiveReplay$: Observable<string>;
  clearReplay: () => void;
  startLiveReceiveReplay: () => void;
  clearLineBuffer: () => void;
  handleChunk: (text: string) => void;
  complete: () => void;
}

/**
 * @internal
 */
export function createReceivePipeline(
  deps: ReceivePipelineDeps,
): ReceivePipeline {
  const { resolvedOptions, reportError } = deps;

  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const lineBuffer: LineBuffer = createLineBuffer(resolvedOptions.lineBuffer);

  const receive$ = receiveSubject.asObservable();
  const lines$ = linesSubject.asObservable();

  const receiveReplayStream$ = resolvedOptions.receiveReplay.enabled
    ? new BehaviorSubject<Observable<string>>(receive$)
    : null;
  let activeReceiveReplay: ReceiveReplayBuffer | null = null;

  const clearReplay = (): void => {
    if (receiveReplayStream$) {
      if (activeReceiveReplay) {
        activeReceiveReplay.complete();
        activeReceiveReplay = null;
      }
      receiveReplayStream$.next(receive$);
    }
  };

  const startLiveReceiveReplay = (): void => {
    if (!receiveReplayStream$) {
      return;
    }
    if (activeReceiveReplay) {
      activeReceiveReplay.complete();
      activeReceiveReplay = null;
    }
    const buffer = createReceiveReplayBuffer({
      bufferSize: resolvedOptions.receiveReplay.bufferSize,
      maxChars: resolvedOptions.receiveReplay.maxChars,
    });
    activeReceiveReplay = buffer;
    receiveReplayStream$.next(buffer.asObservable());
  };

  const receiveReplay$ = receiveReplayStream$
    ? receiveReplayStream$.pipe(switchMap((inner) => inner), share())
    : receive$;

  const clearLineBuffer = (): void => {
    lineBuffer.clear();
  };

  const handleChunk = (text: string): void => {
    receiveSubject.next(text);
    if (activeReceiveReplay) {
      const { overflowed } = activeReceiveReplay.next(text);
      if (overflowed) {
        reportError(
          new SerialError(
            SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW,
            'Receive replay buffer exceeded configured limits; oldest chunks were discarded',
            undefined,
            {
              maxChars: resolvedOptions.receiveReplay.maxChars,
              bufferSize: resolvedOptions.receiveReplay.bufferSize,
            },
          ),
          {
            fallbackCode: SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW,
          },
        );
      }
    }
    const { lines, overflowed } = lineBuffer.feed(text);
    if (overflowed) {
      reportError(
        new SerialError(
          SerialErrorCode.LINE_BUFFER_OVERFLOW,
          'Line buffer exceeded maxChars; leading data was discarded',
          undefined,
          { maxChars: resolvedOptions.lineBuffer.maxChars },
        ),
        { fallbackCode: SerialErrorCode.LINE_BUFFER_OVERFLOW },
      );
    }
    for (const line of lines) {
      linesSubject.next(line);
    }
  };

  const complete = (): void => {
    receiveSubject.complete();
    linesSubject.complete();
    receiveReplayStream$?.complete();
  };

  return {
    receive$,
    lines$,
    receiveReplay$,
    clearReplay,
    startLiveReceiveReplay,
    clearLineBuffer,
    handleChunk,
    complete,
  };
}

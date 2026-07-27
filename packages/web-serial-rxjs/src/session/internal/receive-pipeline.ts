import { type Observable, Subject } from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { createLineBuffer, type LineBuffer } from './line-buffer';
import type { ResolvedSerialSessionOptions } from '../serial-session-options';

/**
 * Dependencies for {@link createReceivePipeline}.
 *
 * @internal
 */
export interface ReceivePipelineDeps {
  resolvedOptions: ResolvedSerialSessionOptions;
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
  /**
   * Buffer-overflow errors produced while decoding chunks. The factory pipes
   * these into the session's single error-reporting entry point so the receive
   * pipeline stays decoupled from error reporting and initialization order.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/476 | Issue #476}
   */
  bufferErrors$: Observable<SerialError>;
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
  const { resolvedOptions } = deps;

  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const bufferErrorsSubject = new Subject<SerialError>();
  const lineBuffer: LineBuffer = createLineBuffer(resolvedOptions.lineBuffer);

  const receive$ = receiveSubject.asObservable();
  const lines$ = linesSubject.asObservable();
  const bufferErrors$ = bufferErrorsSubject.asObservable();

  const clearLineBuffer = (): void => {
    lineBuffer.clear();
  };

  const handleChunk = (text: string): void => {
    receiveSubject.next(text);
    const { lines, overflowed } = lineBuffer.feed(text);
    if (overflowed) {
      bufferErrorsSubject.next(
        new SerialError(
          SerialErrorCode.LINE_BUFFER_OVERFLOW,
          'Line buffer exceeded maxChars; leading data was discarded',
          undefined,
          { maxChars: resolvedOptions.lineBuffer.maxChars },
        ),
      );
    }
    for (const line of lines) {
      linesSubject.next(line);
    }
  };

  const complete = (): void => {
    receiveSubject.complete();
    linesSubject.complete();
    bufferErrorsSubject.complete();
  };

  return {
    receive$,
    lines$,
    bufferErrors$,
    clearLineBuffer,
    handleChunk,
    complete,
  };
}

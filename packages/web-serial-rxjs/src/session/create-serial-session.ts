import {
  BehaviorSubject,
  Observable,
  Subject,
  defer,
  throwError,
} from 'rxjs';
import { hasWebSerialSupport } from '../browser/browser-detection';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import type { SerialSession } from './serial-session';
import type { SerialSessionOptions } from './serial-session-options';
import type { SerialSessionState } from './serial-session-state';

const NOT_IMPLEMENTED_MESSAGE =
  'SerialSession runtime is not implemented yet. Tracked by the remaining sub-issues of https://github.com/gurezo/web-serial-rxjs/issues/199';

function notImplemented$(): Observable<never> {
  return defer(() =>
    throwError(
      () =>
        new SerialError(SerialErrorCode.UNKNOWN, NOT_IMPLEMENTED_MESSAGE),
    ),
  );
}

/**
 * Create a v2 {@link SerialSession}.
 *
 * This initial release establishes a stable public shape for the session
 * API. The runtime (read pump, send queue, error pipeline, state
 * transitions) is implemented in the remaining sub-issues of #199.
 *
 * Current behavior:
 *
 * - `isBrowserSupported()` returns whether `navigator.serial` is available.
 * - `state$` replays `'idle'` on subscribe.
 * - `errors$` is an open stream with no default emissions.
 * - `receive$` is an open stream with no default emissions.
 * - `connect$()`, `disconnect$()`, and `send$()` fail with a `SerialError`
 *   carrying `SerialErrorCode.UNKNOWN` until the runtime lands.
 *
 * @param _options - Session options. Currently unused; retained so the
 *   public signature stays stable when the runtime is implemented.
 * @returns A {@link SerialSession} instance.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 */
export function createSerialSession(
  _options?: SerialSessionOptions,
): SerialSession {
  const stateSubject = new BehaviorSubject<SerialSessionState>('idle');
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string | Uint8Array>();

  const state$ = stateSubject.asObservable();
  const errors$ = errorsSubject.asObservable();
  const receive$ = receiveSubject.asObservable();

  return {
    isBrowserSupported(): boolean {
      return hasWebSerialSupport();
    },
    connect$(): Observable<void> {
      return notImplemented$();
    },
    disconnect$(): Observable<void> {
      return notImplemented$();
    },
    send$(_data: string | Uint8Array): Observable<void> {
      return notImplemented$();
    },
    state$,
    errors$,
    receive$,
  };
}

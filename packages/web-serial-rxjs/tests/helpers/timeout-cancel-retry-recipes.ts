import {
  Observable,
  TimeoutError,
  defer,
  map,
  mergeMap,
  retry,
  take,
  takeUntil,
  throwError,
  timeout,
  timer,
} from 'rxjs';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import type { SerialSession } from '../../src/session/serial-session';
import { SerialSessionStatus } from '../../src/session/serial-session-state';
import type { SerialPayload } from '../../src/types';
import {
  type LineMatcher,
  type RequestResponseOptions,
  requestLine$,
} from './request-response-recipes';

/**
 * Timeout / cancel / retry recipe helpers built on `SerialSession` (Issue #539).
 *
 * These helpers are **not** published on npm. Copy the pattern into application
 * code. They compose plain RxJS over `connect$` / `send$` / `lines$` and do
 * **not** extend the core public API with automatic reconnect or retry.
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/539
 */

export type TimeoutOptions = {
  /** First-emission timeout in ms (RxJS `timeout({ first })`). Default: 10_000. */
  timeoutMs?: number;
};

export type RetryOptions = {
  /** Maximum number of retries after the first failure. Default: 2. */
  count?: number;
  /** Base delay in ms for exponential backoff. Default: 200. */
  baseDelayMs?: number;
};

const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_BASE_DELAY_MS = 200;

/**
 * True when `error` is a user-cancelled port picker (`OPERATION_CANCELLED`).
 * Do **not** retry or re-open the picker automatically.
 */
export function isUserCancelled(error: unknown): error is SerialError {
  return (
    error instanceof SerialError &&
    error.is(SerialErrorCode.OPERATION_CANCELLED)
  );
}

/**
 * True when `error` is `SESSION_DISPOSED`.
 * Create a new session instead of retrying on a disposed instance.
 */
export function isSessionDisposedError(error: unknown): error is SerialError {
  return (
    error instanceof SerialError && error.is(SerialErrorCode.SESSION_DISPOSED)
  );
}

/**
 * Emit whether the session is currently in `disposed` status.
 */
export function isDisposedState(session: SerialSession): Observable<boolean> {
  return session.state$.pipe(
    map((state) => state.status === SerialSessionStatus.Disposed),
    take(1),
  );
}

/**
 * Connect with a first-emission timeout.
 * Does **not** retry on failure — compose with {@link connectWithLimitedRetry$}
 * when a bounded retry policy is appropriate.
 */
export function connectWithTimeout$(
  session: SerialSession,
  options: TimeoutOptions = {},
): Observable<void> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
  return session.connect$().pipe(timeout({ first: timeoutMs }));
}

/**
 * Wait for a matching reply after send, with an explicit timeout.
 * Thin wrapper around {@link requestLine$} for documentation / tests.
 */
export function requestWithTimeout$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  options: RequestResponseOptions = {},
): Observable<string> {
  return requestLine$(session, payload, matcher, options);
}

/**
 * Run `source$` until `cancel$` emits, then complete without error.
 * Typical use: Component / Hook teardown Subject.
 */
export function withCancel$<T>(
  source$: Observable<T>,
  cancel$: Observable<unknown>,
): Observable<T> {
  return source$.pipe(takeUntil(cancel$));
}

/**
 * Whether this error is safe to retry for a **connect** attempt.
 * User cancel and disposed sessions must never be retried.
 */
export function shouldRetryConnect(error: unknown): boolean {
  if (isUserCancelled(error) || isSessionDisposedError(error)) {
    return false;
  }
  if (error instanceof TimeoutError) {
    return true;
  }
  if (error instanceof SerialError) {
    return (
      error.is(SerialErrorCode.PORT_OPEN_FAILED) ||
      error.is(SerialErrorCode.CONNECTION_LOST)
    );
  }
  return false;
}

/**
 * Exponential backoff delay for retry attempt `retryCount` (1-based in RxJS
 * `retry` delay callback: first retry is count 1).
 */
export function exponentialBackoffDelayMs(
  retryCount: number,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
): number {
  return baseDelayMs * 2 ** (retryCount - 1);
}

/**
 * Connect with a limited retry count and optional exponential backoff.
 * Never retries user cancel or disposed sessions. Refuses to call `connect$`
 * when the session is already `disposed`.
 */
export function connectWithLimitedRetry$(
  session: SerialSession,
  options: TimeoutOptions & RetryOptions = {},
): Observable<void> {
  const count = options.count ?? DEFAULT_RETRY_COUNT;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;

  return defer(() =>
    isDisposedState(session).pipe(
      mergeMap((disposed) => {
        if (disposed) {
          return throwError(
            () =>
              new SerialError(
                SerialErrorCode.SESSION_DISPOSED,
                'SerialSession has been disposed',
              ),
          );
        }
        return session.connect$().pipe(timeout({ first: timeoutMs }));
      }),
    ),
  ).pipe(
    retry({
      count,
      delay: (error, retryCount) => {
        if (!shouldRetryConnect(error)) {
          return throwError(() => error);
        }
        return timer(exponentialBackoffDelayMs(retryCount, baseDelayMs));
      },
    }),
  );
}

/**
 * Retry a **idempotent** request/response a limited number of times.
 *
 * Only use when re-sending `payload` is safe (read-only queries, etc.).
 * Pass `idempotent: true` explicitly — non-idempotent commands must not use
 * this helper (device may execute the side effect more than once).
 */
export function requestIdempotentWithRetry$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  options: RequestResponseOptions & RetryOptions & { idempotent: true },
): Observable<string> {
  // Runtime guard in case of unsound casts from application code.
  if (options.idempotent !== true) {
    return throwError(
      () =>
        new Error(
          'requestIdempotentWithRetry$ requires idempotent: true — do not auto-resend non-idempotent commands',
        ),
    );
  }

  const count = options.count ?? DEFAULT_RETRY_COUNT;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  return defer(() => requestLine$(session, payload, matcher, options)).pipe(
    retry({
      count,
      delay: (error, retryCount) => {
        // Never auto-resend after cancel / disposed.
        if (isUserCancelled(error) || isSessionDisposedError(error)) {
          return throwError(() => error);
        }
        if (
          error instanceof TimeoutError ||
          (error instanceof SerialError &&
            error.is(SerialErrorCode.WRITE_FAILED))
        ) {
          return timer(exponentialBackoffDelayMs(retryCount, baseDelayMs));
        }
        return throwError(() => error);
      },
    }),
  );
}

/**
 * Guard helper: refuse automatic resend for non-idempotent commands.
 * Prefer calling `requestLine$` once and handling failure in the UI.
 */
export function requestNonIdempotent$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  options: RequestResponseOptions = {},
): Observable<string> {
  // Intentionally no retry — side-effecting commands must not be auto-resent.
  return requestLine$(session, payload, matcher, options);
}

/**
 * Reconnect policy that stops when the session is disposed.
 * Use after a fatal error only with a limited count (see Guide).
 */
export function reconnectUnlessDisposed$(
  session: SerialSession,
  options: TimeoutOptions & RetryOptions = {},
): Observable<void> {
  return isDisposedState(session).pipe(
    mergeMap((disposed) => {
      if (disposed) {
        return throwError(
          () =>
            new SerialError(
              SerialErrorCode.SESSION_DISPOSED,
              'SerialSession has been disposed — create a new session instead of reconnecting',
            ),
        );
      }
      return connectWithLimitedRetry$(session, options);
    }),
  );
}

/** Re-export TimeoutError check for Guide / tests. */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

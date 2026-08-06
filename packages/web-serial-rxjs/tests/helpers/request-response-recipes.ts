import {
  Observable,
  TimeoutError,
  concatMap,
  filter,
  from,
  scan,
  take,
  timeout,
} from 'rxjs';
import { SerialError } from '../../src/errors/serial-error';
import type { SerialSession } from '../../src/session/serial-session';
import type { SerialPayload } from '../../src/types';

/**
 * Request / Response recipe helpers built on `SerialSession` (Issue #538).
 *
 * These helpers are **not** published on npm. Copy the pattern into application
 * code. They compose plain RxJS over `lines$` / `receive$` / `send$` and do
 * **not** extend the core public API.
 *
 * Critical ordering: start waiting on `lines$` / `receive$` **before**
 * subscribing to `send$`, because those streams are hot and do not replay.
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/538
 */

export type LineMatcher = string | RegExp | ((line: string) => boolean);

export type RequestResponseOptions = {
  /** First-emission timeout in ms (RxJS `timeout({ first })`). Default: 3000. */
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 3000;

function matchesLine(matcher: LineMatcher, line: string): boolean {
  if (typeof matcher === 'function') {
    return matcher(line);
  }
  if (typeof matcher === 'string') {
    return line === matcher;
  }
  return matcher.test(line);
}

/**
 * Wait for the next line that matches `matcher` on `session.lines$`.
 * Completes after one match (`take(1)`).
 */
export function waitForLine$(
  session: SerialSession,
  matcher: LineMatcher,
  options: RequestResponseOptions = {},
): Observable<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return session.lines$.pipe(
    filter((line) => matchesLine(matcher, line)),
    take(1),
    timeout({ first: timeoutMs }),
  );
}

/**
 * Accumulate `receive$` chunks until `predicate` matches the buffer, then
 * emit the buffer and complete.
 */
export function waitUntilBuffer$(
  session: SerialSession,
  predicate: (buffer: string) => boolean,
  options: RequestResponseOptions = {},
): Observable<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter(predicate),
    take(1),
    timeout({ first: timeoutMs }),
  );
}

/**
 * True when `error` is a write/send failure (`SerialError`).
 */
export function isSendFailure(error: unknown): error is SerialError {
  return error instanceof SerialError;
}

/**
 * True when `error` is a response-wait timeout (`TimeoutError`).
 */
export function isResponseTimeout(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Subscribe to a wait pipeline first, then `send$`.
 * On send failure, unsubscribes the wait so it does not hang until timeout.
 */
function sendThenWait$(
  session: SerialSession,
  payload: SerialPayload,
  wait$: Observable<string>,
): Observable<string> {
  return new Observable<string>((subscriber) => {
    const waitSub = wait$.subscribe({
      next: (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      error: (error: unknown) => {
        subscriber.error(error);
      },
    });

    const sendSub = session.send$(payload).subscribe({
      error: (error: unknown) => {
        waitSub.unsubscribe();
        subscriber.error(error);
      },
    });

    return () => {
      waitSub.unsubscribe();
      sendSub.unsubscribe();
    };
  });
}

/**
 * Send `payload`, then wait for a matching line.
 *
 * Subscribes to the wait pipeline **before** `send$` so a fast device reply
 * is not missed.
 */
export function requestLine$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  options: RequestResponseOptions = {},
): Observable<string> {
  return sendThenWait$(session, payload, waitForLine$(session, matcher, options));
}

/**
 * Send `payload`, then wait until the accumulated `receive$` buffer matches
 * `predicate` (prompt / terminator style).
 */
export function requestUntil$(
  session: SerialSession,
  payload: SerialPayload,
  predicate: (buffer: string) => boolean,
  options: RequestResponseOptions = {},
): Observable<string> {
  return sendThenWait$(
    session,
    payload,
    waitUntilBuffer$(session, predicate, options),
  );
}

/**
 * Run multiple request/response pairs **serially** with `concatMap`.
 * Prefer this over `switchMap` when the protocol has no correlation IDs.
 */
export function requestLinesInOrder$(
  session: SerialSession,
  commands: ReadonlyArray<{
    payload: SerialPayload;
    matcher: LineMatcher;
  }>,
  options: RequestResponseOptions = {},
): Observable<string> {
  return from(commands).pipe(
    concatMap(({ payload, matcher }) =>
      requestLine$(session, payload, matcher, options),
    ),
  );
}

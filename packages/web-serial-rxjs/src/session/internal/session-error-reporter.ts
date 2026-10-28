import type { Subject } from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { resolveErrorSeverity } from './error-severity';
import {
  normalizeSerialError,
  type NormalizeSerialErrorOptions,
} from '../normalize-serial-error';
import {
  createErrorRuntime,
  type SessionRuntime,
  type SessionRuntimeController,
} from '../session-runtime';
import type {
  SessionResources,
  TeardownResourcesOptions,
} from './port-teardown';

/**
 * Dependencies for {@link createSessionErrorReporter}.
 *
 * @internal
 */
export interface SessionErrorReporterDeps {
  controller: SessionRuntimeController;
  errorsSubject: Subject<SerialError>;
  isDisposed: () => boolean;
  captureResources: (runtime: SessionRuntime) => SessionResources;
  teardownResources: (
    resources: SessionResources,
    options?: TeardownResourcesOptions,
  ) => Promise<void>;
}

/**
 * Centralised error reporting for {@link createSerialSession}.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/204 | Issue #204}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/401 | Issue #401}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/650 | Issue #650}
 */
export function createSessionErrorReporter(deps: SessionErrorReporterDeps): {
  reportError: (
    error: unknown,
    options: NormalizeSerialErrorOptions,
  ) => SerialError;
  createDisposedError: () => SerialError;
  /**
   * Fatal port teardown still running, or `null` when none is in flight.
   *
   * The promise always fulfills. A rejection is absorbed here so it does
   * not become an unhandled rejection or another state transition.
   * `null` lets `connect$` keep its current microtask timing when no
   * teardown is pending.
   */
  whenFatalTeardownSettled: () => Promise<void> | null;
} {
  const {
    controller,
    errorsSubject,
    isDisposed,
    captureResources,
    teardownResources,
  } = deps;

  const createDisposedError = (): SerialError =>
    new SerialError(
      SerialErrorCode.SESSION_DISPOSED,
      'SerialSession has been disposed',
    );

  // Consecutive fatals append to this chain instead of replacing it, so a
  // later no-op teardown cannot drop the wait for an earlier `close()`.
  // The slot is cleared only when that latest chain has settled.
  let pendingTeardown: Promise<void> | null = null;

  const trackFatalTeardown = (work: Promise<void>): void => {
    const settled = work.then(
      () => undefined,
      () => undefined,
    );
    const chained = (pendingTeardown ?? Promise.resolve()).then(() => settled);
    pendingTeardown = chained;
    void chained.then(() => {
      if (pendingTeardown === chained) {
        pendingTeardown = null;
      }
    });
  };

  const whenFatalTeardownSettled = (): Promise<void> | null => pendingTeardown;

  /**
   * Single entry point for every error that should reach `errors$`.
   *
   * Responsibilities:
   *
   * 1. Normalise the input through {@link normalizeSerialError} so every
   *    emission is a well-formed {@link SerialError}.
   * 2. Multiplex the normalised error on `errors$`.
   * 3. Resolve severity from the normalised {@link SerialError.code} via
   *    {@link resolveErrorSeverity} (see `ERROR_SEVERITY` in
   *    `error-severity.ts`).
   * 4. For fatal severities, drive `state$` to `'error'`, clear the send
   *    queue so pending writes fail fast, and tear down the live pump +
   *    port. The teardown promise is retained so a later `connect$` waits
   *    until `close()` settles. A rejection does not change state.
   *
   * Returning the normalised error keeps call sites terse: they can hand
   * the result straight to `subscriber.error(...)` without re-normalising.
   */
  const reportError = (
    error: unknown,
    options: NormalizeSerialErrorOptions,
  ): SerialError => {
    const serialError = normalizeSerialError(error, options);
    if (isDisposed()) {
      return serialError;
    }
    errorsSubject.next(serialError);
    if (resolveErrorSeverity(serialError.code) === 'fatal') {
      const resources = captureResources(controller.runtime);
      controller.transition(createErrorRuntime(serialError));
      trackFatalTeardown(
        teardownResources(resources, {
          closeMode: 'safe',
          cancelInFlightConnect: false,
        }),
      );
    }
    return serialError;
  };

  return { reportError, createDisposedError, whenFatalTeardownSettled };
}

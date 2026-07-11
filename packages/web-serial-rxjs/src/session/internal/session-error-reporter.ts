import type { Subject } from 'rxjs';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import { resolveErrorSeverity } from './error-severity';
import {
  normalizeSerialError,
  type NormalizeSerialErrorOptions,
} from '../normalize-serial-error';
import type { ReadPump } from '../read-pump';
import type { SendQueue } from '../send-queue';
import {
  createErrorRuntime,
  getRuntimePort,
  getRuntimePump,
  type SessionRuntimeController,
} from '../session-runtime';

/**
 * Dependencies for {@link createSessionErrorReporter}.
 *
 * @internal
 */
export interface SessionErrorReporterDeps {
  controller: SessionRuntimeController;
  errorsSubject: Subject<SerialError>;
  sendQueue: SendQueue;
  isDisposed: () => boolean;
  updatePortInfo: (port: SerialPort | null) => void;
  teardownPump: (pump: ReadPump | null) => Promise<void>;
  closePortSafely: (port: SerialPort | null) => Promise<void>;
}

/**
 * Centralised error reporting for {@link createSerialSession}.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/204 | Issue #204}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/401 | Issue #401}
 */
export function createSessionErrorReporter(deps: SessionErrorReporterDeps): {
  reportError: (
    error: unknown,
    options: NormalizeSerialErrorOptions,
  ) => SerialError;
  createDisposedError: () => SerialError;
} {
  const {
    controller,
    errorsSubject,
    sendQueue,
    isDisposed,
    updatePortInfo,
    teardownPump,
    closePortSafely,
  } = deps;

  const createDisposedError = (): SerialError =>
    new SerialError(
      SerialErrorCode.SESSION_DISPOSED,
      'SerialSession has been disposed',
    );

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
   *    port off the hot path.
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
      const runtime = controller.runtime;
      const portToClose = getRuntimePort(runtime);
      const pump = getRuntimePump(runtime);
      controller.transition(createErrorRuntime(serialError));
      sendQueue.clear();
      updatePortInfo(null);
      void teardownPump(pump).then(() => closePortSafely(portToClose));
    }
    return serialError;
  };

  return { reportError, createDisposedError };
}

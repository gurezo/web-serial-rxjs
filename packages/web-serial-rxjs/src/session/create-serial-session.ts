import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  Subject,
} from 'rxjs';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import { createTerminalBuffer } from '../terminal/create-terminal-buffer';
import type { SerialPayload } from '../types';
import { hasWebSerialSupport } from './internal/has-web-serial-support';
import { createReceivePipeline } from './internal/receive-pipeline';
import { createSessionErrorReporter } from './internal/session-error-reporter';
import { createSessionLifecycle } from './internal/session-lifecycle';
import { normalizeSerialError } from './normalize-serial-error';
import { createSendQueue } from './send-queue';
import type { SerialSession } from './serial-session';
import {
  resolveSerialSessionOptions,
  type SerialSessionOptions,
} from './serial-session-options';
import { SerialSessionStatus } from './serial-session-state';
import {
  createInitialRuntime,
  createSessionRuntimeController,
} from './session-runtime';

/**
 * Create a {@link SerialSession}.
 *
 * This release wires the internal read pump (#202) and the internal send
 * queue (#203) into the session so that `connect$`, `disconnect$`,
 * `receive$`, and `send$` all operate end-to-end. Error handling is
 * centralised through a single `reportError` helper (#204) so every
 * failure path normalises through {@link normalizeSerialError} and emits
 * on the one `errors$` channel.
 *
 * Key behaviors:
 *
 * - `isBrowserSupported()` returns whether `navigator.serial` is available.
 * - `state$` replays the current lifecycle state driven by the internal
 *   {@link SessionRuntime} controller.
 * - `connect$()` opens a user-selected port, starts the internal read pump,
 *   and transitions `idle -> connecting -> connected`.
 * - `disconnect$()` stops the read pump, closes the port, and transitions
 *   `connected -> disconnecting -> idle`. When called during `connecting`,
 *   it cancels the in-flight `connect$()` and returns to `idle`.
 * - `receive$` emits UTF-8 decoded text chunks pushed by the pump. It is
 *   **not** subscription-lazy - the pump is started by `connect$` and
 *   decoded text is multicast to all subscribers; late subscribers see only
 *   new data.
 * - `lines$` emits the same decoded stream split into line-terminated
 *   segments (`\n`, `\r\n`); a trailing line without a terminator is
 *   buffered. It is also not subscription-lazy relative to the pump.
 * - `send$` enqueues each payload on an internal FIFO queue so concurrent
 *   subscribers are written to the port in call order. String payloads are
 *   UTF-8 encoded through a shared `TextEncoder`.
 * - `errors$` multiplexes every {@link SerialError} produced by the
 *   session. Connect / read / close failures are treated as fatal and
 *   also drive `state$` to `'error'`; write failures are non-fatal and
 *   do not mutate `state$` because a real connection loss will be
 *   observed by the read pump on the next tick anyway.
 *
 * @param options - Session options. Only `filters` is consulted by
 *   `connect$` today (forwarded to `navigator.serial.requestPort`); the
 *   remaining fields are passed to `port.open` using defaults when omitted.
 * @returns A {@link SerialSession} instance.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/202 | Issue #202}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/203 | Issue #203}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/204 | Issue #204}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/397 | Issue #397}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/399 | Issue #399}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/401 | Issue #401}
 */
export function createSerialSession(
  options?: SerialSessionOptions,
): SerialSession {
  const resolvedOptions = resolveSerialSessionOptions(options);

  const controller = createSessionRuntimeController(
    createInitialRuntime(hasWebSerialSupport()),
  );
  const errorsSubject = new Subject<SerialError>();
  const sendQueue = createSendQueue();
  const textEncoder = new TextEncoder();
  const portInfoSubject = new BehaviorSubject<SerialPortInfo | null>(null);

  const isDisposed = (): boolean =>
    controller.status === SerialSessionStatus.Disposed;

  const errorReporterRef: {
    reportError?: (
      error: unknown,
      options: Parameters<typeof normalizeSerialError>[1],
    ) => SerialError;
    createDisposedError?: () => SerialError;
  } = {};

  const receivePipeline = createReceivePipeline({
    resolvedOptions,
    reportError: (error, options) =>
      errorReporterRef.reportError!(error, options),
  });

  const lifecycle = createSessionLifecycle({
    controller,
    resolvedOptions,
    sendQueue,
    receivePipeline,
    portInfoSubject,
    errorsSubject,
    isDisposed,
    reportError: (error, options) =>
      errorReporterRef.reportError!(error, options),
    createDisposedError: () => errorReporterRef.createDisposedError!(),
  });

  const { reportError, createDisposedError } = createSessionErrorReporter({
    controller,
    errorsSubject,
    sendQueue,
    isDisposed,
    updatePortInfo: lifecycle.updatePortInfo,
    teardownPump: lifecycle.teardownPump,
    closePortSafely: lifecycle.closePortSafely,
  });
  errorReporterRef.reportError = reportError;
  errorReporterRef.createDisposedError = createDisposedError;

  const { receive$, lines$, receiveReplay$ } = receivePipeline;
  const errors$ = errorsSubject.asObservable();
  const terminalText$ = createTerminalBuffer(
    receive$,
    resolvedOptions.terminalBuffer,
  ).text$;
  const isConnected$ = controller.state$.pipe(
    map((state) => state.status === SerialSessionStatus.Connected),
    distinctUntilChanged(),
  );
  const portInfo$ = portInfoSubject.asObservable();

  return {
    isBrowserSupported(): boolean {
      return hasWebSerialSupport();
    },
    connect$: lifecycle.connect$,
    disconnect$: lifecycle.disconnect$,
    dispose$: lifecycle.dispose$,
    destroy$: lifecycle.dispose$,
    send$(data: SerialPayload): Observable<void> {
      if (isDisposed()) {
        return new Observable<void>((subscriber) => {
          subscriber.error(createDisposedError());
        });
      }

      return sendQueue.enqueue(async () => {
        const payload =
          typeof data === 'string' ? textEncoder.encode(data) : data;
        try {
          await lifecycle.writeToPort(payload);
        } catch (error) {
          throw reportError(error, {
            fallbackCode: SerialErrorCode.WRITE_FAILED,
            messagePrefix: 'Failed to write data',
          });
        }
      });
    },
    state$: controller.state$,
    isConnected$,
    portInfo$,
    getPortInfo(): SerialPortInfo | null {
      return portInfoSubject.getValue();
    },
    errors$,
    receive$,
    terminalText$,
    receiveReplay$,
    lines$,
  } satisfies SerialSession;
}

import { catchError, defer, Observable, Subject, throwError } from 'rxjs';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import { createTerminalBuffer } from '../terminal/create-terminal-buffer';
import type { SerialPayload } from '../types';
import { isWebSerialSupported } from './internal/has-web-serial-support';
import { createPortTeardown } from './internal/port-teardown';
import { createReceivePipeline } from './internal/receive-pipeline';
import { createSessionErrorReporter } from './internal/session-error-reporter';
import { createSessionLifecycle } from './internal/session-lifecycle';
import { createSendQueue, SendQueueClearedError } from './send-queue';
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
 * - `state$` replays the current lifecycle state driven by the internal
 *   {@link SessionRuntime} controller.
 * - `connect$()` opens a user-selected port, starts the internal read pump,
 *   and transitions `idle -> connecting -> connected`.
 * - `disconnect$()` stops the read pump, closes the port, and transitions
 *   `connected -> disconnecting -> idle`. When called during `connecting`,
 *   it cancels the in-flight `connect$()` and returns to `idle`. If `open()`
 *   has started, it completes after that port is released; `state$` may
 *   already be `idle` before that completion. While `requestPort()` is still
 *   pending it completes without waiting, because the picker cannot be
 *   aborted and no port is held yet.
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
 * @param options - Session options. W3C connection fields (`baudRate`,
 *   `dataBits`, …) are passed to `port.open`. `filters` is forwarded to
 *   `navigator.serial.requestPort`. `lineBuffer` / `terminalBuffer` configure
 *   {@link SerialSession.lines$} and {@link SerialSession.terminalText$}.
 *   Omitted fields use {@link resolveSerialSessionOptions} defaults; minimal
 *   callers typically only set `baudRate`.
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
    createInitialRuntime(isWebSerialSupported()),
  );
  const errorsSubject = new Subject<SerialError>();
  const sendQueue = createSendQueue();
  const textEncoder = new TextEncoder();

  const isDisposed = (): boolean =>
    controller.status === SerialSessionStatus.Disposed;

  const receivePipeline = createReceivePipeline({ resolvedOptions });

  const { teardownPump, closePortSafely, captureResources, teardownResources } =
    createPortTeardown({
      receivePipeline,
      sendQueue,
    });

  const { reportError, createDisposedError, whenFatalTeardownSettled } =
    createSessionErrorReporter({
      controller,
      errorsSubject,
      isDisposed,
      captureResources,
      teardownResources,
    });

  // Route receive-side buffer overflows through the single reportError entry
  // point. The subscription completes when the pipeline completes on dispose.
  receivePipeline.bufferErrors$.subscribe((error) =>
    reportError(error, { fallbackCode: error.code }),
  );

  const lifecycle = createSessionLifecycle({
    controller,
    resolvedOptions,
    sendQueue,
    receivePipeline,
    errorsSubject,
    isDisposed,
    teardownPump,
    closePortSafely,
    captureResources,
    teardownResources,
    reportError,
    createDisposedError,
    whenFatalTeardownSettled,
  });

  const { receive$, lines$ } = receivePipeline;
  const errors$ = errorsSubject.asObservable();
  const terminalText$ = createTerminalBuffer(
    receive$,
    resolvedOptions.terminalBuffer,
  ).text$;

  return {
    connect$: lifecycle.connect$,
    disconnect$: lifecycle.disconnect$,
    dispose$: lifecycle.dispose$,
    send$(data: SerialPayload): Observable<void> {
      if (isDisposed()) {
        return new Observable<void>((subscriber) => {
          subscriber.error(createDisposedError());
        });
      }

      return defer(() => {
        const payload = snapshotSerialPayload(data, textEncoder);
        return sendQueue.enqueue(async () => {
          try {
            await lifecycle.writeToPort(payload);
          } catch (error) {
            throw reportError(error, {
              fallbackCode: SerialErrorCode.WRITE_FAILED,
              messagePrefix: 'Failed to write data',
            });
          }
        });
      }).pipe(
        catchError((error: unknown) => {
          if (error instanceof SendQueueClearedError) {
            return throwError(
              () =>
                new SerialError(
                  SerialErrorCode.PORT_NOT_OPEN,
                  'Cannot send data while session is not connected',
                ),
            );
          }
          return throwError(() => error);
        }),
      );
    },
    state$: controller.state$,
    errors$,
    receive$,
    terminalText$,
    lines$,
  } satisfies SerialSession;
}

/**
 * Freeze the bytes that {@link SerialSession.send$} will write.
 *
 * Runs when the cold Observable is subscribed, which is also when the send
 * is enqueued. `Uint8Array` values are copied so a later mutation of the
 * caller's buffer cannot change a queued write. Strings are immutable and
 * are UTF-8 encoded at the same moment. `new Uint8Array(data)` copies the
 * view (including `subarray`) into a new buffer. `Buffer#slice` is not used
 * because it shares the underlying memory.
 */
function snapshotSerialPayload(
  data: SerialPayload,
  textEncoder: TextEncoder,
): Uint8Array {
  return typeof data === 'string'
    ? textEncoder.encode(data)
    : new Uint8Array(data);
}

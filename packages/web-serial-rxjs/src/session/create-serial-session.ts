import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  share,
  Subject,
  switchMap,
} from 'rxjs';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import { createTerminalBuffer } from '../terminal/create-terminal-buffer';
import type { SerialPayload } from '../types';
import { buildRequestOptions } from './internal/build-request-options';
import { resolveErrorSeverity } from './internal/error-severity';
import { hasWebSerialSupport } from './internal/has-web-serial-support';
import { createLineBuffer } from './internal/line-buffer';
import {
  createReceiveReplayBuffer,
  type ReceiveReplayBuffer,
} from './internal/receive-replay-buffer';
import {
  normalizeSerialError,
  type NormalizeSerialErrorOptions,
} from './normalize-serial-error';
import { createReadPump, type ReadPump } from './read-pump';
import { createSendQueue } from './send-queue';
import type { SerialSession } from './serial-session';
import {
  resolveSerialSessionOptions,
  type SerialSessionOptions,
} from './serial-session-options';
import { SerialSessionState } from './serial-session-state';
import {
  createConnectedRuntime,
  createConnectingRuntime,
  createDisconnectingRuntime,
  createDisposedRuntime,
  createErrorRuntime,
  createIdleRuntime,
  createInitialRuntime,
  createSessionRuntimeController,
  getRuntimePort,
  getRuntimePump,
  type SessionRuntime,
} from './session-runtime';

/**
 * Create a v2 {@link SerialSession}.
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
 */
export function createSerialSession(
  options?: SerialSessionOptions,
): SerialSession {
  const resolvedOptions = resolveSerialSessionOptions(options);

  const supported = hasWebSerialSupport();
  const controller = createSessionRuntimeController(
    createInitialRuntime(supported),
  );
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const sendQueue = createSendQueue();
  const textEncoder = new TextEncoder();
  const lineBuffer = createLineBuffer(resolvedOptions.lineBuffer);

  const errors$ = errorsSubject.asObservable();
  const receive$ = receiveSubject.asObservable();
  const lines$ = linesSubject.asObservable();
  const terminalText$ = createTerminalBuffer(
    receive$,
    resolvedOptions.terminalBuffer,
  ).text$;

  const isConnected$ = controller.state$.pipe(
    map((state) => state === SerialSessionState.Connected),
    distinctUntilChanged(),
  );

  const portInfoSubject = new BehaviorSubject<SerialPortInfo | null>(null);
  const portInfo$ = portInfoSubject.asObservable();

  const receiveReplayStream$ = resolvedOptions.receiveReplay.enabled
    ? new BehaviorSubject<Observable<string>>(receive$)
    : null;
  let activeReceiveReplay: ReceiveReplayBuffer | null = null;

  const clearLiveReceiveReplay = (): void => {
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

  const isDisposed = (): boolean =>
    controller.status === SerialSessionState.Disposed;

  const createDisposedError = (): SerialError =>
    new SerialError(
      SerialErrorCode.SESSION_DISPOSED,
      'SerialSession has been disposed',
    );

  const updatePortInfo = (port: SerialPort | null): void => {
    portInfoSubject.next(port ? port.getInfo() : null);
  };

  const teardownPump = async (pump: ReadPump | null): Promise<void> => {
    clearLiveReceiveReplay();
    lineBuffer.clear();
    if (pump) {
      await pump.stop();
    }
  };

  const closePortSafely = async (port: SerialPort | null): Promise<void> => {
    if (!port) {
      return;
    }
    try {
      await port.close();
    } catch {
      // The read pump may already have errored the stream, which makes
      // close() reject. We ignore it here because disconnect$ has a
      // dedicated error path for close failures initiated by the user.
    }
  };

  const teardownFromSnapshot = async (
    snapshot: SessionRuntime,
  ): Promise<void> => {
    if (snapshot.status === SerialSessionState.Connecting) {
      snapshot.cancel();
    }

    sendQueue.clear();

    if (
      snapshot.status === SerialSessionState.Connected ||
      snapshot.status === SerialSessionState.Disconnecting ||
      snapshot.status === SerialSessionState.Error
    ) {
      const portToClose = getRuntimePort(snapshot);
      const pump = getRuntimePump(snapshot);
      await teardownPump(pump);
      await closePortSafely(portToClose);
      updatePortInfo(null);
    }

    lineBuffer.clear();
  };

  const completeSubjects = (): void => {
    controller.complete();
    errorsSubject.complete();
    receiveSubject.complete();
    linesSubject.complete();
    portInfoSubject.complete();
    receiveReplayStream$?.complete();
  };

  const dispose$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (isDisposed()) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      const snapshot = controller.runtime;
      controller.transition(createDisposedRuntime());

      const run = async (): Promise<void> => {
        try {
          await teardownFromSnapshot(snapshot);
          completeSubjects();
          subscriber.next();
          subscriber.complete();
        } catch (error) {
          const serialError = normalizeSerialError(error, {
            fallbackCode: SerialErrorCode.UNKNOWN,
            messagePrefix: 'Unexpected dispose failure',
          });
          subscriber.error(serialError);
        }
      };

      void run();
    });

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
      controller.transition(createErrorRuntime());
      sendQueue.clear();
      updatePortInfo(null);
      void teardownPump(pump).then(() => closePortSafely(portToClose));
    }
    return serialError;
  };

  const writeToPort = async (payload: Uint8Array): Promise<void> => {
    const runtime = controller.runtime;
    if (
      runtime.status !== SerialSessionState.Connected ||
      !runtime.port.writable
    ) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Cannot send data while session is not connected',
      );
    }
    const writer = runtime.port.writable.getWriter();
    try {
      await writer.write(payload);
    } finally {
      try {
        writer.releaseLock();
      } catch {
        // releaseLock throws when the stream is already errored; the real
        // failure is surfaced through the write() rejection above so we
        // intentionally swallow this secondary error.
      }
    }
  };

  return {
    isBrowserSupported(): boolean {
      return hasWebSerialSupport();
    },
    connect$(): Observable<void> {
      return new Observable<void>((subscriber) => {
        if (isDisposed()) {
          subscriber.error(createDisposedError());
          return;
        }

        if (!hasWebSerialSupport()) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.BROWSER_NOT_SUPPORTED,
              'Web Serial API is not supported in this environment',
            ),
            { fallbackCode: SerialErrorCode.BROWSER_NOT_SUPPORTED },
          );
          subscriber.error(error);
          return;
        }

        const current = controller.status;
        if (
          current !== SerialSessionState.Idle &&
          current !== SerialSessionState.Error
        ) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.PORT_ALREADY_OPEN,
              `Cannot connect while session state is '${current}'`,
            ),
            { fallbackCode: SerialErrorCode.PORT_ALREADY_OPEN },
          );
          subscriber.error(error);
          return;
        }

        let cancelled = false;
        const cancelInFlightConnect = (): void => {
          cancelled = true;
          if (controller.status === SerialSessionState.Connecting) {
            controller.transition(createIdleRuntime());
          }
        };
        controller.transition(createConnectingRuntime(cancelInFlightConnect));

        const run = async (): Promise<void> => {
          let selectedPort: SerialPort | null = null;
          try {
            selectedPort = await navigator.serial.requestPort(
              buildRequestOptions(resolvedOptions),
            );
            await selectedPort.open({
              baudRate: resolvedOptions.baudRate,
              dataBits: resolvedOptions.dataBits,
              stopBits: resolvedOptions.stopBits,
              parity: resolvedOptions.parity,
              bufferSize: resolvedOptions.bufferSize,
              flowControl: resolvedOptions.flowControl,
            });
          } catch (error) {
            if (selectedPort) {
              await closePortSafely(selectedPort);
            }
            const serialError = reportError(error, {
              fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
              messagePrefix: 'Failed to open port',
            });
            if (!cancelled) {
              subscriber.error(serialError);
            }
            return;
          }

          if (cancelled || isDisposed()) {
            await closePortSafely(selectedPort);
            return;
          }

          lineBuffer.clear();
          if (resolvedOptions.receiveReplay.enabled) {
            startLiveReceiveReplay();
          }
          const pump = createReadPump(selectedPort, {
            onChunk: (text) => {
              receiveSubject.next(text);
              if (activeReceiveReplay) {
                const { overflowed } = activeReceiveReplay.next(text);
                if (overflowed) {
                  reportError(
                    new SerialError(
                      SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW,
                      `Receive replay buffer exceeded configured limits; oldest chunks were discarded`,
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
                    `Line buffer exceeded maxChars (${resolvedOptions.lineBuffer.maxChars}); leading data was discarded`,
                  ),
                  { fallbackCode: SerialErrorCode.LINE_BUFFER_OVERFLOW },
                );
              }
              for (const line of lines) {
                linesSubject.next(line);
              }
            },
            onError: (pumpError) =>
              reportError(pumpError, {
                fallbackCode: SerialErrorCode.READ_FAILED,
                messagePrefix: 'Read pump failed',
              }),
            onDone: () => {
              if (controller.status !== SerialSessionState.Connected) {
                return;
              }
              reportError(
                new SerialError(
                  SerialErrorCode.CONNECTION_LOST,
                  'Read pump ended unexpectedly: stream closed while connected',
                ),
                {
                  fallbackCode: SerialErrorCode.CONNECTION_LOST,
                },
              );
            },
          });
          pump.start();
          sendQueue.clear();
          if (isDisposed()) {
            await teardownPump(pump);
            await closePortSafely(selectedPort);
            return;
          }
          controller.transition(createConnectedRuntime(selectedPort, pump));
          updatePortInfo(selectedPort);
          subscriber.next();
          subscriber.complete();
        };

        void run();

        return () => {
          cancelInFlightConnect();
        };
      });
    },
    disconnect$(): Observable<void> {
      return new Observable<void>((subscriber) => {
        if (isDisposed()) {
          subscriber.next();
          subscriber.complete();
          return;
        }

        const runtime = controller.runtime;

        if (
          runtime.status === SerialSessionState.Idle ||
          runtime.status === SerialSessionState.Unsupported ||
          runtime.status === SerialSessionState.Disconnecting
        ) {
          subscriber.next();
          subscriber.complete();
          return;
        }

        if (runtime.status === SerialSessionState.Connecting) {
          runtime.cancel();
          subscriber.next();
          subscriber.complete();
          return;
        }

        if (
          runtime.status !== SerialSessionState.Connected &&
          runtime.status !== SerialSessionState.Error
        ) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.PORT_NOT_OPEN,
              `Cannot disconnect while session state is '${runtime.status}'`,
            ),
            { fallbackCode: SerialErrorCode.PORT_NOT_OPEN },
          );
          subscriber.error(error);
          return;
        }

        const portToClose = getRuntimePort(runtime);
        controller.transition(createDisconnectingRuntime(portToClose));
        sendQueue.clear();

        const run = async (): Promise<void> => {
          try {
            const pump = getRuntimePump(controller.runtime);
            await teardownPump(pump);
            if (portToClose) {
              try {
                await portToClose.close();
              } catch (error) {
                updatePortInfo(null);
                const serialError = reportError(error, {
                  fallbackCode: SerialErrorCode.CONNECTION_LOST,
                  messagePrefix: 'Failed to close port',
                });
                subscriber.error(serialError);
                return;
              }
            }
            updatePortInfo(null);
            if (!isDisposed()) {
              controller.transition(createIdleRuntime());
            }
            subscriber.next();
            subscriber.complete();
          } catch (error) {
            const serialError = reportError(error, {
              fallbackCode: SerialErrorCode.UNKNOWN,
              messagePrefix: 'Unexpected disconnect failure',
            });
            subscriber.error(serialError);
          }
        };

        void run();
      });
    },
    dispose$,
    destroy$: dispose$,
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
          await writeToPort(payload);
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
    getCurrentPort(): SerialPort | null {
      return getRuntimePort(controller.runtime);
    },
    errors$,
    receive$,
    terminalText$,
    receiveReplay$,
    lines$,
  } satisfies SerialSession;
}

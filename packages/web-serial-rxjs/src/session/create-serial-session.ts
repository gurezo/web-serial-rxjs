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
import { buildRequestOptions } from './internal/build-request-options';
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
import { SessionStateMachine } from './session-state-machine';

/**
 * Internal error classification used by the single `reportError` entry
 * point. `'fatal'` errors drive `state$` into `'error'` and tear down
 * the live session (pump stop + port close); `'non-fatal'` errors are
 * only multiplexed on `errors$` without mutating session state - this
 * matches the Issue #199 design note that write failures must not
 * implicitly disconnect the session.
 *
 * @internal
 */
type ReportErrorSeverity = 'fatal' | 'non-fatal';

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
 * - `state$` replays the current lifecycle state driven by
 *   {@link SessionStateMachine}.
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
 */
export function createSerialSession(
  options?: SerialSessionOptions,
): SerialSession {
  const resolvedOptions = resolveSerialSessionOptions(options);

  const supported = hasWebSerialSupport();
  const machine = new SessionStateMachine(
    supported ? SerialSessionState.Idle : SerialSessionState.Unsupported,
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

  const isConnected$ = machine.state$.pipe(
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

  let activePort: SerialPort | null = null;
  let activePump: ReadPump | null = null;
  let activeConnectCancel: (() => void) | null = null;
  let disposed = false;

  const createDisposedError = (): SerialError =>
    new SerialError(
      SerialErrorCode.SESSION_DISPOSED,
      'SerialSession has been disposed',
    );

  const completeSession = async (): Promise<void> => {
    const current = machine.current;

    if (current === SerialSessionState.Connecting) {
      activeConnectCancel?.();
    }

    sendQueue.clear();

    if (
      current === SerialSessionState.Connected ||
      current === SerialSessionState.Error ||
      current === SerialSessionState.Disconnecting
    ) {
      const portToClose = activePort;
      await teardownPump();
      await closePortSafely(portToClose);
      setActivePort(null);
    }

    lineBuffer.clear();
    machine.toDisposed();
    machine.complete();
    errorsSubject.complete();
    receiveSubject.complete();
    linesSubject.complete();
    portInfoSubject.complete();
    receiveReplayStream$?.complete();
  };

  const dispose$ = (): Observable<void> =>
    new Observable<void>((subscriber) => {
      if (disposed) {
        subscriber.next();
        subscriber.complete();
        return;
      }

      disposed = true;

      const run = async (): Promise<void> => {
        try {
          await completeSession();
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

  const clearActiveConnectCancel = (cancel: () => void): void => {
    if (activeConnectCancel === cancel) {
      activeConnectCancel = null;
    }
  };

  const setActivePort = (port: SerialPort | null): void => {
    activePort = port;
    portInfoSubject.next(port ? port.getInfo() : null);
  };

  const teardownPump = async (): Promise<void> => {
    clearLiveReceiveReplay();
    const pump = activePump;
    activePump = null;
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

  /**
   * Single entry point for every error that should reach `errors$`.
   *
   * Responsibilities:
   *
   * 1. Normalise the input through {@link normalizeSerialError} so every
   *    emission is a well-formed {@link SerialError}.
   * 2. Multiplex the normalised error on `errors$`.
   * 3. For fatal severities, drive `state$` to `'error'`, clear the send
   *    queue so pending writes fail fast, and tear down the live pump +
   *    port off the hot path.
   *
   * Returning the normalised error keeps call sites terse: they can hand
   * the result straight to `subscriber.error(...)` without re-normalising.
   */
  const reportError = (
    error: unknown,
    severity: ReportErrorSeverity,
    options: NormalizeSerialErrorOptions,
  ): SerialError => {
    const serialError = normalizeSerialError(error, options);
    if (disposed) {
      return serialError;
    }
    errorsSubject.next(serialError);
    if (severity === 'fatal') {
      machine.toError();
      sendQueue.clear();
      const portToClose = activePort;
      setActivePort(null);
      void teardownPump().then(() => closePortSafely(portToClose));
    }
    return serialError;
  };

  const writeToPort = async (payload: Uint8Array): Promise<void> => {
    const port = activePort;
    if (machine.current !== SerialSessionState.Connected || !port || !port.writable) {
      throw new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Cannot send data while session is not connected',
      );
    }
    const writer = port.writable.getWriter();
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
        if (disposed) {
          subscriber.error(createDisposedError());
          return;
        }

        if (!hasWebSerialSupport()) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.BROWSER_NOT_SUPPORTED,
              'Web Serial API is not supported in this environment',
            ),
            'non-fatal',
            { fallbackCode: SerialErrorCode.BROWSER_NOT_SUPPORTED },
          );
          subscriber.error(error);
          return;
        }

        const current = machine.current;
        if (
          current !== SerialSessionState.Idle &&
          current !== SerialSessionState.Error
        ) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.PORT_ALREADY_OPEN,
              `Cannot connect while session state is '${current}'`,
            ),
            'non-fatal',
            { fallbackCode: SerialErrorCode.PORT_ALREADY_OPEN },
          );
          subscriber.error(error);
          return;
        }

        let cancelled = false;
        const cancelInFlightConnect = (): void => {
          cancelled = true;
          if (machine.current === SerialSessionState.Connecting) {
            machine.toIdle();
          }
        };
        activeConnectCancel = cancelInFlightConnect;
        machine.toConnecting();

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
            const serialError = reportError(error, 'fatal', {
              fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
              messagePrefix: 'Failed to open port',
            });
            if (!cancelled) {
              subscriber.error(serialError);
            }
            return;
          }

          if (cancelled || disposed) {
            await closePortSafely(selectedPort);
            return;
          }

          setActivePort(selectedPort);
          lineBuffer.clear();
          if (resolvedOptions.receiveReplay.enabled) {
            startLiveReceiveReplay();
          }
          activePump = createReadPump(selectedPort, {
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
                    'non-fatal',
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
                  'non-fatal',
                  { fallbackCode: SerialErrorCode.LINE_BUFFER_OVERFLOW },
                );
              }
              for (const line of lines) {
                linesSubject.next(line);
              }
            },
            onError: (pumpError) =>
              reportError(pumpError, 'fatal', {
                fallbackCode: SerialErrorCode.READ_FAILED,
                messagePrefix: 'Read pump failed',
              }),
            onDone: () => {
              if (machine.current !== SerialSessionState.Connected) {
                return;
              }
              reportError(
                new SerialError(
                  SerialErrorCode.CONNECTION_LOST,
                  'Read pump ended unexpectedly: stream closed while connected',
                ),
                'fatal',
                {
                  fallbackCode: SerialErrorCode.CONNECTION_LOST,
                },
              );
            },
          });
          activePump.start();
          sendQueue.clear();
          if (disposed) {
            await teardownPump();
            await closePortSafely(selectedPort);
            setActivePort(null);
            return;
          }
          machine.toConnected();
          subscriber.next();
          subscriber.complete();
        };

        void run();

        return () => {
          clearActiveConnectCancel(cancelInFlightConnect);
          cancelInFlightConnect();
        };
      });
    },
    disconnect$(): Observable<void> {
      return new Observable<void>((subscriber) => {
        if (disposed) {
          subscriber.next();
          subscriber.complete();
          return;
        }

        const current = machine.current;

        if (
          current === SerialSessionState.Idle ||
          current === SerialSessionState.Unsupported ||
          current === SerialSessionState.Disconnecting
        ) {
          subscriber.next();
          subscriber.complete();
          return;
        }

        if (current === SerialSessionState.Connecting) {
          activeConnectCancel?.();
          subscriber.next();
          subscriber.complete();
          return;
        }

        if (
          current !== SerialSessionState.Connected &&
          current !== SerialSessionState.Error
        ) {
          const error = reportError(
            new SerialError(
              SerialErrorCode.PORT_NOT_OPEN,
              `Cannot disconnect while session state is '${current}'`,
            ),
            'non-fatal',
            { fallbackCode: SerialErrorCode.PORT_NOT_OPEN },
          );
          subscriber.error(error);
          return;
        }

        machine.toDisconnecting();
        sendQueue.clear();
        const portToClose = activePort;

        const run = async (): Promise<void> => {
          try {
            await teardownPump();
            if (portToClose) {
              try {
                await portToClose.close();
              } catch (error) {
                setActivePort(null);
                const serialError = reportError(error, 'fatal', {
                  fallbackCode: SerialErrorCode.CONNECTION_LOST,
                  messagePrefix: 'Failed to close port',
                });
                subscriber.error(serialError);
                return;
              }
            }
            setActivePort(null);
            if (!disposed) {
              machine.toIdle();
            }
            subscriber.next();
            subscriber.complete();
          } catch (error) {
            const serialError = reportError(error, 'fatal', {
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
    send$(data: string | Uint8Array): Observable<void> {
      if (disposed) {
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
          throw reportError(error, 'non-fatal', {
            fallbackCode: SerialErrorCode.WRITE_FAILED,
            messagePrefix: 'Failed to write data',
          });
        }
      });
    },
    state$: machine.state$,
    isConnected$,
    portInfo$,
    getPortInfo(): SerialPortInfo | null {
      return portInfoSubject.getValue();
    },
    getCurrentPort(): SerialPort | null {
      return activePort;
    },
    errors$,
    receive$,
    terminalText$,
    receiveReplay$,
    lines$,
  } satisfies SerialSession;
}

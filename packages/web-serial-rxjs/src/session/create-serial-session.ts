import { Observable, Subject, defer, throwError } from 'rxjs';
import { hasWebSerialSupport } from '../browser/browser-detection';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import { buildRequestOptions } from '../filters/build-request-options';
import { DEFAULT_SERIAL_CLIENT_OPTIONS } from '../types/options';
import { createReadPump, type ReadPump } from './read-pump';
import type { SerialSession } from './serial-session';
import type { SerialSessionOptions } from './serial-session-options';
import { SessionStateMachine } from './session-state-machine';

const SEND_NOT_IMPLEMENTED_MESSAGE =
  'SerialSession.send$ is not implemented yet. Tracked by https://github.com/gurezo/web-serial-rxjs/issues/203';

function sendNotImplemented$(): Observable<never> {
  return defer(() =>
    throwError(
      () =>
        new SerialError(SerialErrorCode.UNKNOWN, SEND_NOT_IMPLEMENTED_MESSAGE),
    ),
  );
}

function toError(error: unknown, code: SerialErrorCode, fallback: string): SerialError {
  if (error instanceof SerialError) {
    return error;
  }
  const cause = error instanceof Error ? error : new Error(String(error));
  return new SerialError(code, `${fallback}: ${cause.message}`, cause);
}

/**
 * Create a v2 {@link SerialSession}.
 *
 * This release wires the internal read pump (#202) into the session so that
 * `connect$`, `disconnect$`, and `receive$` operate end-to-end. `send$`
 * remains deferred to the follow-up send-queue sub-issue (#203) and fails
 * with a `SerialError` carrying `SerialErrorCode.UNKNOWN` until then.
 *
 * Key behaviors:
 *
 * - `isBrowserSupported()` returns whether `navigator.serial` is available.
 * - `state$` replays the current lifecycle state driven by
 *   {@link SessionStateMachine}.
 * - `connect$()` opens a user-selected port, starts the internal read pump,
 *   and transitions `idle -> connecting -> connected`.
 * - `disconnect$()` stops the read pump, closes the port, and transitions
 *   `connected -> disconnecting -> idle`.
 * - `receive$` emits UTF-8 decoded text chunks pushed by the pump. It is
 *   **not** subscription-lazy - the pump is started by `connect$` and
 *   decoded text is multicast to all subscribers; late subscribers see only
 *   new data.
 * - `errors$` multiplexes errors surfaced by `connect$` / `disconnect$` and
 *   the read pump; those errors also drive `state$` to `'error'`.
 *
 * @param options - Session options. Only `filters` is consulted by
 *   `connect$` today (forwarded to `navigator.serial.requestPort`); the
 *   remaining fields are passed to `port.open` using defaults when omitted.
 * @returns A {@link SerialSession} instance.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/202 | Issue #202}
 */
export function createSerialSession(
  options?: SerialSessionOptions,
): SerialSession {
  const resolvedOptions = {
    ...DEFAULT_SERIAL_CLIENT_OPTIONS,
    ...options,
    filters: options?.filters,
  };

  const supported = hasWebSerialSupport();
  const machine = new SessionStateMachine(supported ? 'idle' : 'unsupported');
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string>();

  const errors$ = errorsSubject.asObservable();
  const receive$ = receiveSubject.asObservable();

  let activePort: SerialPort | null = null;
  let activePump: ReadPump | null = null;

  const teardownPump = async (): Promise<void> => {
    const pump = activePump;
    activePump = null;
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

  const emitPumpError = (error: SerialError): void => {
    errorsSubject.next(error);
    machine.toError();
    // Fire and forget - we can't await inside a sync callback.
    void teardownPump().then(() => closePortSafely(activePort)).then(() => {
      activePort = null;
    });
  };

  return {
    isBrowserSupported(): boolean {
      return hasWebSerialSupport();
    },
    connect$(): Observable<void> {
      return new Observable<void>((subscriber) => {
        if (!hasWebSerialSupport()) {
          const error = new SerialError(
            SerialErrorCode.BROWSER_NOT_SUPPORTED,
            'Web Serial API is not supported in this environment',
          );
          errorsSubject.next(error);
          subscriber.error(error);
          return;
        }

        const current = machine.current;
        if (current !== 'idle' && current !== 'error') {
          const error = new SerialError(
            SerialErrorCode.PORT_ALREADY_OPEN,
            `Cannot connect while session state is '${current}'`,
          );
          errorsSubject.next(error);
          subscriber.error(error);
          return;
        }

        let cancelled = false;
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
            const serialError =
              error instanceof DOMException && error.name === 'NotFoundError'
                ? new SerialError(
                    SerialErrorCode.OPERATION_CANCELLED,
                    'Port selection was cancelled by the user',
                    error,
                  )
                : toError(
                    error,
                    SerialErrorCode.PORT_OPEN_FAILED,
                    'Failed to open port',
                  );
            errorsSubject.next(serialError);
            machine.toError();
            if (!cancelled) {
              subscriber.error(serialError);
            }
            return;
          }

          if (cancelled) {
            await closePortSafely(selectedPort);
            return;
          }

          activePort = selectedPort;
          activePump = createReadPump(selectedPort, {
            onChunk: (text) => receiveSubject.next(text),
            onError: (pumpError) => emitPumpError(pumpError),
          });
          activePump.start();
          machine.toConnected();
          subscriber.next();
          subscriber.complete();
        };

        void run();

        return () => {
          cancelled = true;
        };
      });
    },
    disconnect$(): Observable<void> {
      return new Observable<void>((subscriber) => {
        const current = machine.current;

        if (current === 'idle' || current === 'unsupported') {
          subscriber.next();
          subscriber.complete();
          return;
        }

        if (current !== 'connected' && current !== 'error') {
          const error = new SerialError(
            SerialErrorCode.PORT_NOT_OPEN,
            `Cannot disconnect while session state is '${current}'`,
          );
          errorsSubject.next(error);
          subscriber.error(error);
          return;
        }

        machine.toDisconnecting();
        const portToClose = activePort;

        const run = async (): Promise<void> => {
          try {
            await teardownPump();
            if (portToClose) {
              try {
                await portToClose.close();
              } catch (error) {
                const serialError = toError(
                  error,
                  SerialErrorCode.CONNECTION_LOST,
                  'Failed to close port',
                );
                activePort = null;
                errorsSubject.next(serialError);
                machine.toError();
                subscriber.error(serialError);
                return;
              }
            }
            activePort = null;
            machine.toIdle();
            subscriber.next();
            subscriber.complete();
          } catch (error) {
            const serialError = toError(
              error,
              SerialErrorCode.UNKNOWN,
              'Unexpected disconnect failure',
            );
            errorsSubject.next(serialError);
            machine.toError();
            subscriber.error(serialError);
          }
        };

        void run();
      });
    },
    send$(_data: string | Uint8Array): Observable<void> {
      return sendNotImplemented$();
    },
    state$: machine.state$,
    errors$,
    receive$,
  };
}

import {
  BehaviorSubject,
  Observable,
  Subject,
  defer,
  of,
  throwError,
} from 'rxjs';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import type { SerialSession } from '../../src/session/serial-session';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '../../src/session/serial-session-state';
import type { SerialPayload } from '../../src/types';

/**
 * Controllable Fake {@link SerialSession} for hardware-free application tests
 * (Issue #537).
 *
 * This helper is **not** published on npm. Copy the pattern into app test
 * code, or keep a local twin. It does not emulate the Web Serial API; it only
 * drives the `SerialSession` surface used by application code.
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/537
 */

const DEFAULT_PORT_INFO: SerialPortInfo = {
  usbVendorId: 0x1234,
  usbProductId: 0x5678,
};

const defaultConnectError = (): SerialError =>
  new SerialError(
    SerialErrorCode.PORT_OPEN_FAILED,
    'Fake connect failed',
  );

const defaultSendError = (): SerialError =>
  new SerialError(SerialErrorCode.WRITE_FAILED, 'Fake send failed');

const defaultDisconnectError = (): SerialError =>
  new SerialError(
    SerialErrorCode.CONNECTION_LOST,
    'Fake device disconnected',
  );

export type FakeSerialSessionHandle = {
  /** Structurally assignable to {@link SerialSession}. */
  session: SerialSession;
  /** Payloads recorded when `send$` is subscribed successfully or on failure. */
  readonly sent: readonly SerialPayload[];
  setState(state: SerialSessionState): void;
  emitReceive(chunk: string): void;
  emitLine(line: string): void;
  emitError(error: SerialError): void;
  failNextConnect(error?: SerialError): void;
  failNextSend(error?: SerialError): void;
  /**
   * Simulate an unexpected device unplug while connected.
   * Transitions to `idle` and optionally emits on `errors$`.
   */
  simulateDeviceDisconnect(error?: SerialError): void;
};

/**
 * Create a controllable Fake that implements the {@link SerialSession} contract.
 */
export function createFakeSerialSession(): FakeSerialSessionHandle {
  const stateSubject = new BehaviorSubject<SerialSessionState>({
    status: SerialSessionStatus.Idle,
  });
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const terminalTextSubject = new BehaviorSubject<string>('');

  const sent: SerialPayload[] = [];
  let nextConnectError: SerialError | undefined;
  let nextSendError: SerialError | undefined;

  const session: SerialSession = {
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    lines$: linesSubject.asObservable(),
    terminalText$: terminalTextSubject.asObservable(),

    connect$: (): Observable<void> =>
      defer(() => {
        if (nextConnectError !== undefined) {
          const error = nextConnectError;
          nextConnectError = undefined;
          stateSubject.next({ status: SerialSessionStatus.Connecting });
          stateSubject.next({ status: SerialSessionStatus.Idle });
          errorsSubject.next(error);
          return throwError(() => error);
        }

        stateSubject.next({ status: SerialSessionStatus.Connecting });
        stateSubject.next({
          status: SerialSessionStatus.Connected,
          portInfo: DEFAULT_PORT_INFO,
        });
        return of(undefined);
      }),

    disconnect$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disconnecting });
        stateSubject.next({ status: SerialSessionStatus.Idle });
        return of(undefined);
      }),

    dispose$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disposed });
        return of(undefined);
      }),

    send$: (data: SerialPayload): Observable<void> =>
      defer(() => {
        sent.push(data);
        if (nextSendError !== undefined) {
          const error = nextSendError;
          nextSendError = undefined;
          errorsSubject.next(error);
          return throwError(() => error);
        }
        return of(undefined);
      }),
  };

  return {
    session,
    get sent() {
      return sent;
    },
    setState(state: SerialSessionState): void {
      stateSubject.next(state);
    },
    emitReceive(chunk: string): void {
      receiveSubject.next(chunk);
      terminalTextSubject.next(terminalTextSubject.value + chunk);
    },
    emitLine(line: string): void {
      linesSubject.next(line);
    },
    emitError(error: SerialError): void {
      errorsSubject.next(error);
    },
    failNextConnect(error: SerialError = defaultConnectError()): void {
      nextConnectError = error;
    },
    failNextSend(error: SerialError = defaultSendError()): void {
      nextSendError = error;
    },
    simulateDeviceDisconnect(
      error: SerialError = defaultDisconnectError(),
    ): void {
      stateSubject.next({ status: SerialSessionStatus.Idle });
      errorsSubject.next(error);
    },
  };
}

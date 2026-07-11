import { BehaviorSubject, Observable } from 'rxjs';
import { assertNever } from '../internal/assert-never';
import type { SerialError } from '../errors/serial-error';
import type { ReadPump } from './read-pump';
import {
  SerialSessionStatus,
  type SerialSessionState,
  type SerialSessionStatus as SerialSessionStatusType,
} from './serial-session-state';

/**
 * Discriminated union representing the full internal runtime state of a
 * {@link SerialSession}, including lifecycle status and any resources that
 * are valid for that status.
 *
 * This is the single source of truth for session lifecycle + resources.
 * Public consumers observe the mapped {@link SerialSessionState} via
 * `state$`; this union is internal only.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/397 | Issue #397}
 */
export type SessionRuntime =
  | IdleRuntime
  | ConnectingRuntime
  | ConnectedRuntime
  | DisconnectingRuntime
  | ErrorRuntime
  | UnsupportedRuntime
  | DisposedRuntime;

/** @internal */
export interface IdleRuntime {
  readonly status: typeof SerialSessionStatus.Idle;
}

/** @internal */
export interface ConnectingRuntime {
  readonly status: typeof SerialSessionStatus.Connecting;
  readonly cancel: () => void;
}

/** @internal */
export interface ConnectedRuntime {
  readonly status: typeof SerialSessionStatus.Connected;
  readonly port: SerialPort;
  readonly pump: ReadPump;
}

/** @internal */
export interface DisconnectingRuntime {
  readonly status: typeof SerialSessionStatus.Disconnecting;
  readonly port: SerialPort | null;
}

/** @internal */
export interface ErrorRuntime {
  readonly status: typeof SerialSessionStatus.Error;
  readonly error: SerialError;
}

/** @internal */
export interface UnsupportedRuntime {
  readonly status: typeof SerialSessionStatus.Unsupported;
}

/** @internal */
export interface DisposedRuntime {
  readonly status: typeof SerialSessionStatus.Disposed;
}

const S = SerialSessionStatus;

/**
 * Allowed transitions for the internal SerialSession state machine.
 *
 * `as const satisfies` keeps literal transition targets while ensuring every
 * {@link SerialSessionStatus} key is present. Drift from the status union
 * becomes a compile error.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/398 | Issue #398}
 */
export const ALLOWED_TRANSITIONS = {
  [S.Idle]: [S.Connecting, S.Error, S.Disposed],
  [S.Connecting]: [S.Connected, S.Error, S.Idle, S.Disposed],
  [S.Connected]: [S.Disconnecting, S.Error, S.Disposed],
  [S.Disconnecting]: [S.Idle, S.Error, S.Disposed],
  [S.Error]: [S.Idle, S.Connecting, S.Disposed],
  [S.Unsupported]: [S.Disposed],
  [S.Disposed]: [],
} as const satisfies Readonly<
  Record<SerialSessionStatusType, readonly SerialSessionStatusType[]>
>;

/**
 * Valid target states when transitioning from {@link T}.
 *
 * @internal
 */
export type AllowedTransition<T extends SerialSessionStatusType> =
  (typeof ALLOWED_TRANSITIONS)[T][number];

/** @internal */
export function runtimeToSessionStatus(
  runtime: SessionRuntime,
): SerialSessionStatusType {
  return runtime.status;
}

/**
 * Map internal runtime to the public {@link SerialSessionState} payload.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/406 | Issue #406}
 */
export function runtimeToPublicState(runtime: SessionRuntime): SerialSessionState {
  switch (runtime.status) {
    case S.Idle:
      return { status: S.Idle };
    case S.Connecting:
      return { status: S.Connecting };
    case S.Connected:
      return { status: S.Connected, portInfo: runtime.port.getInfo() };
    case S.Disconnecting:
      return { status: S.Disconnecting };
    case S.Unsupported:
      return { status: S.Unsupported };
    case S.Error:
      return { status: S.Error, error: runtime.error };
    case S.Disposed:
      return { status: S.Disposed };
    default:
      return assertNeverRuntime(runtime);
  }
}

/** @internal */
export function isValidTransition(
  from: SerialSessionStatusType,
  to: SerialSessionStatusType,
): boolean {
  if (from === to) {
    return false;
  }
  return (ALLOWED_TRANSITIONS[from] as readonly SerialSessionStatusType[]).includes(
    to,
  );
}

/** @internal */
export function createIdleRuntime(): IdleRuntime {
  return { status: S.Idle };
}

/** @internal */
export function createConnectingRuntime(cancel: () => void): ConnectingRuntime {
  return { status: S.Connecting, cancel };
}

/** @internal */
export function createConnectedRuntime(
  port: SerialPort,
  pump: ReadPump,
): ConnectedRuntime {
  return { status: S.Connected, port, pump };
}

/** @internal */
export function createDisconnectingRuntime(
  port: SerialPort | null,
): DisconnectingRuntime {
  return { status: S.Disconnecting, port };
}

/** @internal */
export function createErrorRuntime(error: SerialError): ErrorRuntime {
  return { status: S.Error, error };
}

/** @internal */
export function createUnsupportedRuntime(): UnsupportedRuntime {
  return { status: S.Unsupported };
}

/** @internal */
export function createDisposedRuntime(): DisposedRuntime {
  return { status: S.Disposed };
}

/** @internal */
export function createInitialRuntime(supported: boolean): SessionRuntime {
  return supported ? createIdleRuntime() : createUnsupportedRuntime();
}

/**
 * Extract the active port from runtime when one is held.
 *
 * @internal
 */
export function getRuntimePort(runtime: SessionRuntime): SerialPort | null {
  switch (runtime.status) {
    case S.Connected:
      return runtime.port;
    case S.Disconnecting:
      return runtime.port;
    default:
      return null;
  }
}

/**
 * Extract the active pump from runtime when one is held.
 *
 * @internal
 */
export function getRuntimePump(runtime: SessionRuntime): ReadPump | null {
  if (runtime.status === S.Connected) {
    return runtime.pump;
  }
  return null;
}

/**
 * Controller that owns the {@link SessionRuntime} discriminated union and
 * exposes the public `state$` stream derived from the runtime.
 *
 * @internal
 */
export interface SessionRuntimeController {
  get runtime(): SessionRuntime;
  get status(): SerialSessionStatusType;
  get state$(): Observable<SerialSessionState>;
  transition(next: SessionRuntime): boolean;
  complete(): void;
}

/**
 * Create a controller for the internal session runtime.
 *
 * @internal
 */
export function createSessionRuntimeController(
  initial: SessionRuntime,
): SessionRuntimeController {
  let runtime = initial;
  const subject = new BehaviorSubject<SerialSessionState>(
    runtimeToPublicState(initial),
  );

  const transition = (next: SessionRuntime): boolean => {
    const from = runtimeToSessionStatus(runtime);
    const to = runtimeToSessionStatus(next);

    if (from === to) {
      return false;
    }

    if (!isValidTransition(from, to)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[web-serial-rxjs] Ignoring invalid SerialSession transition ${from} -> ${to}`,
        );
      }
      return false;
    }

    runtime = next;
    subject.next(runtimeToPublicState(next));
    return true;
  };

  return {
    get runtime() {
      return runtime;
    },
    get status() {
      return runtimeToSessionStatus(runtime);
    },
    get state$() {
      return subject.asObservable();
    },
    transition,
    complete() {
      subject.complete();
    },
  };
}

/**
 * Exhaustiveness helper for switch statements over {@link SessionRuntime}.
 *
 * @internal
 */
export function assertNeverRuntime(value: never): never {
  return assertNever(value);
}

import { BehaviorSubject, Observable } from 'rxjs';
import { assertNever } from '../internal/assert-never';
import type { ReadPump } from './read-pump';
import { SerialSessionState } from './serial-session-state';

/**
 * Discriminated union representing the full internal runtime state of a
 * {@link SerialSession}, including lifecycle status and any resources that
 * are valid for that status.
 *
 * This is the single source of truth for session lifecycle + resources.
 * Public consumers still observe the flat {@link SerialSessionState} string
 * via `state$`; this union is internal only.
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
  readonly status: typeof SerialSessionState.Idle;
}

/** @internal */
export interface ConnectingRuntime {
  readonly status: typeof SerialSessionState.Connecting;
  readonly cancel: () => void;
}

/** @internal */
export interface ConnectedRuntime {
  readonly status: typeof SerialSessionState.Connected;
  readonly port: SerialPort;
  readonly pump: ReadPump;
}

/** @internal */
export interface DisconnectingRuntime {
  readonly status: typeof SerialSessionState.Disconnecting;
  readonly port: SerialPort | null;
}

/** @internal */
export interface ErrorRuntime {
  readonly status: typeof SerialSessionState.Error;
}

/** @internal */
export interface UnsupportedRuntime {
  readonly status: typeof SerialSessionState.Unsupported;
}

/** @internal */
export interface DisposedRuntime {
  readonly status: typeof SerialSessionState.Disposed;
}

const S = SerialSessionState;

/**
 * Allowed transitions for the internal SerialSession state machine.
 *
 * @internal
 */
export const ALLOWED_TRANSITIONS: Readonly<
  Record<SerialSessionState, readonly SerialSessionState[]>
> = {
  [S.Idle]: [S.Connecting, S.Error, S.Disposed],
  [S.Connecting]: [S.Connected, S.Error, S.Idle, S.Disposed],
  [S.Connected]: [S.Disconnecting, S.Error, S.Disposed],
  [S.Disconnecting]: [S.Idle, S.Error, S.Disposed],
  [S.Error]: [S.Idle, S.Connecting, S.Disposed],
  [S.Unsupported]: [S.Disposed],
  [S.Disposed]: [],
};

/** @internal */
export function runtimeToSessionState(runtime: SessionRuntime): SerialSessionState {
  return runtime.status;
}

/** @internal */
export function isValidTransition(
  from: SerialSessionState,
  to: SerialSessionState,
): boolean {
  if (from === to) {
    return false;
  }
  return ALLOWED_TRANSITIONS[from].includes(to);
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
export function createErrorRuntime(): ErrorRuntime {
  return { status: S.Error };
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
 * exposes the public `state$` stream derived from `runtime.status`.
 *
 * @internal
 */
export interface SessionRuntimeController {
  get runtime(): SessionRuntime;
  get status(): SerialSessionState;
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
    runtimeToSessionState(initial),
  );

  const transition = (next: SessionRuntime): boolean => {
    const from = runtimeToSessionState(runtime);
    const to = runtimeToSessionState(next);

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
    subject.next(to);
    return true;
  };

  return {
    get runtime() {
      return runtime;
    },
    get status() {
      return runtimeToSessionState(runtime);
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

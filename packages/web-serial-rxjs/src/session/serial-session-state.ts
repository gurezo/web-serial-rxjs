import type { SerialError } from '../errors/serial-error';

/**
 * Canonical status literals for a {@link SerialSession} lifecycle.
 *
 * Use these constants when comparing {@link SerialSessionState.status}
 * so call sites avoid string typos and get IDE completion.
 *
 * Lifecycle transitions:
 *
 * ```
 * idle -> connecting -> connected -> disconnecting -> idle
 *                                \-> error
 * (any)  -> unsupported   (when Web Serial API is unavailable)
 * (any)  -> error         (when an unrecoverable failure occurs)
 * (any)  -> disposed      (when dispose$ completes)
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/406 | Issue #406}
 */
export const SerialSessionStatus = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
  Unsupported: 'unsupported',
  Error: 'error',
  Disposed: 'disposed',
} as const;

/**
 * String union of allowed {@link SerialSessionStatus} runtime values
 * (same set as the values on the {@link SerialSessionStatus} object).
 */
export type SerialSessionStatus =
  (typeof SerialSessionStatus)[keyof typeof SerialSessionStatus];

/** @see {@link SerialSessionState} */
export interface IdleSessionState {
  readonly status: typeof SerialSessionStatus.Idle;
}

/** @see {@link SerialSessionState} */
export interface ConnectingSessionState {
  readonly status: typeof SerialSessionStatus.Connecting;
}

/** @see {@link SerialSessionState} */
export interface ConnectedSessionState {
  readonly status: typeof SerialSessionStatus.Connected;
  readonly portInfo: SerialPortInfo;
}

/** @see {@link SerialSessionState} */
export interface DisconnectingSessionState {
  readonly status: typeof SerialSessionStatus.Disconnecting;
}

/** @see {@link SerialSessionState} */
export interface UnsupportedSessionState {
  readonly status: typeof SerialSessionStatus.Unsupported;
}

/** @see {@link SerialSessionState} */
export interface ErrorSessionState {
  readonly status: typeof SerialSessionStatus.Error;
  readonly error: SerialError;
}

/** @see {@link SerialSessionState} */
export interface DisposedSessionState {
  readonly status: typeof SerialSessionStatus.Disposed;
}

/**
 * Discriminated union emitted by {@link SerialSession.state$}.
 *
 * Each variant carries the lifecycle `status` plus optional detail fields
 * (`portInfo` when connected, `error` when in a fatal error state).
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/406 | Issue #406}
 */
export type SerialSessionState =
  | IdleSessionState
  | ConnectingSessionState
  | ConnectedSessionState
  | DisconnectingSessionState
  | UnsupportedSessionState
  | ErrorSessionState
  | DisposedSessionState;

import { BehaviorSubject, Observable } from 'rxjs';
import { SerialSessionState } from './serial-session-state';

/**
 * Allowed transitions for the internal SerialSession state machine.
 *
 * Keys are the source state, values are the set of states that the source
 * is allowed to transition into. Transitions missing from this map are
 * treated as invalid and silently rejected (with a `console.warn`) so that
 * a logic bug in one sub-issue cannot corrupt `state$` for downstream
 * consumers.
 *
 * Lifecycle model (matches {@link SerialSessionState}):
 *
 * ```
 * idle -> connecting -> connected -> disconnecting -> idle
 *                                                \-> error
 * error -> idle            (reset / retry)
 * unsupported              (terminal; entered only at construction time)
 * (any) -> disposed        (permanent teardown via dispose$)
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/201 | Issue #201}
 */
const S = SerialSessionState;

const ALLOWED_TRANSITIONS: Readonly<
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

/**
 * Internal state machine that backs {@link SerialSession.state$}.
 *
 * The machine is deliberately kept as an internal module (not exported
 * from the package) because the public surface is only the Observable.
 * Sub-issues of #199 (read pump / send queue / errors) drive transitions
 * through the dedicated `to*` methods below instead of mutating a shared
 * `BehaviorSubject` directly.
 *
 * Design notes:
 *
 * - Invalid transitions are silently rejected so that the `state$` stream
 *   never emits a state that violates the lifecycle contract. A
 *   `console.warn` is emitted in development builds to aid debugging.
 * - `unsupported` is terminal: once entered (during construction when
 *   `navigator.serial` is missing), the machine refuses every further
 *   transition.
 * - `state$` is derived from a {@link BehaviorSubject} so late subscribers
 *   still receive the current state on subscription.
 *
 * @internal
 */
export class SessionStateMachine {
  private readonly subject: BehaviorSubject<SerialSessionState>;

  constructor(initial: SerialSessionState = SerialSessionState.Idle) {
    this.subject = new BehaviorSubject<SerialSessionState>(initial);
  }

  get current(): SerialSessionState {
    return this.subject.getValue();
  }

  get state$(): Observable<SerialSessionState> {
    return this.subject.asObservable();
  }

  toConnecting(): boolean {
    return this.transition(S.Connecting);
  }

  toConnected(): boolean {
    return this.transition(S.Connected);
  }

  toDisconnecting(): boolean {
    return this.transition(S.Disconnecting);
  }

  toIdle(): boolean {
    return this.transition(S.Idle);
  }

  toError(): boolean {
    return this.transition(S.Error);
  }

  toUnsupported(): boolean {
    return this.transition(S.Unsupported);
  }

  toDisposed(): boolean {
    return this.transition(S.Disposed);
  }

  complete(): void {
    this.subject.complete();
  }

  private transition(next: SerialSessionState): boolean {
    const current = this.subject.getValue();

    if (current === next) {
      return false;
    }

    const allowed = ALLOWED_TRANSITIONS[current];
    if (!allowed.includes(next)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[web-serial-rxjs] Ignoring invalid SerialSession transition ${current} -> ${next}`,
        );
      }
      return false;
    }

    this.subject.next(next);
    return true;
  }
}

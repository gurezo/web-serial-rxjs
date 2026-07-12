import {
  type ConnectedSessionState,
  type SerialSessionState,
  SerialSessionStatus,
} from './serial-session-state';

/**
 * Type predicate for {@link ConnectedSessionState}.
 *
 * Use with RxJS `filter()` to preserve discriminated union narrowing in
 * pipelines so `portInfo` and other connected-only fields stay typed.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/436 | Issue #436}
 */
export function isConnectedSessionState(
  state: SerialSessionState,
): state is ConnectedSessionState {
  return state.status === SerialSessionStatus.Connected;
}

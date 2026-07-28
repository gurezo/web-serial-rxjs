export { createSerialSession } from './create-serial-session';
export { isWebSerialSupported } from './internal/has-web-serial-support';
export type { SerialSession } from './serial-session';
export type {
  SerialSessionOptions,
  SerialSessionFeatureOptions,
  ResolvedSerialSessionOptions,
} from './serial-session-options';
export { resolveSerialSessionOptions } from './serial-session-options';
export type { SerialPayload, SerialConnectionOptions } from '../types';
export { SerialSessionStatus } from './serial-session-state';
export { isConnectedSessionState } from './is-connected-session-state';
export type {
  SerialSessionState,
  IdleSessionState,
  ConnectingSessionState,
  ConnectedSessionState,
  DisconnectingSessionState,
  UnsupportedSessionState,
  ErrorSessionState,
  DisposedSessionState,
} from './serial-session-state';
export {
  DEFAULT_LINE_BUFFER_OPTIONS,
  type LineBufferOptions,
} from './internal/line-buffer';

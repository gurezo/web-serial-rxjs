/**
 * Canonical public API allowlists for post-build dist verification (Issue #498).
 *
 * Keep in sync with:
 * - `tests/session/public-api-boundary-audit.test.ts` (source / runtime audits)
 * - `src/index.ts` when the public surface changes intentionally
 */

/** Runtime values exported from the package root barrel / dist/index.d.ts. */
export const CANONICAL_RUNTIME_EXPORTS = [
  'assertNever',
  'createSerialSession',
  'createTerminalBuffer',
  'DEFAULT_LINE_BUFFER_OPTIONS',
  'DEFAULT_TERMINAL_BUFFER_OPTIONS',
  'isConnectedSessionState',
  'isWebSerialSupported',
  'resolveSerialSessionOptions',
  'SerialError',
  'SerialErrorCode',
  'SerialSessionStatus',
];

/** Type-only exports from package root / dist/index.d.ts. */
export const CANONICAL_TYPE_EXPORTS = [
  'ConnectedSessionState',
  'ConnectingSessionState',
  'DisconnectingSessionState',
  'DisposedSessionState',
  'ErrorSessionState',
  'IdleSessionState',
  'LineBufferOptions',
  'ResolvedSerialSessionOptions',
  'SerialConnectionOptions',
  'SerialErrorCauseContext',
  'SerialErrorContextMap',
  'SerialPayload',
  'SerialSession',
  'SerialSessionFeatureOptions',
  'SerialSessionOptions',
  'SerialSessionState',
  'TerminalBuffer',
  'TerminalBufferOptions',
  'UnsupportedSessionState',
  'ValidationErrorConstraint',
  'ValidationErrorContext',
];

/** APIs removed in Phase 1 / Phase 2 that must not appear in declaration output. */
export const REMOVED_SESSION_APIS = [
  'destroy$',
  'getCurrentPort',
  'getPortInfo',
  'isBrowserSupported',
  'isConnected$',
  'portInfo$',
  'receiveReplay$',
];

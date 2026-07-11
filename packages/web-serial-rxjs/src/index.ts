/**
 * @packageDocumentation
 *
 * # web-serial-rxjs
 *
 * A TypeScript library that wraps the Web Serial API with a minimal,
 * RxJS-based session surface.
 *
 * ## Public API (v2)
 *
 * The v2 public API intentionally exposes a single, session-oriented surface
 * so that apps (Angular, Vue, React, Svelte, vanilla JS/TS) can drive their
 * UI entirely from `state$` + `isConnected$` + `receive$` + `terminalText$` + `lines$` + `errors$` without rebuilding any
 * state, read loops, or write queues themselves.
 *
 * - {@link createSerialSession} - factory for a {@link SerialSession}
 * - {@link createTerminalBuffer} - terminal-style display text from {@link SerialSession.receive$}
 * - {@link TerminalBufferOptions} - memory limits for terminal display text
 * - {@link LineBufferOptions} - memory limits for lines$ incomplete line tail
 * - {@link SerialSession} - the runtime interface
 * - {@link SerialSessionOptions} - connection options
 * - {@link SerialPayload} - payload accepted by {@link SerialSession.send$}
 * - {@link SerialConnectionOptions} - `port.open` connection parameters (excluding filters)
 * - {@link SerialSessionStatus} - lifecycle status literals for `state$.status`
 * - {@link SerialSessionState} - discriminated union emitted by `state$`
 * - {@link SerialError} / {@link SerialErrorCode} - unified error surface
 * - {@link SerialErrorContextMap} - structured metadata per error code
 *
 * ## Browser Support
 *
 * The Web Serial API is supported on **desktop** browsers only. Smartphones and
 * other mobile browsers are not supported.
 *
 * Supported desktop browsers:
 *
 * - Chrome 89+
 * - Edge 89+
 * - Opera 75+
 * - Firefox 151+
 *
 * **Safari** does not currently support the Web Serial API.
 *
 * Use {@link SerialSession.isBrowserSupported} for a synchronous feature
 * check before calling {@link SerialSession.connect$}.
 *
 * @example
 * ```typescript
 * import { createSerialSession } from '@gurezo/web-serial-rxjs';
 *
 * const session = createSerialSession({ baudRate: 115200 });
 *
 * if (!session.isBrowserSupported()) {
 *   console.error('Web Serial API is not supported in this browser');
 * } else {
 *   session.state$.subscribe((state) => console.log('state:', state));
 *   session.receive$.subscribe((chunk) => console.log('rx:', chunk));
 *   session.errors$.subscribe((error) => console.error('err:', error));
 *
 *   session.connect$().subscribe();
 *   session.send$('hello\r\n').subscribe();
 * }
 * ```
 */

export { assertNever } from './internal/assert-never';

export { createSerialSession, SerialSessionStatus, DEFAULT_LINE_BUFFER_OPTIONS, resolveSerialSessionOptions, MAX_RECEIVE_REPLAY_BUFFER_SIZE, MAX_RECEIVE_REPLAY_MAX_CHARS } from './session';
export type {
  SerialSession,
  SerialSessionState,
  SerialSessionStatus,
  IdleSessionState,
  ConnectingSessionState,
  ConnectedSessionState,
  DisconnectingSessionState,
  UnsupportedSessionState,
  ErrorSessionState,
  DisposedSessionState,
  SerialSessionOptions,
  SerialSessionReceiveReplayOptions,
  ResolvedSerialSessionOptions,
  SerialPayload,
  SerialConnectionOptions,
  LineBufferOptions,
} from './session';

export { SerialError } from './errors/serial-error';
export type { SerialErrorCauseContext, SerialErrorContextMap } from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

export { createTerminalBuffer, DEFAULT_TERMINAL_BUFFER_OPTIONS } from './terminal/create-terminal-buffer';
export type { TerminalBuffer, TerminalBufferOptions } from './terminal/create-terminal-buffer';

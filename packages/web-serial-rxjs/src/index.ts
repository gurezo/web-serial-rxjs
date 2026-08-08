/**
 * @packageDocumentation
 *
 * # web-serial-rxjs
 *
 * A TypeScript library that wraps the Web Serial API with a minimal,
 * RxJS-based session surface.
 *
 * ## Public API
 *
 * The public API exposes a single, session-oriented surface so that apps
 * (Angular, Vue, React, Svelte, vanilla JS/TS) can drive their UI from
 * `state$` (canonical lifecycle discriminated union) + `errors$` (error event
 * channel) + `receive$` + `terminalText$` + `lines$` without rebuilding state,
 * read loops, or write queues. Derive convenience booleans from `state$`
 * narrowing.
 *
 * - {@link createSerialSession} - factory for a {@link SerialSession}
 * - {@link createTerminalBuffer} - terminal-style display text from {@link SerialSession.receive$}
 * - {@link TerminalBufferOptions} - memory limits for terminal display text
 * - {@link LineBufferOptions} - memory limits for lines$ incomplete line tail
 * - {@link SerialSession} - the runtime interface
 * - {@link SerialSessionOptions} - factory options (connection + features)
 * - {@link SerialPayload} - payload accepted by {@link SerialSession.send$}
 * - {@link SerialConnectionOptions} - `port.open` connection parameters (excluding filters)
 * - {@link SerialSessionFeatureOptions} - library-specific session feature options
 * - {@link SerialSessionStatus} - lifecycle status literals for `state$.status`
 * - {@link SerialSessionState} - discriminated union emitted by `state$`
 * - {@link isConnectedSessionState} - type predicate for connected `state$` narrowing in RxJS pipelines
 * - {@link SerialError} / {@link SerialErrorCode} - unified error surface
 * - {@link SerialErrorContextMap} - structured metadata per error code
 * - {@link ValidationErrorContext} - machine-readable validation error metadata
 *
 * ## Browser Support
 *
 * Separates **Web Serial API availability** (what the browser implements) from
 * this project's **official support policy** (what we test and guarantee).
 *
 * ### Web Serial API availability
 *
 * Where `navigator.serial` exists, this library can use the Web Serial API.
 * Typical desktop availability: Chrome 89+, Edge 89+, Opera 75+, Firefox 151+.
 * **Safari** does not currently implement the Web Serial API. Many mobile
 * browsers also lack `navigator.serial`; when missing,
 * {@link isWebSerialSupported} returns `false`.
 *
 * ### Project support policy
 *
 * **Official support** covers the desktop browsers listed above. **Mobile**
 * browsers are **untested** and **out of official support**. Untested does
 * **not** mean the library rejects them — behavior is not guaranteed.
 *
 * ### {@link isWebSerialSupported}
 *
 * Synchronous **feature detection** (`navigator.serial` present) before
 * {@link SerialSession.connect$}. It is **not** a compatibility or
 * official-support guarantee. Secure context is a separate requirement.
 *
 * @example
 * ```typescript
 * import { filter } from 'rxjs';
 * import {
 *   createSerialSession,
 *   isWebSerialSupported,
 *   isConnectedSessionState,
 *   SerialSessionStatus,
 *   SerialErrorCode,
 * } from '@gurezo/web-serial-rxjs';
 *
 * const session = createSerialSession({ baudRate: 115200 });
 *
 * if (!isWebSerialSupported()) {
 *   console.error('Web Serial API is not supported in this browser');
 * } else {
 *   session.state$.subscribe((state) => {
 *     if (state.status === SerialSessionStatus.Connected) {
 *       console.log('port:', state.portInfo);
 *     }
 *   });
 *   session.state$
 *     .pipe(filter(isConnectedSessionState))
 *     .subscribe((state) => {
 *       console.log('port:', state.portInfo);
 *     });
 *   session.receive$.subscribe((chunk) => console.log('rx:', chunk));
 *   session.errors$.subscribe((error) => {
 *     if (error.is(SerialErrorCode.READ_FAILED)) {
 *       console.error(error.context.cause);
 *     }
 *   });
 *
 *   session.connect$().subscribe();
 *   session.send$('hello\r\n').subscribe();
 * }
 * ```
 */

export { assertNever } from './internal/assert-never';

export { createSerialSession, isWebSerialSupported, SerialSessionStatus, isConnectedSessionState, DEFAULT_LINE_BUFFER_OPTIONS, resolveSerialSessionOptions } from './session';
export type {
  SerialSession,
  SerialSessionState,
  IdleSessionState,
  ConnectingSessionState,
  ConnectedSessionState,
  DisconnectingSessionState,
  UnsupportedSessionState,
  ErrorSessionState,
  DisposedSessionState,
  SerialSessionOptions,
  SerialSessionFeatureOptions,
  ResolvedSerialSessionOptions,
  SerialPayload,
  SerialConnectionOptions,
  LineBufferOptions,
} from './session';

export { SerialError } from './errors/serial-error';
export type {
  SerialErrorCauseContext,
  SerialErrorContextMap,
  ValidationErrorConstraint,
  ValidationErrorContext,
} from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

export { createTerminalBuffer, DEFAULT_TERMINAL_BUFFER_OPTIONS } from './terminal/create-terminal-buffer';
export type { TerminalBuffer, TerminalBufferOptions } from './terminal/create-terminal-buffer';

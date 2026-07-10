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
 * - {@link SerialSession} - the runtime interface
 * - {@link SerialSessionOptions} - connection options
 * - {@link SerialSessionState} - `state$` payload values (const + type)
 * - {@link SerialError} / {@link SerialErrorCode} - unified error surface
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

export { createSerialSession, SerialSessionState, DEFAULT_LINE_BUFFER_OPTIONS } from './session';
export type {
  SerialSession,
  SerialSessionOptions,
  SerialSessionReceiveReplayOptions,
  LineBufferOptions,
} from './session';

export { SerialError } from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

export { createTerminalBuffer, DEFAULT_TERMINAL_BUFFER_OPTIONS } from './terminal/create-terminal-buffer';
export type { TerminalBuffer, TerminalBufferOptions } from './terminal/create-terminal-buffer';

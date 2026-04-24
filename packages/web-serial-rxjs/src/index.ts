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
 * UI entirely from `state$` + `receive$` + `errors$` without rebuilding any
 * state, read loops, or write queues themselves.
 *
 * - {@link createSerialSession} - factory for a {@link SerialSession}
 * - {@link SerialSession} - the runtime interface
 * - {@link SerialSessionOptions} - connection options
 * - {@link SerialSessionState} - `state$` payload type
 * - {@link SerialError} / {@link SerialErrorCode} - unified error surface
 *
 * ## Browser Support
 *
 * The Web Serial API is only available in Chromium-based browsers:
 *
 * - Chrome 89+
 * - Edge 89+
 * - Opera 75+
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

export { createSerialSession } from './session';
export type {
  SerialSession,
  SerialSessionOptions,
  SerialSessionState,
} from './session';

export { SerialError } from './errors/serial-error';
export { SerialErrorCode } from './errors/serial-error-code';

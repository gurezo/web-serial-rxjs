import type { Observable } from 'rxjs';
import type { SerialError } from '../errors/serial-error';
import type { SerialPayload } from '../types';
import type { SerialSessionState } from './serial-session-state';

/**
 * Public API for interacting with the Web Serial API through a
 * minimal, session-oriented surface.
 *
 * This interface is the **swappable public contract** for dependency injection
 * and test fakes. Prefer typing application code against `SerialSession` and
 * calling {@link createSerialSession} only at composition boundaries. Any
 * object that structurally matches this shape (including a hand-written fake)
 * is assignable to `SerialSession`; a separate `SerialSessionLike`-style
 * alias is intentionally not exported.
 *
 * The session is intentionally slim so that apps (Angular, Vue, React, etc.)
 * can drive their UI from `state$` (canonical lifecycle state) + `errors$`
 * (error event channel) + `receive$` + `terminalText$` + `lines$` and never
 * have to rebuild BehaviorSubjects, manage a read loop, or serialize writes
 * themselves.
 *
 * All imperative Web Serial work (open / read loop / write / close) is
 * encapsulated by the implementation. Only Observables are exposed.
 *
 * @example
 * ```typescript
 * import {
 *   createSerialSession,
 *   isWebSerialSupported,
 *   SerialSessionStatus,
 * } from '@gurezo/web-serial-rxjs';
 *
 * if (!isWebSerialSupported()) {
 *   // fallback UI
 * }
 *
 * const session = createSerialSession({ baudRate: 115200 });
 *
 * session.state$.subscribe((state) => {
 *   switch (state.status) {
 *     case SerialSessionStatus.Connected:
 *       console.log('connected:', state.portInfo);
 *       break;
 *     case SerialSessionStatus.Error:
 *       console.error('error:', state.error);
 *       break;
 *   }
 * });
 * session.receive$.subscribe((chunk) => console.log('rx:', chunk));
 * session.errors$.subscribe((error) => console.error('err:', error));
 *
 * session.connect$().subscribe();
 * session.send$('hello\r\n').subscribe();
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/203 | Issue #203}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/536 | Issue #536}
 */
export interface SerialSession {
  /**
   * Open a serial port and start the internal read pump.
   *
   * Returns an Observable that completes when the port is fully opened and
   * the read pump is running. Subscribing to `receive$` before calling
   * `connect$` is safe: emissions simply start after the pump is active.
   *
   * @returns An Observable that completes on successful connection.
   */
  connect$(): Observable<void>;

  /**
   * Close the active serial port and stop the internal read pump.
   *
   * Safe to call when already disconnected or while a disconnect is already
   * in progress. When called during `'connecting'`, cancels the in-flight
   * `connect$()` (closes any opened port) and returns the session to
   * `'idle'` without reaching `'connected'`.
   *
   * @returns An Observable that completes when the port is fully closed.
   */
  disconnect$(): Observable<void>;

  /**
   * Permanently tear down the session and complete all observables.
   *
   * Unlike {@link disconnect$}, which returns the session to `'idle'` for
   * reuse, `dispose$` closes any active connection, releases internal
   * resources, emits `'disposed'` on {@link state$}, and completes every
   * session stream. After disposal, {@link connect$} and {@link send$}
   * fail with {@link SerialErrorCode.SESSION_DISPOSED}; create a new
   * session instead of reusing this instance.
   *
   * Safe to call multiple times; subsequent calls complete immediately.
   *
   * @returns An Observable that completes when disposal has finished.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/373 | Issue #373}
   */
  dispose$(): Observable<void>;

  /**
   * Canonical lifecycle source for the session.
   *
   * Reactive session lifecycle state as a discriminated union. Replays the
   * current state on subscribe. Switch on `state.status` and use the
   * per-variant fields (`portInfo` when {@link SerialSessionStatus.Connected},
   * `error` when {@link SerialSessionStatus.Error}) instead of correlating
   * separate streams.
   */
  readonly state$: Observable<SerialSessionState>;

  /**
   * Canonical fatal / non-fatal error channel.
   *
   * All {@link SerialError} instances produced by the session (connect /
   * read / write / close) are multiplexed here. This is the main channel,
   * not a supplementary one.
   *
   * Every emission is the exact same instance that is also surfaced to
   * the relevant call-site subscriber (for example `connect$().subscribe`
   * receives the same `SerialError` that `errors$` emits for that
   * failure), so a single subscription is enough to observe the full
   * error history without double-normalisation.
   *
   * Fatal failures (connect / read / close) additionally drive `state$`
   * to `'error'` and tear down the live pump + port; non-fatal failures
   * (currently only `send$` write failures) are multiplexed here without
   * mutating `state$`, on the assumption that a real connection loss is
   * detected by the read pump on the next tick.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/204 | Issue #204}
   */
  readonly errors$: Observable<SerialError>;

  /**
   * Incoming data from the serial port as UTF-8 decoded text.
   *
   * The stream is driven by the read pump started by `connect$` and is
   * decoded internally with a streaming `TextDecoder`, so multi-byte
   * characters split across chunks are joined correctly. It is **not**
   * subscription-lazy: emissions happen regardless of whether a consumer
   * is currently subscribed, so late subscribers see only new data.
   *
   * Emits **raw decoder chunks** (not line-aligned): carriage returns and
   * other control characters from the peer are preserved. Use this for
   * terminal-like mirrors, progress output that relies on `\r`, or raw
   * inspection. Do **not** drive those UIs from {@link lines$}, which may
   * split on interior `\r` and break redraw semantics.
   *
   * For newline-framed protocols, logs, or line-by-line parsing, prefer
   * {@link lines$} or derive custom framing from `receive$`.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/273 | Issue #273}
   */
  readonly receive$: Observable<string>;

  /**
   * Terminal-display oriented cumulative text derived from {@link receive$}.
   *
   * This stream collapses carriage-return redraws (`\r`) and keeps normal
   * newline behavior (`\n`, `\r\n`) so apps can bind terminal-like output
   * directly without wrapping {@link createTerminalBuffer} in every consumer.
   * By default, retains at most 10,000 completed lines and 1,048,576
   * characters; configure via {@link SerialSessionOptions.terminalBuffer}.
   *
   * Equivalent behavior:
   *
   * ```typescript
   * createTerminalBuffer(receive$).text$
   * ```
   */
  readonly terminalText$: Observable<string>;

  /**
   * Decoded text split into **complete lines** using `\n`, `\r\n`, and
   * lone interior `\r` (see implementation). Intended for **logs**,
   * newline-framed command responses, and parsers—not for mirroring raw
   * terminal output where `\r` must be preserved for progress/redraw. For
   * rendering terminal text, prefer {@link terminalText$}.
   *
   * A trailing fragment without a line terminator is buffered until a later
   * chunk completes a line, or discarded on disconnect. The incomplete tail is
   * bounded by {@link SerialSessionOptions.lineBuffer} `maxChars` (default
   * 1,048,576); when exceeded, leading characters are discarded and a
   * non-fatal {@link SerialErrorCode.LINE_BUFFER_OVERFLOW} is emitted on
   * {@link errors$}. Pass `{ maxChars: 0 }` for unlimited growth. It is **not**
   * subscription-lazy: the same framing runs whenever the read pump is active,
   * independent of subscribers.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/273 | Issue #273}
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/371 | Issue #371}
   */
  readonly lines$: Observable<string>;

  /**
   * Enqueue data for ordered transmission.
   *
   * Writes are serialized internally through a FIFO send queue so that
   * concurrent `send$` calls are delivered to the port in **call order**,
   * regardless of how quickly each subscriber runs. String payloads are
   * UTF-8 encoded via a shared `TextEncoder`; `Uint8Array` payloads are
   * passed through unchanged. Write failures are normalized into
   * {@link SerialError} with {@link SerialErrorCode.WRITE_FAILED} and
   * multiplexed on {@link SerialSession.errors$} in addition to being
   * surfaced to the subscriber, so a single subscription is enough to
   * observe every I/O error. Calling `send$` while the session is not in
   * `'connected'` state fails fast with
   * {@link SerialErrorCode.PORT_NOT_OPEN}.
   *
   * The returned Observable completes once the enqueued payload has been
   * flushed to the underlying writer.
   *
   * @param data - Text (UTF-8 encoded) or raw bytes to send.
   * @returns An Observable that completes when the payload is written.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/203 | Issue #203}
   */
  send$(data: SerialPayload): Observable<void>;
}

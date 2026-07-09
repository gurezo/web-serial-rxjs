import type { Observable } from 'rxjs';
import type { SerialError } from '../errors/serial-error';
import type { SerialSessionState } from './serial-session-state';

/**
 * v2 public API for interacting with the Web Serial API through a
 * minimal, session-oriented surface.
 *
 * The session is intentionally slim so that apps (Angular, Vue, React, etc.)
 * can drive their UI purely from `state$` + `isConnected$` + `receive$` + `terminalText$` + `lines$` + `errors$` and never
 * have to rebuild BehaviorSubjects, manage a read loop, or serialize writes
 * themselves.
 *
 * All imperative Web Serial work (open / read loop / write / close) is
 * encapsulated by the implementation. Only Observables are exposed.
 *
 * @example
 * ```typescript
 * const session = createSerialSession({ baudRate: 115200 });
 *
 * session.state$.subscribe((state) => console.log('state:', state));
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
 */
export interface SerialSession {
  /**
   * Synchronous feature detection for the Web Serial API.
   *
   * Never throws; intended for UI branching before calling `connect$`.
   *
   * @returns `true` when `navigator.serial` is available.
   */
  isBrowserSupported(): boolean;

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
   * Reactive session lifecycle state.
   *
   * Replays the current state on subscribe. UIs should drive entirely from
   * this stream instead of reconstructing their own BehaviorSubject.
   */
  readonly state$: Observable<SerialSessionState>;

  /**
   * `true` when {@link state$} is `'connected'`, `false` for all other states.
   *
   * Derived from `state$` with `distinctUntilChanged` so UIs can bind
   * connect/disabled flags without reimplementing the comparison.
   */
  readonly isConnected$: Observable<boolean>;

  /**
   * The active port’s {@link SerialPort.getInfo} snapshot, or `null` when no
   * port is open (including {@link SerialSessionState.Idle},
   * {@link SerialSessionState.Error}, and {@link SerialSessionState.Unsupported}).
   *
   * Emits the current value on subscribe. Use with {@link state$} to know when
   * the value is valid for your UI.
   */
  readonly portInfo$: Observable<SerialPortInfo | null>;

  /**
   * Synchronous read of the last {@link portInfo$} value.
   *
   * @returns The same as {@link SerialPort.getInfo} for the open port, or
   *   `null` when not connected.
   */
  getPortInfo(): SerialPortInfo | null;

  /**
   * The underlying `SerialPort` while connected, or `null` otherwise.
   *
   * Avoid calling `port.close()` or replacing streams yourself; that conflicts
   * with session lifecycle. Prefer {@link getPortInfo} for identification.
   */
  getCurrentPort(): SerialPort | null;

  /**
   * Primary error channel.
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
   *
   * Equivalent behavior:
   *
   * ```typescript
   * createTerminalBuffer(receive$).text$
   * ```
   */
  readonly terminalText$: Observable<string>;

  /**
   * Same source data as {@link receive$} but, when
   * {@link SerialSessionOptions.receiveReplay} has `enabled: true`, it uses a
   * replay buffer **per open connection** so new subscribers can receive the
   * last N decoded text **chunks** from that connection. When receive replay
   * is off (default), this is the same hot stream as {@link receive$}.
   *
   * Does not change {@link lines$} (line framing is not replayed here).
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/265 | Issue #265}
   */
  readonly receiveReplay$: Observable<string>;

  /**
   * Decoded text split into **complete lines** using `\n`, `\r\n`, and
   * lone interior `\r` (see implementation). Intended for **logs**,
   * newline-framed command responses, and parsers—not for mirroring raw
   * terminal output where `\r` must be preserved for progress/redraw. For
   * rendering terminal text, prefer {@link terminalText$}.
   *
   * A trailing fragment without a line terminator is buffered until a later
   * chunk completes a line, or discarded on disconnect. It is **not**
   * subscription-lazy: the same framing runs whenever the read pump is active,
   * independent of subscribers.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/273 | Issue #273}
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
  send$(data: string | Uint8Array): Observable<void>;
}

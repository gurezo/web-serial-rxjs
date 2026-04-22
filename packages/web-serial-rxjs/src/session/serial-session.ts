import type { Observable } from 'rxjs';
import type { SerialError } from '../errors/serial-error';
import type { SerialSessionState } from './serial-session-state';

/**
 * v2 public API for interacting with the Web Serial API through a
 * minimal, session-oriented surface.
 *
 * The session is intentionally slim so that apps (Angular, Vue, React, etc.)
 * can drive their UI purely from `state$` + `receive$` + `errors$` and never
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
   * Safe to call when already disconnected.
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
   * Primary error channel.
   *
   * All {@link SerialError} instances produced by the session (connect /
   * read / write / close) are multiplexed here. This is the main channel,
   * not a supplementary one.
   */
  readonly errors$: Observable<SerialError>;

  /**
   * Incoming data from the serial port.
   *
   * The stream is driven by the read pump started by `connect$`. It is
   * **not** subscription-lazy: emissions happen regardless of whether a
   * consumer is currently subscribed, so late subscribers see only new data.
   */
  readonly receive$: Observable<string | Uint8Array>;

  /**
   * Enqueue data for ordered transmission.
   *
   * Writes are serialized internally so that concurrent `send$` calls are
   * delivered to the port in call order. The returned Observable completes
   * once the enqueued payload has been flushed.
   *
   * @param data - Text (UTF-8 encoded) or raw bytes to send.
   * @returns An Observable that completes when the payload is written.
   */
  send$(data: string | Uint8Array): Observable<void>;
}

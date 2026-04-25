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
   * `true` when {@link state$} is `'connected'`, `false` for all other states.
   *
   * Derived from `state$` with `distinctUntilChanged` so UIs can bind
   * connect/disabled flags without reimplementing the comparison.
   */
  readonly isConnected$: Observable<boolean>;

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
   */
  readonly receive$: Observable<string>;

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

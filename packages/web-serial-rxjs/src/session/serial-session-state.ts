/**
 * Reactive lifecycle state for a {@link SerialSession}.
 *
 * This is the v2 API counterpart of the legacy `SerialState` used by
 * `SerialClient`. It is expressed as a flat string union so that consumers
 * (Angular, Vue, React, etc.) can drive their UI from `state$` directly
 * without unwrapping discriminator fields.
 *
 * Lifecycle transitions:
 *
 * ```
 * idle -> connecting -> connected -> disconnecting -> idle
 *                                \-> error
 * (any)  -> unsupported   (when Web Serial API is unavailable)
 * (any)  -> error         (when an unrecoverable failure occurs)
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 */
export type SerialSessionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'unsupported'
  | 'error';

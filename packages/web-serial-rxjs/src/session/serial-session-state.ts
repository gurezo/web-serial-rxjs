/**
 * Reactive lifecycle state for a {@link SerialSession}.
 *
 * This is the v2 API counterpart of the legacy `SerialState` used by
 * `SerialClient`. The runtime values are the same flat strings v1
 * consumers used for UI switches; the {@link SerialSessionState} const
 * object is the canonical source of those literals so call sites can
 * avoid string typos and get IDE completion.
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
export const SerialSessionState = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
  Unsupported: 'unsupported',
  Error: 'error',
} as const;

/**
 * String union of allowed {@link SerialSessionState} runtime values
 * (same set as the values on the {@link SerialSessionState} object).
 */
export type SerialSessionState =
  (typeof SerialSessionState)[keyof typeof SerialSessionState];

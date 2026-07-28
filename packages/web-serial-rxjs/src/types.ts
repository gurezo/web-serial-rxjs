/**
 * Payload accepted by {@link SerialSession.send$}.
 *
 * Strings are UTF-8 encoded via a shared `TextEncoder`; `Uint8Array` values
 * are passed through unchanged.
 */
export type SerialPayload = string | Uint8Array;

/**
 * Connection parameters passed to `port.open` when opening a serial port.
 *
 * Derived from the W3C {@link SerialOptions} type. Excludes
 * {@link SerialSessionOptions.filters}, which apply only to
 * `navigator.serial.requestPort`.
 *
 * At session factory time, `baudRate` and `bufferSize` must be safe integers
 * `> 0` (or omitted to use defaults). `0`, negatives, non-integers, `NaN`, and
 * `Infinity` are rejected.
 *
 * @see {@link SerialOptions}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/488 | Issue #488}
 */
export type SerialConnectionOptions = Pick<
  SerialOptions,
  'baudRate' | 'dataBits' | 'stopBits' | 'parity' | 'bufferSize' | 'flowControl'
>;

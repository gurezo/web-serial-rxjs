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
 * @see {@link SerialOptions}
 */
export type SerialConnectionOptions = Pick<
  SerialOptions,
  'baudRate' | 'dataBits' | 'stopBits' | 'parity' | 'bufferSize' | 'flowControl'
>;

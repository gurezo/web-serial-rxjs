import type { SerialSessionOptions } from './session/serial-session-options';

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
 * Excludes {@link SerialSessionOptions.filters}, which apply only to
 * `navigator.serial.requestPort`.
 */
export type SerialConnectionOptions = Pick<
  SerialSessionOptions,
  'baudRate' | 'dataBits' | 'stopBits' | 'parity' | 'bufferSize' | 'flowControl'
>;

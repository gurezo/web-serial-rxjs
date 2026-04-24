/**
 * Options for creating a {@link SerialSession} via {@link createSerialSession}.
 *
 * These options configure the serial port connection parameters used when
 * calling `port.open` and `navigator.serial.requestPort`. All properties
 * are optional; omitted fields fall back to {@link DEFAULT_SERIAL_SESSION_OPTIONS}.
 *
 * @example
 * ```typescript
 * const session = createSerialSession({
 *   baudRate: 115200,
 *   dataBits: 8,
 *   stopBits: 1,
 *   parity: 'none',
 *   flowControl: 'none',
 *   filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
 * });
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 */
export interface SerialSessionOptions {
  /**
   * Baud rate for the serial port connection (bits per second).
   *
   * Common values include 9600, 19200, 38400, 57600, 115200, etc.
   * Must match the baud rate configured on the connected device.
   *
   * @default 9600
   */
  baudRate?: number;

  /**
   * Number of data bits per character (7 or 8).
   *
   * @default 8
   */
  dataBits?: 7 | 8;

  /**
   * Number of stop bits (1 or 2).
   *
   * @default 1
   */
  stopBits?: 1 | 2;

  /**
   * Parity checking mode.
   *
   * @default 'none'
   */
  parity?: 'none' | 'even' | 'odd';

  /**
   * Buffer size for the underlying read stream, in bytes.
   *
   * @default 255
   */
  bufferSize?: number;

  /**
   * Flow control mode.
   *
   * @default 'none'
   */
  flowControl?: 'none' | 'hardware';

  /**
   * Filters for port selection when requesting a port.
   *
   * When specified, the port selection dialog will only show devices
   * matching these filters. Each filter can specify `usbVendorId` and/or
   * `usbProductId`.
   */
  filters?: SerialPortFilter[];
}

/**
 * Default values applied to omitted {@link SerialSessionOptions} fields.
 *
 * @internal
 */
export const DEFAULT_SERIAL_SESSION_OPTIONS: Required<
  Omit<SerialSessionOptions, 'filters'>
> & { filters?: SerialPortFilter[] } = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,
  flowControl: 'none',
  filters: undefined,
};

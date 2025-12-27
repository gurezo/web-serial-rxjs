/**
 * Options for creating a SerialClient instance.
 *
 * These options configure the serial port connection parameters. All properties are optional
 * and will use default values if not specified. See {@link DEFAULT_SERIAL_CLIENT_OPTIONS} for
 * the default values used.
 *
 * @example
 * ```typescript
 * const client = createSerialClient({
 *   baudRate: 115200,
 *   dataBits: 8,
 *   stopBits: 1,
 *   parity: 'none',
 *   flowControl: 'none',
 *   filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
 * });
 * ```
 */
export interface SerialClientOptions {
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
   * - `7`: Seven data bits (used with parity)
   * - `8`: Eight data bits (most common, used without parity)
   *
   * @default 8
   */
  dataBits?: 7 | 8;

  /**
   * Number of stop bits (1 or 2).
   *
   * - `1`: One stop bit (most common)
   * - `2`: Two stop bits (less common, used for slower devices)
   *
   * @default 1
   */
  stopBits?: 1 | 2;

  /**
   * Parity checking mode.
   *
   * - `'none'`: No parity checking (most common)
   * - `'even'`: Even parity
   * - `'odd'`: Odd parity
   *
   * @default 'none'
   */
  parity?: 'none' | 'even' | 'odd';

  /**
   * Buffer size for reading data from the serial port, in bytes.
   *
   * This determines how much data can be buffered before it needs to be read.
   * Larger buffers can improve performance but use more memory.
   *
   * @default 255
   */
  bufferSize?: number;

  /**
   * Flow control mode.
   *
   * - `'none'`: No flow control (most common)
   * - `'hardware'`: Hardware flow control (RTS/CTS)
   *
   * @default 'none'
   */
  flowControl?: 'none' | 'hardware';

  /**
   * Filters for port selection when requesting a port.
   *
   * When specified, the port selection dialog will only show devices matching
   * these filters. Each filter can specify `usbVendorId` and/or `usbProductId`
   * to filter by USB device identifiers.
   *
   * @example
   * ```typescript
   * filters: [
   *   { usbVendorId: 0x1234 },
   *   { usbVendorId: 0x1234, usbProductId: 0x5678 },
   * ]
   * ```
   *
   * @see {@link SerialPortFilter} for the filter structure
   */
  filters?: SerialPortFilter[];
}

/**
 * Default options for SerialClient instances.
 *
 * These are the default values used when creating a SerialClient if no options
 * are provided or if specific options are omitted. The values are chosen to work
 * with most common serial devices.
 *
 * @see {@link SerialClientOptions} for details on each option
 */
export const DEFAULT_SERIAL_CLIENT_OPTIONS: Required<
  Omit<SerialClientOptions, 'filters'>
> & { filters?: SerialPortFilter[] } = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,
  flowControl: 'none',
  filters: undefined,
};

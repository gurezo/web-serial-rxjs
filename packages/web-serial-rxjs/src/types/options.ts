/**
 * Options for creating a SerialClient instance
 */
export interface SerialClientOptions {
  /**
   * Baud rate for the serial port connection
   * @default 9600
   */
  baudRate?: number;

  /**
   * Data bits (7 or 8)
   * @default 8
   */
  dataBits?: 7 | 8;

  /**
   * Stop bits (1 or 2)
   * @default 1
   */
  stopBits?: 1 | 2;

  /**
   * Parity ('none', 'even', or 'odd')
   * @default 'none'
   */
  parity?: 'none' | 'even' | 'odd';

  /**
   * Buffer size for reading
   * @default 255
   */
  bufferSize?: number;

  /**
   * Flow control ('none' or 'hardware')
   * @default 'none'
   */
  flowControl?: 'none' | 'hardware';

  /**
   * Filters for port selection
   */
  filters?: SerialPortFilter[];
}

/**
 * Default options for SerialClient
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

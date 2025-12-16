/**
 * Serial error codes
 */
export enum SerialErrorCode {
  /** Browser does not support Web Serial API */
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',
  /** Serial port is not available */
  PORT_NOT_AVAILABLE = 'PORT_NOT_AVAILABLE',
  /** Failed to open serial port */
  PORT_OPEN_FAILED = 'PORT_OPEN_FAILED',
  /** Serial port is already open */
  PORT_ALREADY_OPEN = 'PORT_ALREADY_OPEN',
  /** Serial port is not open */
  PORT_NOT_OPEN = 'PORT_NOT_OPEN',
  /** Failed to read from serial port */
  READ_FAILED = 'READ_FAILED',
  /** Failed to write to serial port */
  WRITE_FAILED = 'WRITE_FAILED',
  /** Serial port connection lost */
  CONNECTION_LOST = 'CONNECTION_LOST',
  /** Invalid filter options */
  INVALID_FILTER_OPTIONS = 'INVALID_FILTER_OPTIONS',
  /** Operation was cancelled */
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

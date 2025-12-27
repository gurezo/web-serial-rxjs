/**
 * Error codes for serial port operations.
 *
 * These codes identify specific error conditions that can occur when working with
 * serial ports. Each error code corresponds to a specific failure scenario, making
 * it easier to handle errors programmatically.
 *
 * @example
 * ```typescript
 * try {
 *   await client.connect().toPromise();
 * } catch (error) {
 *   if (error instanceof SerialError) {
 *     switch (error.code) {
 *       case SerialErrorCode.BROWSER_NOT_SUPPORTED:
 *         console.error('Please use a Chromium-based browser');
 *         break;
 *       case SerialErrorCode.OPERATION_CANCELLED:
 *         console.log('User cancelled port selection');
 *         break;
 *       // ... handle other error codes
 *     }
 *   }
 * }
 * ```
 */
export enum SerialErrorCode {
  /**
   * Browser does not support the Web Serial API.
   *
   * This error occurs when attempting to use serial port functionality in a browser
   * that doesn't support the Web Serial API. Only Chromium-based browsers (Chrome,
   * Edge, Opera) support this API.
   *
   * **Suggested action**: Inform the user to use a supported browser.
   */
  BROWSER_NOT_SUPPORTED = 'BROWSER_NOT_SUPPORTED',

  /**
   * Serial port is not available.
   *
   * This error occurs when a requested port cannot be accessed, such as when
   * getting previously granted ports fails or when the port is already in use
   * by another application.
   *
   * **Suggested action**: Check if the port is available or being used by another application.
   */
  PORT_NOT_AVAILABLE = 'PORT_NOT_AVAILABLE',

  /**
   * Failed to open the serial port.
   *
   * This error occurs when the port cannot be opened, typically due to incorrect
   * connection parameters, hardware issues, or permission problems.
   *
   * **Suggested action**: Verify connection parameters and check hardware connections.
   */
  PORT_OPEN_FAILED = 'PORT_OPEN_FAILED',

  /**
   * Serial port is already open.
   *
   * This error occurs when attempting to open a port that is already connected.
   * Only one connection can be active at a time per SerialClient instance.
   *
   * **Suggested action**: Disconnect the current port before connecting a new one.
   */
  PORT_ALREADY_OPEN = 'PORT_ALREADY_OPEN',

  /**
   * Serial port is not open.
   *
   * This error occurs when attempting to read from or write to a port that hasn't
   * been opened yet. The port must be connected before performing I/O operations.
   *
   * **Suggested action**: Call {@link SerialClient.connect} before reading or writing.
   */
  PORT_NOT_OPEN = 'PORT_NOT_OPEN',

  /**
   * Failed to read from the serial port.
   *
   * This error occurs when reading data from the port fails, typically due to
   * connection loss, hardware issues, or stream errors.
   *
   * **Suggested action**: Check the connection and hardware, then retry the read operation.
   */
  READ_FAILED = 'READ_FAILED',

  /**
   * Failed to write to the serial port.
   *
   * This error occurs when writing data to the port fails, typically due to
   * connection loss, hardware issues, or stream errors.
   *
   * **Suggested action**: Check the connection and hardware, then retry the write operation.
   */
  WRITE_FAILED = 'WRITE_FAILED',

  /**
   * Serial port connection was lost.
   *
   * This error occurs when the connection to the serial port is unexpectedly
   * terminated, such as when the device is disconnected or the port is closed
   * by another process.
   *
   * **Suggested action**: Check the physical connection and reconnect if needed.
   */
  CONNECTION_LOST = 'CONNECTION_LOST',

  /**
   * Invalid filter options provided.
   *
   * This error occurs when port filter options are invalid, such as when
   * filter values are out of range or missing required fields.
   *
   * **Suggested action**: Verify filter options match the expected format and value ranges.
   */
  INVALID_FILTER_OPTIONS = 'INVALID_FILTER_OPTIONS',

  /**
   * Operation was cancelled by the user.
   *
   * This error occurs when the user cancels a port selection dialog or aborts
   * an operation before it completes.
   *
   * **Suggested action**: This is a normal condition - no action required, but you may want
   * to inform the user that the operation was cancelled.
   */
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',

  /**
   * Unknown error occurred.
   *
   * This error code is used for errors that don't fit into any other category.
   * The original error details may be available in the error's message or originalError property.
   *
   * **Suggested action**: Check the error message and originalError for more details.
   */
  UNKNOWN = 'UNKNOWN',
}

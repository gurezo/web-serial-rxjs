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
 *         console.error('Please use a supported desktop browser (Chrome, Edge, Opera, or Firefox 151+)');
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
export const SerialErrorCode = {
  /**
   * Browser does not support the Web Serial API.
   *
   * This error occurs when attempting to use serial port functionality in a browser
   * that doesn't support the Web Serial API. Supported desktop browsers are Chrome,
   * Edge, Opera, and Firefox 151+. Safari and mobile browsers are not supported.
   *
   * **Suggested action**: Inform the user to use a supported browser.
   */
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',

  /**
   * Serial port is not available.
   *
   * This error occurs when a requested port cannot be accessed, such as when
   * getting previously granted ports fails or when the port is already in use
   * by another application.
   *
   * **Suggested action**: Check if the port is available or being used by another application.
   */
  PORT_NOT_AVAILABLE: 'PORT_NOT_AVAILABLE',

  /**
   * Failed to open the serial port.
   *
   * This error occurs when the port cannot be opened, typically due to incorrect
   * connection parameters, hardware issues, or permission problems.
   *
   * **Suggested action**: Verify connection parameters and check hardware connections.
   */
  PORT_OPEN_FAILED: 'PORT_OPEN_FAILED',

  /**
   * Serial port is already open.
   *
   * This error occurs when attempting to open a port that is already connected.
   * Only one connection can be active at a time per SerialClient instance.
   *
   * **Suggested action**: Disconnect the current port before connecting a new one.
   */
  PORT_ALREADY_OPEN: 'PORT_ALREADY_OPEN',

  /**
   * Serial port is not open.
   *
   * This error occurs when attempting to read from or write to a port that hasn't
   * been opened yet. The port must be connected before performing I/O operations.
   *
   * **Suggested action**: Call {@link SerialClient.connect} before reading or writing.
   */
  PORT_NOT_OPEN: 'PORT_NOT_OPEN',

  /**
   * Failed to read from the serial port.
   *
   * This error occurs when reading data from the port fails, typically due to
   * connection loss, hardware issues, or stream errors.
   *
   * **Suggested action**: Check the connection and hardware, then retry the read operation.
   */
  READ_FAILED: 'READ_FAILED',

  /**
   * Failed to write to the serial port.
   *
   * This error occurs when writing data to the port fails, typically due to
   * connection loss, hardware issues, or stream errors.
   *
   * **Suggested action**: Check the connection and hardware, then retry the write operation.
   */
  WRITE_FAILED: 'WRITE_FAILED',

  /**
   * Serial port connection was lost.
   *
   * This error occurs when the connection to the serial port is unexpectedly
   * terminated, such as when the device is disconnected or the port is closed
   * by another process.
   *
   * **Suggested action**: Check the physical connection and reconnect if needed.
   */
  CONNECTION_LOST: 'CONNECTION_LOST',

  /**
   * Invalid filter options provided.
   *
   * This error occurs when port filter options are invalid, such as when
   * filter values are out of range or missing required fields.
   *
   * **Suggested action**: Verify filter options match the expected format and value ranges.
   */
  INVALID_FILTER_OPTIONS: 'INVALID_FILTER_OPTIONS',

  /**
   * Operation was cancelled by the user.
   *
   * This error occurs when the user cancels a port selection dialog or aborts
   * an operation before it completes.
   *
   * **Suggested action**: This is a normal condition - no action required, but you may want
   * to inform the user that the operation was cancelled.
   */
  OPERATION_CANCELLED: 'OPERATION_CANCELLED',

  /**
   * Operation timed out before completion.
   *
   * This error occurs when an operation waits for a condition (for example, prompt
   * detection) and the timeout period elapses first.
   */
  OPERATION_TIMEOUT: 'OPERATION_TIMEOUT',

  /**
   * Internal line buffer exceeded its configured size limit.
   *
   * This error occurs when the incomplete line tail held by the {@link SerialSession.lines$}
   * framing buffer grows beyond {@link SerialSessionOptions.lineBuffer} `maxChars`.
   * Leading characters are discarded to bound memory; the session remains connected.
   *
   * **Suggested action**: Increase `lineBuffer.maxChars`, handle framing on `receive$`,
   * or ensure the device sends line terminators.
   */
  LINE_BUFFER_OVERFLOW: 'LINE_BUFFER_OVERFLOW',

  /**
   * Invalid receive replay options provided.
   *
   * This error occurs when {@link SerialSessionOptions.receiveReplay} values are
   * out of range, such as a non-integer `bufferSize` or `maxChars`.
   *
   * **Suggested action**: Verify `receiveReplay` options match the documented
   * ranges and value types.
   */
  INVALID_RECEIVE_REPLAY_OPTIONS: 'INVALID_RECEIVE_REPLAY_OPTIONS',

  /**
   * Invalid terminal buffer options provided.
   *
   * This error occurs when {@link SerialSessionOptions.terminalBuffer} values are
   * out of range, such as a negative or non-integer `maxLines` or `maxChars`.
   *
   * **Suggested action**: Verify `terminalBuffer` options match the documented
   * ranges and value types.
   */
  INVALID_TERMINAL_BUFFER_OPTIONS: 'INVALID_TERMINAL_BUFFER_OPTIONS',

  /**
   * Invalid line buffer options provided.
   *
   * This error occurs when {@link SerialSessionOptions.lineBuffer} values are
   * out of range, such as a negative or non-integer `maxChars`.
   *
   * **Suggested action**: Verify `lineBuffer` options match the documented
   * ranges and value types.
   */
  INVALID_LINE_BUFFER_OPTIONS: 'INVALID_LINE_BUFFER_OPTIONS',

  /**
   * Invalid connection options provided.
   *
   * This error occurs when connection fields such as `baudRate` are out of
   * range at session creation time.
   *
   * **Suggested action**: Verify connection options match the documented
   * ranges and value types.
   */
  INVALID_CONNECTION_OPTIONS: 'INVALID_CONNECTION_OPTIONS',

  /**
   * Receive replay buffer exceeded its configured character limit.
   *
   * This error occurs when buffered chunks on {@link SerialSession.receiveReplay$}
   * exceed {@link SerialSessionOptions.receiveReplay} `maxChars`. Oldest chunks
   * are discarded to bound memory; the session remains connected.
   *
   * **Suggested action**: Increase `receiveReplay.maxChars`, reduce chunk size at
   * the source, or subscribe earlier to avoid relying on a large replay buffer.
   */
  RECEIVE_REPLAY_BUFFER_OVERFLOW: 'RECEIVE_REPLAY_BUFFER_OVERFLOW',

  /**
   * Session has been disposed and can no longer be used.
   *
   * This error occurs when calling {@link SerialSession.connect$} or
   * {@link SerialSession.send$} after {@link SerialSession.dispose$} has
   * completed. Create a new session instead of reusing a disposed instance.
   *
   * **Suggested action**: Call {@link SerialSession.dispose$} only when
   * permanently tearing down a session, then create a new one if needed.
   */
  SESSION_DISPOSED: 'SESSION_DISPOSED',

  /**
   * Unknown error occurred.
   *
   * This error code is used for errors that don't fit into any other category.
   * The original error details may be available in the error's message or
   * {@link SerialError.context | context.cause} property.
   *
   * **Suggested action**: Check the error message and `context.cause` for more details.
   */
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * String union of allowed {@link SerialErrorCode} runtime values
 * (same set as the values on the {@link SerialErrorCode} object).
 */
export type SerialErrorCode =
  (typeof SerialErrorCode)[keyof typeof SerialErrorCode];

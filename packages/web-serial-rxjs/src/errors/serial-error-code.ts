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
   * Emitted on `connect$` when `navigator.serial` is unavailable.
   *
   * **Suggested action**: Inform the user to use a supported browser.
   *
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/438 | Issue #438}
   */
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',

  /**
   * Serial port is not available.
   *
   * **Reserved — not emitted in v3.x.** The current implementation uses only
   * `navigator.serial.requestPort`; there is no `getPorts` API path. Scheduled
   * for removal in the next major version.
   *
   * **Suggested action**: Handle port acquisition failures with
   * {@link SerialErrorCode.PORT_OPEN_FAILED} or
   * {@link SerialErrorCode.OPERATION_CANCELLED} instead.
   *
   * @deprecated Not emitted at runtime in v3.x. Will be removed in the next major version.
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/438 | Issue #438}
   */
  PORT_NOT_AVAILABLE: 'PORT_NOT_AVAILABLE',

  /**
   * Failed to open the serial port.
   *
   * Emitted on `connect$` when `port.open()` rejects.
   *
   * **Suggested action**: Verify connection parameters and check hardware connections.
   */
  PORT_OPEN_FAILED: 'PORT_OPEN_FAILED',

  /**
   * Serial port is already open.
   *
   * Emitted on `connect$` when the session is not in `'idle'` or `'error'`
   * (non-fatal; session state is unchanged).
   *
   * **Suggested action**: Disconnect the current port before connecting a new one.
   */
  PORT_ALREADY_OPEN: 'PORT_ALREADY_OPEN',

  /**
   * Serial port is not open.
   *
   * Emitted when `send$` or `disconnect$` is called in an invalid session
   * state (for example before `connect$` completes).
   *
   * **Suggested action**: Call {@link SerialSession.connect$} before sending data.
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
   * **Reserved — not emitted in v3.x.** No timeout / prompt detection /
   * transaction API exists yet. Scheduled for removal in the next major version
   * unless a future API adopts this code.
   *
   * @deprecated Not emitted at runtime in v3.x. Will be removed in the next major version.
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/438 | Issue #438}
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
   * Emitted as a fallback when dispose or disconnect encounters an error that
   * cannot be classified more specifically. The underlying failure is on
   * {@link SerialError.context | context.cause}.
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

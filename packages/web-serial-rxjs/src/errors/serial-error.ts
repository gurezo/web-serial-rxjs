import { SerialErrorCode } from './serial-error-code';

// Re-export SerialErrorCode for convenience
export { SerialErrorCode };

/**
 * Custom error class for serial port operations.
 *
 * This error class extends the standard Error class and includes additional information
 * about the type of error that occurred. It provides an error code for programmatic
 * error handling and may include the original error that caused the failure.
 *
 * @example
 * ```typescript
 * try {
 *   await client.connect().toPromise();
 * } catch (error) {
 *   if (error instanceof SerialError) {
 *     console.error(`Error code: ${error.code}`);
 *     console.error(`Message: ${error.message}`);
 *     if (error.originalError) {
 *       console.error(`Original error:`, error.originalError);
 *     }
 *
 *     // Check specific error code
 *     if (error.is(SerialErrorCode.BROWSER_NOT_SUPPORTED)) {
 *       // Handle browser not supported
 *     }
 *   }
 * }
 * ```
 */
export class SerialError extends Error {
  /**
   * The error code identifying the type of error that occurred.
   *
   * Use this code to programmatically handle specific error conditions.
   *
   * @see {@link SerialErrorCode} for all available error codes
   */
  public readonly code: SerialErrorCode;

  /**
   * The original error that caused this SerialError, if available.
   *
   * This property contains the underlying error (e.g., DOMException, TypeError)
   * that was wrapped in this SerialError. It may be undefined if no original error exists.
   */
  public readonly originalError?: Error;

  /**
   * Creates a new SerialError instance.
   *
   * @param code - The error code identifying the type of error
   * @param message - A human-readable error message
   * @param originalError - The original error that caused this SerialError, if any
   */
  constructor(code: SerialErrorCode, message: string, originalError?: Error) {
    super(message);
    this.name = 'SerialError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((Error as any).captureStackTrace) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Error as any).captureStackTrace(this, SerialError);
    }
  }

  /**
   * Check if the error matches a specific error code.
   *
   * This is a convenience method for checking the error code without directly
   * comparing the code property.
   *
   * @param code - The error code to check against
   * @returns `true` if this error's code matches the provided code, `false` otherwise
   *
   * @example
   * ```typescript
   * if (error.is(SerialErrorCode.PORT_NOT_OPEN)) {
   *   // Handle port not open error
   * }
   * ```
   */
  public is(code: SerialErrorCode): boolean {
    return this.code === code;
  }
}

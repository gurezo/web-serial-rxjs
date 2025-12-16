import { SerialErrorCode } from './serial-error-code';

// Re-export SerialErrorCode for convenience
export { SerialErrorCode };

/**
 * Custom error class for serial port operations
 */
export class SerialError extends Error {
  public readonly code: SerialErrorCode;
  public readonly originalError?: Error;

  constructor(code: SerialErrorCode, message: string, originalError?: Error) {
    super(message);
    this.name = 'SerialError';
    this.code = code;
    this.originalError = originalError;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, SerialError);
    }
  }

  /**
   * Check if the error is a specific error code
   */
  public is(code: SerialErrorCode): boolean {
    return this.code === code;
  }
}

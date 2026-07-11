import { SerialErrorCode } from './serial-error-code';
import {
  isCauseContextCode,
  type SerialErrorCauseContext,
  type SerialErrorContextMap,
} from './serial-error-context';

// Re-export SerialErrorCode for convenience
export { SerialErrorCode };
export type { SerialErrorCauseContext, SerialErrorContextMap };

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
 *     if (error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)) {
 *       console.error(`maxChars: ${error.context.maxChars}`);
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
export class SerialError<
  TCode extends SerialErrorCode = SerialErrorCode,
> extends Error {
  /**
   * The error code identifying the type of error that occurred.
   *
   * Use this code to programmatically handle specific error conditions.
   *
   * @see {@link SerialErrorCode} for all available error codes
   */
  public readonly code: TCode;

  /**
   * Structured metadata associated with {@link code}.
   *
   * When {@link is} returns `true`, TypeScript narrows this property to the
   * context shape defined in {@link SerialErrorContextMap} for that code.
   */
  public readonly context: SerialErrorContextMap[TCode];

  /**
   * The original error that caused this SerialError, if available.
   *
   * This property contains the underlying error (e.g., DOMException, TypeError)
   * that was wrapped in this SerialError. It may be undefined if no original error exists.
   *
   * @deprecated Prefer {@link context} for cause-bearing codes. This property is
   *   retained for backward compatibility and is kept in sync when a cause is
   *   provided.
   */
  public readonly originalError?: Error;

  /**
   * Creates a new SerialError instance.
   *
   * @param code - The error code identifying the type of error
   * @param message - A human-readable error message
   * @param originalError - The original error that caused this SerialError, if any
   * @param context - Structured metadata for the error code. When omitted, cause-bearing
   *   codes derive `{ cause }` from `originalError`.
   */
  constructor(
    code: TCode,
    message: string,
    originalError?: Error,
    context?: SerialErrorContextMap[TCode],
  ) {
    super(message);
    this.name = 'SerialError';
    this.code = code;
    if (originalError !== undefined) {
      this.originalError = originalError;
    }

    if (context !== undefined) {
      this.context = context;
    } else if (
      originalError !== undefined &&
      isCauseContextCode(code)
    ) {
      this.context = { cause: originalError } as SerialErrorContextMap[TCode];
    } else {
      this.context = undefined as SerialErrorContextMap[TCode];
    }

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
   * comparing the code property. When this method returns `true`, TypeScript
   * narrows `this.code` and `this.context` to the shapes defined for the
   * provided `code` argument.
   *
   * @param code - The error code to check against
   * @returns Type predicate: `true` if this error's code matches the provided
   *   code (and `this.code` / `this.context` are narrowed), `false` otherwise
   *
   * @example
   * ```typescript
   * if (error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)) {
   *   // error.code and error.context.maxChars are narrowed
   * }
   * ```
   */
  public is<C extends SerialErrorCode>(
    code: C,
  ): this is SerialError<C> {
    return (this.code as SerialErrorCode) === code;
  }
}

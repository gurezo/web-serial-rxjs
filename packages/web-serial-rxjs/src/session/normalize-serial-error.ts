import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';

/**
 * Default human-readable prefix attached to normalized errors when the
 * caller does not supply one. Kept short so downstream messages remain
 * readable (e.g. `"Serial operation failed: <cause>"`).
 *
 * @internal
 */
const DEFAULT_MESSAGE_PREFIX = 'Serial operation failed';

/**
 * Options accepted by {@link normalizeSerialError}.
 *
 * @internal
 */
export interface NormalizeSerialErrorOptions {
  /**
   * Error code assigned when the input cannot be classified more
   * specifically (for example a generic `Error` thrown from `port.open`).
   *
   * Most call sites in the session pipeline know which lifecycle phase
   * they are in (connect / read / write / close) and therefore pick a
   * phase-specific fallback such as {@link SerialErrorCode.PORT_OPEN_FAILED}
   * or {@link SerialErrorCode.WRITE_FAILED}.
   */
  fallbackCode: SerialErrorCode;
  /**
   * Prefix used when the input has to be wrapped. Ignored when the input
   * is already a {@link SerialError} so we never rewrite a well-formed
   * message the caller has already chosen.
   */
  messagePrefix?: string;
}

const isDomExceptionWithName = (
  error: unknown,
  name: string,
): error is DOMException =>
  typeof DOMException !== 'undefined' &&
  error instanceof DOMException &&
  error.name === name;

/**
 * Normalize an arbitrary thrown value into a {@link SerialError}.
 *
 * This helper is the single entry point used by every v2 session
 * component (session factory, read pump, send queue) to coerce raw
 * platform errors into the library's error type. Centralising the
 * mapping here satisfies Issue #204's completion criterion that
 * "error handling lives in one place" and removes the duplicated
 * `toError` / `normalizeError` helpers previously scattered across
 * session modules.
 *
 * Mapping rules applied, in order:
 *
 * 1. `SerialError` instances pass through unchanged so a caller that has
 *    already classified the failure (e.g. `PORT_NOT_OPEN` on a pre-open
 *    `send$`) is not rewrapped.
 * 2. `DOMException('NotFoundError')` is mapped to
 *    {@link SerialErrorCode.OPERATION_CANCELLED}. Chromium raises this
 *    when the user dismisses the `requestPort` dialog; it is a normal
 *    control-flow event, not a hard failure.
 * 3. Any other value is wrapped as a {@link SerialError} with
 *    {@link NormalizeSerialErrorOptions.fallbackCode}, preserving the
 *    underlying failure on {@link SerialError.context | context.cause}.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/204 | Issue #204}
 */
export function normalizeSerialError(
  error: unknown,
  options: NormalizeSerialErrorOptions,
): SerialError {
  if (error instanceof SerialError) {
    return error;
  }

  const prefix = options.messagePrefix ?? DEFAULT_MESSAGE_PREFIX;

  if (isDomExceptionWithName(error, 'NotFoundError')) {
    return new SerialError(
      SerialErrorCode.OPERATION_CANCELLED,
      'Port selection was cancelled by the user',
      undefined,
      { cause: error },
    );
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  return new SerialError(
    options.fallbackCode,
    `${prefix}: ${cause.message}`,
    undefined,
    { cause },
  );
}

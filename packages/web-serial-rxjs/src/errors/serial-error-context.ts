import { SerialErrorCode } from './serial-error-code';

/**
 * Context payload for errors that wrap an underlying failure.
 */
export type SerialErrorCauseContext = {
  readonly cause: unknown;
};

/**
 * Machine-readable constraint identifiers for factory-time validation errors.
 */
export type ValidationErrorConstraint =
  | 'at-least-one-usb-id'
  | 'usb-id-0-65535'
  | 'positive-safe-integer'
  | 'receive-replay-buffer-size-range'
  | 'receive-replay-max-chars-range'
  | 'non-negative-safe-integer';

/**
 * Structured metadata for `INVALID_*` validation errors thrown at session
 * factory time. {@link SerialError.message} remains human-readable.
 */
export type ValidationErrorContext = {
  readonly field: string;
  readonly value: unknown;
  readonly constraint: ValidationErrorConstraint;
  readonly filterIndex?: number;
};

/**
 * Maps each {@link SerialErrorCode} to its structured context shape.
 *
 * Codes mapped to `undefined` have no machine-readable metadata beyond
 * {@link SerialError.message}. Overflow and validation codes expose structured
 * metadata so callers do not need to parse error messages.
 */
export interface SerialErrorContextMap {
  [SerialErrorCode.BROWSER_NOT_SUPPORTED]: undefined;
  [SerialErrorCode.PORT_NOT_AVAILABLE]: SerialErrorCauseContext;
  [SerialErrorCode.PORT_OPEN_FAILED]: SerialErrorCauseContext;
  [SerialErrorCode.PORT_ALREADY_OPEN]: undefined;
  [SerialErrorCode.PORT_NOT_OPEN]: undefined;
  [SerialErrorCode.READ_FAILED]: SerialErrorCauseContext;
  [SerialErrorCode.WRITE_FAILED]: SerialErrorCauseContext;
  [SerialErrorCode.CONNECTION_LOST]: SerialErrorCauseContext;
  [SerialErrorCode.INVALID_FILTER_OPTIONS]: ValidationErrorContext;
  [SerialErrorCode.OPERATION_CANCELLED]: SerialErrorCauseContext;
  [SerialErrorCode.OPERATION_TIMEOUT]: undefined;
  [SerialErrorCode.LINE_BUFFER_OVERFLOW]: {
    readonly maxChars: number;
  };
  [SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS]: ValidationErrorContext;
  [SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS]: ValidationErrorContext;
  [SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS]: ValidationErrorContext;
  [SerialErrorCode.INVALID_CONNECTION_OPTIONS]: ValidationErrorContext;
  [SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW]: {
    readonly maxChars: number;
    readonly bufferSize: number;
  };
  [SerialErrorCode.SESSION_DISPOSED]: undefined;
  [SerialErrorCode.UNKNOWN]: SerialErrorCauseContext;
}

const CAUSE_CONTEXT_CODES = new Set<SerialErrorCode>([
  SerialErrorCode.PORT_NOT_AVAILABLE,
  SerialErrorCode.PORT_OPEN_FAILED,
  SerialErrorCode.READ_FAILED,
  SerialErrorCode.WRITE_FAILED,
  SerialErrorCode.CONNECTION_LOST,
  SerialErrorCode.OPERATION_CANCELLED,
  SerialErrorCode.UNKNOWN,
]);

/**
 * @internal
 */
export function isCauseContextCode(
  code: SerialErrorCode,
): code is keyof {
  [K in keyof SerialErrorContextMap as SerialErrorContextMap[K] extends SerialErrorCauseContext
    ? K
    : never]: SerialErrorContextMap[K];
} {
  return CAUSE_CONTEXT_CODES.has(code);
}

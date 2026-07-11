import { SerialErrorCode } from './serial-error-code';

/**
 * Context payload for errors that wrap an underlying failure.
 */
export type SerialErrorCauseContext = {
  readonly cause: unknown;
};

/**
 * Maps each {@link SerialErrorCode} to its structured context shape.
 *
 * Codes mapped to `undefined` have no machine-readable metadata beyond
 * {@link SerialError.message}. Overflow codes expose configured limits so
 * callers do not need to parse error messages.
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
  [SerialErrorCode.INVALID_FILTER_OPTIONS]: undefined;
  [SerialErrorCode.OPERATION_CANCELLED]: SerialErrorCauseContext;
  [SerialErrorCode.OPERATION_TIMEOUT]: undefined;
  [SerialErrorCode.LINE_BUFFER_OVERFLOW]: {
    readonly maxChars: number;
  };
  [SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS]: undefined;
  [SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS]: undefined;
  [SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS]: undefined;
  [SerialErrorCode.INVALID_CONNECTION_OPTIONS]: undefined;
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

import { SerialErrorCode } from '../../errors/serial-error-code';

/**
 * Internal error classification used by the single `reportError` entry
 * point. `'fatal'` errors drive `state$` into `'error'` and tear down
 * the live session (pump stop + port close); `'non-fatal'` errors are
 * only multiplexed on `errors$` without mutating session state.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/399 | Issue #399}
 */
export type ReportErrorSeverity = 'fatal' | 'non-fatal';

/**
 * Maps each {@link SerialErrorCode} that can surface through session
 * `reportError` to its severity. Unmapped codes fall back to `'fatal'`
 * in {@link resolveErrorSeverity}.
 *
 * @internal
 */
export const ERROR_SEVERITY = {
  [SerialErrorCode.READ_FAILED]: 'fatal',
  [SerialErrorCode.CONNECTION_LOST]: 'fatal',
  [SerialErrorCode.PORT_OPEN_FAILED]: 'fatal',
  [SerialErrorCode.OPERATION_CANCELLED]: 'fatal',
  [SerialErrorCode.UNKNOWN]: 'fatal',
  [SerialErrorCode.LINE_BUFFER_OVERFLOW]: 'non-fatal',
  [SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW]: 'non-fatal',
  [SerialErrorCode.BROWSER_NOT_SUPPORTED]: 'non-fatal',
  [SerialErrorCode.PORT_ALREADY_OPEN]: 'non-fatal',
  [SerialErrorCode.PORT_NOT_OPEN]: 'non-fatal',
  [SerialErrorCode.WRITE_FAILED]: 'non-fatal',
} as const satisfies Partial<Record<SerialErrorCode, ReportErrorSeverity>>;

/**
 * Resolve the reporting severity for a normalised {@link SerialErrorCode}.
 *
 * @internal
 */
export function resolveErrorSeverity(
  code: SerialErrorCode,
): ReportErrorSeverity {
  if (code in ERROR_SEVERITY) {
    return ERROR_SEVERITY[code as keyof typeof ERROR_SEVERITY];
  }
  return 'fatal';
}

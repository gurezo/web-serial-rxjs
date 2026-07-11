import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import {
  ERROR_SEVERITY,
  resolveErrorSeverity,
} from '../../src/session/internal/error-severity';

describe('ERROR_SEVERITY', () => {
  it.each([
    [SerialErrorCode.READ_FAILED, 'fatal'],
    [SerialErrorCode.CONNECTION_LOST, 'fatal'],
    [SerialErrorCode.PORT_OPEN_FAILED, 'fatal'],
    [SerialErrorCode.OPERATION_CANCELLED, 'fatal'],
    [SerialErrorCode.UNKNOWN, 'fatal'],
    [SerialErrorCode.LINE_BUFFER_OVERFLOW, 'non-fatal'],
    [SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW, 'non-fatal'],
    [SerialErrorCode.BROWSER_NOT_SUPPORTED, 'non-fatal'],
    [SerialErrorCode.PORT_ALREADY_OPEN, 'non-fatal'],
    [SerialErrorCode.PORT_NOT_OPEN, 'non-fatal'],
    [SerialErrorCode.WRITE_FAILED, 'non-fatal'],
  ] as const)('maps %s to %s', (code, severity) => {
    expect(ERROR_SEVERITY[code]).toBe(severity);
    expect(resolveErrorSeverity(code)).toBe(severity);
  });

  it('falls back to fatal for unmapped codes', () => {
    expect(resolveErrorSeverity(SerialErrorCode.SESSION_DISPOSED)).toBe('fatal');
    expect(resolveErrorSeverity(SerialErrorCode.INVALID_FILTER_OPTIONS)).toBe(
      'fatal',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';

/**
 * Regression guard for the SerialErrorCode emission audit (Issue #438).
 * Keep in sync with MIGRATION_V3 §8 and API_REFERENCE.
 */
const IMPLEMENTED_CODES = [
  SerialErrorCode.BROWSER_NOT_SUPPORTED,
  SerialErrorCode.PORT_OPEN_FAILED,
  SerialErrorCode.PORT_ALREADY_OPEN,
  SerialErrorCode.PORT_NOT_OPEN,
  SerialErrorCode.READ_FAILED,
  SerialErrorCode.WRITE_FAILED,
  SerialErrorCode.CONNECTION_LOST,
  SerialErrorCode.INVALID_FILTER_OPTIONS,
  SerialErrorCode.OPERATION_CANCELLED,
  SerialErrorCode.LINE_BUFFER_OVERFLOW,
  SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS,
  SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
  SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS,
  SerialErrorCode.INVALID_CONNECTION_OPTIONS,
  SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW,
  SerialErrorCode.SESSION_DISPOSED,
  SerialErrorCode.UNKNOWN,
] as const;

const RESERVED_CODES = [
  SerialErrorCode.PORT_NOT_AVAILABLE,
  SerialErrorCode.OPERATION_TIMEOUT,
] as const;

describe('SerialErrorCode emission audit (#438)', () => {
  it('defines exactly 19 codes', () => {
    expect(Object.values(SerialErrorCode)).toHaveLength(19);
  });

  it('classifies every code as implemented or reserved', () => {
    const classified = new Set<string>([
      ...IMPLEMENTED_CODES,
      ...RESERVED_CODES,
    ]);
    expect(classified.size).toBe(19);
    for (const code of Object.values(SerialErrorCode)) {
      expect(classified.has(code)).toBe(true);
    }
  });

  it('marks reserved codes as not implemented at runtime in v3.x', () => {
    expect(RESERVED_CODES).toEqual([
      SerialErrorCode.PORT_NOT_AVAILABLE,
      SerialErrorCode.OPERATION_TIMEOUT,
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';

/**
 * Regression guard for the SerialErrorCode emission audit (Issue #438).
 * Reserved codes removed in v5 (Issue #658) must stay off the public object.
 * Keep in sync with concepts.md SerialError / SerialErrorCode.
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
  SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
  SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS,
  SerialErrorCode.INVALID_CONNECTION_OPTIONS,
  SerialErrorCode.SESSION_DISPOSED,
  SerialErrorCode.UNKNOWN,
] as const;

const REMOVED_RESERVED_CODES = [
  'PORT_NOT_AVAILABLE',
  'OPERATION_TIMEOUT',
] as const;

describe('SerialErrorCode emission audit (#438)', () => {
  it('defines exactly 15 codes', () => {
    expect(Object.values(SerialErrorCode)).toHaveLength(15);
  });

  it('classifies every code as implemented', () => {
    const classified = new Set<string>(IMPLEMENTED_CODES);
    expect(classified.size).toBe(15);
    for (const code of Object.values(SerialErrorCode)) {
      expect(classified.has(code)).toBe(true);
    }
  });

  it('does not export reserved codes removed in v5', () => {
    const codes = SerialErrorCode as Record<string, string>;
    for (const code of REMOVED_RESERVED_CODES) {
      expect(codes[code]).toBeUndefined();
    }
  });
});

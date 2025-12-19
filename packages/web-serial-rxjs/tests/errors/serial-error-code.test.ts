import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';

describe('SerialErrorCode', () => {
  it('should have all expected error codes', () => {
    expect(SerialErrorCode.BROWSER_NOT_SUPPORTED).toBe('BROWSER_NOT_SUPPORTED');
    expect(SerialErrorCode.PORT_NOT_AVAILABLE).toBe('PORT_NOT_AVAILABLE');
    expect(SerialErrorCode.PORT_OPEN_FAILED).toBe('PORT_OPEN_FAILED');
    expect(SerialErrorCode.PORT_ALREADY_OPEN).toBe('PORT_ALREADY_OPEN');
    expect(SerialErrorCode.PORT_NOT_OPEN).toBe('PORT_NOT_OPEN');
    expect(SerialErrorCode.READ_FAILED).toBe('READ_FAILED');
    expect(SerialErrorCode.WRITE_FAILED).toBe('WRITE_FAILED');
    expect(SerialErrorCode.CONNECTION_LOST).toBe('CONNECTION_LOST');
    expect(SerialErrorCode.INVALID_FILTER_OPTIONS).toBe(
      'INVALID_FILTER_OPTIONS',
    );
    expect(SerialErrorCode.OPERATION_CANCELLED).toBe('OPERATION_CANCELLED');
    expect(SerialErrorCode.UNKNOWN).toBe('UNKNOWN');
  });

  it('should be an enum with string values', () => {
    const codes = Object.values(SerialErrorCode);
    expect(codes.length).toBeGreaterThan(0);
    codes.forEach((code) => {
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    });
  });

  it('should have unique error codes', () => {
    const codes = Object.values(SerialErrorCode);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });
});

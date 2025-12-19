import { describe, expect, it } from 'vitest';
import { SerialError, SerialErrorCode } from '../../src/errors/serial-error';

describe('SerialError', () => {
  describe('constructor', () => {
    it('should create an error with code and message', () => {
      const error = new SerialError(
        SerialErrorCode.PORT_NOT_AVAILABLE,
        'Port is not available',
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SerialError);
      expect(error.name).toBe('SerialError');
      expect(error.code).toBe(SerialErrorCode.PORT_NOT_AVAILABLE);
      expect(error.message).toBe('Port is not available');
      expect(error.originalError).toBeUndefined();
    });

    it('should create an error with original error', () => {
      const originalError = new Error('Original error');
      const error = new SerialError(
        SerialErrorCode.READ_FAILED,
        'Failed to read',
        originalError,
      );

      expect(error.code).toBe(SerialErrorCode.READ_FAILED);
      expect(error.message).toBe('Failed to read');
      expect(error.originalError).toBe(originalError);
    });

    it('should have correct error name', () => {
      const error = new SerialError(SerialErrorCode.UNKNOWN, 'Unknown error');

      expect(error.name).toBe('SerialError');
    });

    it('should maintain stack trace when Error.captureStackTrace is available', () => {
      const error = new SerialError(SerialErrorCode.UNKNOWN, 'Test error');

      // Stack trace should exist (in Node.js environment)
      if (Error.captureStackTrace) {
        expect(error.stack).toBeDefined();
        expect(error.stack).toContain('SerialError');
      }
    });
  });

  describe('is', () => {
    it('should return true when code matches', () => {
      const error = new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Port is not open',
      );

      expect(error.is(SerialErrorCode.PORT_NOT_OPEN)).toBe(true);
    });

    it('should return false when code does not match', () => {
      const error = new SerialError(
        SerialErrorCode.PORT_NOT_OPEN,
        'Port is not open',
      );

      expect(error.is(SerialErrorCode.PORT_ALREADY_OPEN)).toBe(false);
    });

    it('should work with all error codes', () => {
      const codes = Object.values(SerialErrorCode);

      codes.forEach((code) => {
        const error = new SerialError(code, `Error with ${code}`);
        expect(error.is(code)).toBe(true);

        // Test with different code
        const differentCode = codes.find((c) => c !== code);
        if (differentCode) {
          expect(error.is(differentCode)).toBe(false);
        }
      });
    });
  });

  describe('error inheritance', () => {
    it('should be catchable as Error', () => {
      try {
        throw new SerialError(SerialErrorCode.UNKNOWN, 'Test error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(SerialError);
      }
    });

    it('should have message property', () => {
      const error = new SerialError(
        SerialErrorCode.READ_FAILED,
        'Read failed message',
      );

      expect(error.message).toBe('Read failed message');
    });

    it('should preserve original error information', () => {
      const originalError = new TypeError('Type error');
      const error = new SerialError(
        SerialErrorCode.WRITE_FAILED,
        'Write failed',
        originalError,
      );

      expect(error.originalError).toBe(originalError);
      expect(error.originalError?.message).toBe('Type error');
      expect(error.originalError).toBeInstanceOf(TypeError);
    });
  });
});

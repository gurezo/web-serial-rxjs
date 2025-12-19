import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  checkBrowserSupport,
  isBrowserSupported,
} from '../../src/browser/browser-support';
import { SerialError, SerialErrorCode } from '../../src/errors/serial-error';

describe('browser-support', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Need to delete navigator for test isolation
    delete (global as any).navigator;
  });

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  describe('isBrowserSupported', () => {
    it('should return true when Web Serial API is supported', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        serial: {},
      };

      expect(isBrowserSupported()).toBe(true);
    });

    it('should return false when Web Serial API is not supported', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      expect(isBrowserSupported()).toBe(false);
    });

    it('should return false when navigator is undefined', () => {
      expect(isBrowserSupported()).toBe(false);
    });
  });

  describe('checkBrowserSupport', () => {
    it('should not throw when Web Serial API is supported', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        serial: {},
      };

      expect(() => checkBrowserSupport()).not.toThrow();
    });

    it('should throw SerialError with BROWSER_NOT_SUPPORTED code when Web Serial API is not supported', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      expect(() => checkBrowserSupport()).toThrow(SerialError);
      expect(() => checkBrowserSupport()).toThrow(
        'Web Serial API is not supported',
      );
    });

    it('should include browser name in error message for Chrome', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      try {
        checkBrowserSupport();
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.BROWSER_NOT_SUPPORTED,
        );
        expect((error as SerialError).message).toContain('CHROME');
      }
    });

    it('should include browser name in error message for Edge', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      };

      try {
        checkBrowserSupport();
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.BROWSER_NOT_SUPPORTED,
        );
        expect((error as SerialError).message).toContain('EDGE');
      }
    });

    it('should include browser name in error message for Opera', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
      };

      try {
        checkBrowserSupport();
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.BROWSER_NOT_SUPPORTED,
        );
        expect((error as SerialError).message).toContain('OPERA');
      }
    });

    it('should use generic message when browser type is UNKNOWN', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      try {
        checkBrowserSupport();
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.BROWSER_NOT_SUPPORTED,
        );
        expect((error as SerialError).message).toContain('your browser');
      }
    });

    it('should throw error with correct error code', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      try {
        checkBrowserSupport();
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.BROWSER_NOT_SUPPORTED,
        );
        expect(
          (error as SerialError).is(SerialErrorCode.BROWSER_NOT_SUPPORTED),
        ).toBe(true);
      }
    });
  });
});

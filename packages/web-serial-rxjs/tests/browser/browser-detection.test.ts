import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  BrowserType,
  detectBrowserType,
  hasWebSerialSupport,
  isChromiumBased,
} from '../../src/browser/browser-detection';

describe('browser-detection', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // Reset navigator before each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Need to delete navigator for test isolation
    delete (global as any).navigator;
  });

  afterEach(() => {
    // Restore original navigator after each test
    global.navigator = originalNavigator;
  });

  describe('hasWebSerialSupport', () => {
    it('should return true when navigator.serial exists', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        serial: {},
      };

      expect(hasWebSerialSupport()).toBe(true);
    });

    it('should return false when navigator is undefined', () => {
      expect(hasWebSerialSupport()).toBe(false);
    });

    it('should return false when navigator.serial is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      expect(hasWebSerialSupport()).toBe(false);
    });

    it('should return false when navigator.serial is null', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        serial: null,
      };

      expect(hasWebSerialSupport()).toBe(false);
    });
  });

  describe('detectBrowserType', () => {
    it('should detect Chrome browser', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      expect(detectBrowserType()).toBe(BrowserType.CHROME);
    });

    it('should detect Edge browser', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      };

      expect(detectBrowserType()).toBe(BrowserType.EDGE);
    });

    it('should detect Opera browser (opr/)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
      };

      expect(detectBrowserType()).toBe(BrowserType.OPERA);
    });

    it('should detect Opera browser (opera/)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Opera/106.0.0.0',
      };

      expect(detectBrowserType()).toBe(BrowserType.OPERA);
    });

    it('should return UNKNOWN when userAgent is undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      expect(detectBrowserType()).toBe(BrowserType.UNKNOWN);
    });

    it('should return UNKNOWN when navigator is undefined', () => {
      expect(detectBrowserType()).toBe(BrowserType.UNKNOWN);
    });

    it('should return UNKNOWN for unsupported browser', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/120.0.0.0',
      };

      expect(detectBrowserType()).toBe(BrowserType.UNKNOWN);
    });

    it('should be case-insensitive when detecting browsers', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) CHROME/120.0.0.0 Safari/537.36',
      };

      expect(detectBrowserType()).toBe(BrowserType.CHROME);
    });
  });

  describe('isChromiumBased', () => {
    it('should return true for Chrome', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      };

      expect(isChromiumBased()).toBe(true);
    });

    it('should return true for Edge', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
      };

      expect(isChromiumBased()).toBe(true);
    });

    it('should return true for Opera', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0',
      };

      expect(isChromiumBased()).toBe(true);
    });

    it('should return false for unsupported browser', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/120.0.0.0',
      };

      expect(isChromiumBased()).toBe(false);
    });

    it('should return false when browser type is UNKNOWN', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mocking navigator for test
      (global as any).navigator = {};

      expect(isChromiumBased()).toBe(false);
    });
  });
});

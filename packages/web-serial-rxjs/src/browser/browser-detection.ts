/**
 * Browser type enumeration
 */
export enum BrowserType {
  CHROME = 'chrome',
  EDGE = 'edge',
  OPERA = 'opera',
  UNKNOWN = 'unknown',
}

/**
 * Feature detection for Web Serial API
 * Checks if the browser supports the Web Serial API
 */
export function hasWebSerialSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    navigator.serial !== undefined
  );
}

/**
 * Detect browser type from user agent
 */
export function detectBrowserType(): BrowserType {
  if (typeof navigator === 'undefined' || !navigator.userAgent) {
    return BrowserType.UNKNOWN;
  }

  const ua = navigator.userAgent.toLowerCase();

  if (ua.includes('edg/')) {
    return BrowserType.EDGE;
  }

  if (ua.includes('opr/') || ua.includes('opera/')) {
    return BrowserType.OPERA;
  }

  if (ua.includes('chrome/')) {
    return BrowserType.CHROME;
  }

  return BrowserType.UNKNOWN;
}

/**
 * Check if the browser is Chromium-based
 */
export function isChromiumBased(): boolean {
  const browserType = detectBrowserType();
  return (
    browserType === BrowserType.CHROME ||
    browserType === BrowserType.EDGE ||
    browserType === BrowserType.OPERA
  );
}

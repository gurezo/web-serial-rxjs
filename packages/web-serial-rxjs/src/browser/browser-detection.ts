/**
 * Browser type enumeration for identifying the browser environment.
 *
 * This enum is used to identify the specific browser type, which is useful for
 * browser-specific behavior or error messages.
 *
 * @example
 * ```typescript
 * const browserType = detectBrowserType();
 * if (browserType === BrowserType.CHROME) {
 *   console.log('Running in Chrome');
 * }
 * ```
 */
export enum BrowserType {
  /** Google Chrome browser */
  CHROME = 'chrome',
  /** Microsoft Edge browser */
  EDGE = 'edge',
  /** Opera browser */
  OPERA = 'opera',
  /** Unknown or unsupported browser */
  UNKNOWN = 'unknown',
}

/**
 * Feature detection for Web Serial API.
 *
 * Checks if the browser supports the Web Serial API by verifying the presence
 * of `navigator.serial`. This is a non-throwing check that returns `false` if
 * the API is not available.
 *
 * Note: This function only checks for API availability, not whether the browser
 * type is supported. For a throwing check that provides better error messages,
 * use {@link checkBrowserSupport}.
 *
 * @returns `true` if the Web Serial API is available, `false` otherwise
 *
 * @example
 * ```typescript
 * if (hasWebSerialSupport()) {
 *   // Safe to use serial port functionality
 *   const client = createSerialClient();
 * } else {
 *   console.error('Web Serial API is not supported');
 * }
 * ```
 *
 * @see {@link checkBrowserSupport} for a throwing version with better error messages
 * @see {@link isBrowserSupported} for an alias to this function
 */
export function hasWebSerialSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    navigator.serial !== undefined &&
    navigator.serial !== null
  );
}

/**
 * Detect browser type from the user agent string.
 *
 * Analyzes the browser's user agent string to identify the browser type.
 * This function is useful for providing browser-specific functionality or
 * error messages.
 *
 * @returns The detected {@link BrowserType}, or {@link BrowserType.UNKNOWN} if the browser cannot be identified
 *
 * @example
 * ```typescript
 * const browserType = detectBrowserType();
 * switch (browserType) {
 *   case BrowserType.CHROME:
 *     console.log('Running in Chrome');
 *     break;
 *   case BrowserType.EDGE:
 *     console.log('Running in Edge');
 *     break;
 *   case BrowserType.OPERA:
 *     console.log('Running in Opera');
 *     break;
 *   default:
 *     console.log('Unknown browser');
 * }
 * ```
 *
 * @see {@link isChromiumBased} for checking if the browser is Chromium-based
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
 * Check if the browser is Chromium-based.
 *
 * Determines if the current browser is based on Chromium, which includes
 * Chrome, Edge, and Opera. These browsers support the Web Serial API.
 *
 * @returns `true` if the browser is Chromium-based (Chrome, Edge, or Opera), `false` otherwise
 *
 * @example
 * ```typescript
 * if (isChromiumBased()) {
 *   // Browser supports Web Serial API
 *   const client = createSerialClient();
 * } else {
 *   console.error('Please use a Chromium-based browser (Chrome, Edge, or Opera)');
 * }
 * ```
 *
 * @see {@link detectBrowserType} for identifying the specific browser type
 * @see {@link hasWebSerialSupport} for checking Web Serial API availability
 */
export function isChromiumBased(): boolean {
  const browserType = detectBrowserType();
  return (
    browserType === BrowserType.CHROME ||
    browserType === BrowserType.EDGE ||
    browserType === BrowserType.OPERA
  );
}

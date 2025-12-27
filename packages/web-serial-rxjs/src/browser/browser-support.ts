import { SerialError, SerialErrorCode } from '../errors/serial-error';
import {
  BrowserType,
  detectBrowserType,
  hasWebSerialSupport,
} from './browser-detection';

/**
 * Check if the browser supports the Web Serial API, throwing an error if not supported.
 *
 * This function performs a feature detection check and throws a {@link SerialError}
 * with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED} if the Web Serial API
 * is not available. The error message includes the detected browser type for better
 * user feedback.
 *
 * This is the recommended way to check browser support before using serial port
 * functionality, as it provides clear error messages.
 *
 * @throws {@link SerialError} with code {@link SerialErrorCode.BROWSER_NOT_SUPPORTED}
 *         if the browser doesn't support the Web Serial API
 *
 * @example
 * ```typescript
 * try {
 *   checkBrowserSupport();
 *   // Safe to use serial port functionality
 *   const client = createSerialClient();
 * } catch (error) {
 *   if (error instanceof SerialError && error.code === SerialErrorCode.BROWSER_NOT_SUPPORTED) {
 *     console.error(error.message);
 *     // Show user-friendly message: "Please use a Chromium-based browser..."
 *   }
 * }
 * ```
 *
 * @see {@link isBrowserSupported} for a non-throwing version that returns a boolean
 * @see {@link hasWebSerialSupport} for the underlying feature detection function
 */
export function checkBrowserSupport(): void {
  if (!hasWebSerialSupport()) {
    const browserType = detectBrowserType();
    const browserName =
      browserType === BrowserType.UNKNOWN
        ? 'your browser'
        : browserType.toUpperCase();

    throw new SerialError(
      SerialErrorCode.BROWSER_NOT_SUPPORTED,
      `Web Serial API is not supported in ${browserName}. Please use a Chromium-based browser (Chrome, Edge, or Opera).`,
    );
  }
}

/**
 * Check if the browser supports the Web Serial API (non-throwing version).
 *
 * This is a convenience function that returns a boolean indicating whether
 * the Web Serial API is available. Unlike {@link checkBrowserSupport}, this
 * function does not throw an error if the API is not available.
 *
 * @returns `true` if the Web Serial API is supported, `false` otherwise
 *
 * @example
 * ```typescript
 * if (isBrowserSupported()) {
 *   const client = createSerialClient();
 *   // Use serial port functionality
 * } else {
 *   console.error('Web Serial API is not supported in this browser');
 *   // Show fallback UI or message
 * }
 * ```
 *
 * @see {@link checkBrowserSupport} for a throwing version with better error messages
 * @see {@link hasWebSerialSupport} which this function calls internally
 */
export function isBrowserSupported(): boolean {
  return hasWebSerialSupport();
}

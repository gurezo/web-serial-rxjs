import { SerialError, SerialErrorCode } from '../errors/serial-error';
import {
  BrowserType,
  detectBrowserType,
  hasWebSerialSupport,
} from './browser-detection';

/**
 * Check if the browser supports Web Serial API
 * Throws SerialError if not supported
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
 * Check if the browser supports Web Serial API (non-throwing version)
 * @returns true if supported, false otherwise
 */
export function isBrowserSupported(): boolean {
  return hasWebSerialSupport();
}

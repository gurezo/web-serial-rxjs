/**
 * Synchronous feature detection for the Web Serial API.
 *
 * This helper is SSR-safe: it returns `false` when `navigator` is not available.
 *
 * @returns `true` when `navigator.serial` is available.
 */
export function isWebSerialSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    navigator.serial !== undefined &&
    navigator.serial !== null
  );
}

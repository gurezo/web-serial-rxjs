/**
 * Synchronous feature detection for the Web Serial API.
 *
 * Prefer this helper **before** creating a session. After a session exists,
 * drive unsupported UI from `state$` with `SerialSessionStatus.Unsupported`.
 * This helper is SSR-safe: it returns `false` when `navigator` is not available.
 *
 * @returns `true` when `navigator.serial` is available.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/490 | Issue #490}
 */
export function isWebSerialSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    navigator.serial !== undefined &&
    navigator.serial !== null
  );
}

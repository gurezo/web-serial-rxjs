/**
 * Internal feature detection for the Web Serial API.
 *
 * This helper is intentionally kept package-private: the v2 public API
 * exposes browser support only through {@link SerialSession.isBrowserSupported}.
 *
 * @returns `true` when `navigator.serial` is available.
 *
 * @internal
 */
export function hasWebSerialSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serial' in navigator &&
    navigator.serial !== undefined &&
    navigator.serial !== null
  );
}

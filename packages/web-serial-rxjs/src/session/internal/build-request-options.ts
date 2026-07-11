import type { SerialSessionOptions } from '../serial-session-options';

/**
 * Build {@link SerialPortRequestOptions} from resolved {@link SerialSessionOptions}.
 *
 * Converts the `filters` field into the shape expected by
 * `navigator.serial.requestPort`. Returns `undefined` when no filters are
 * supplied so the browser shows all available ports.
 *
 * Filter validation is performed earlier by
 * {@link resolveSerialSessionOptions} at factory time.
 *
 * @param options - Resolved session options (filters already validated).
 * @returns The request options, or `undefined` when no filters are set.
 *
 * @internal
 */
export function buildRequestOptions(
  options?: SerialSessionOptions,
): SerialPortRequestOptions | undefined {
  if (!options?.filters || options.filters.length === 0) {
    return undefined;
  }

  return {
    filters: options.filters,
  };
}

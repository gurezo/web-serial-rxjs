import { SerialError, SerialErrorCode } from '../errors/serial-error';
import { SerialClientOptions } from '../types/options';

/**
 * Build SerialPortRequestOptions from SerialClientOptions.
 *
 * This utility function converts filter options from {@link SerialClientOptions} into
 * the format expected by the Web Serial API's `navigator.serial.requestPort()` method.
 * It validates the filter options to ensure they are valid before returning them.
 *
 * If no filters are provided in the options, this function returns `undefined`, which
 * allows the port selection dialog to show all available ports.
 *
 * @param options - Optional SerialClientOptions containing filter configuration
 * @returns SerialPortRequestOptions object with validated filters, or `undefined` if no filters are provided
 * @throws {@link SerialError} with code {@link SerialErrorCode.INVALID_FILTER_OPTIONS} if filter validation fails
 *
 * @example
 * ```typescript
 * // With filters
 * const options = {
 *   baudRate: 9600,
 *   filters: [
 *     { usbVendorId: 0x1234 },
 *     { usbVendorId: 0x5678, usbProductId: 0x9abc },
 *   ],
 * };
 * const requestOptions = buildRequestOptions(options);
 * // Returns: { filters: [...] }
 *
 * // Without filters
 * const requestOptions = buildRequestOptions({ baudRate: 9600 });
 * // Returns: undefined
 *
 * // Invalid filter (will throw)
 * try {
 *   buildRequestOptions({ filters: [{ usbVendorId: -1 }] });
 * } catch (error) {
 *   // SerialError with code INVALID_FILTER_OPTIONS
 * }
 * ```
 */
export function buildRequestOptions(
  options?: SerialClientOptions,
): SerialPortRequestOptions | undefined {
  if (!options || !options.filters || options.filters.length === 0) {
    return undefined;
  }

  // Validate filters
  for (const filter of options.filters) {
    if (!filter.usbVendorId && !filter.usbProductId) {
      throw new SerialError(
        SerialErrorCode.INVALID_FILTER_OPTIONS,
        'Filter must have at least usbVendorId or usbProductId',
      );
    }

    if (filter.usbVendorId !== undefined) {
      if (
        !Number.isInteger(filter.usbVendorId) ||
        filter.usbVendorId < 0 ||
        filter.usbVendorId > 0xffff
      ) {
        throw new SerialError(
          SerialErrorCode.INVALID_FILTER_OPTIONS,
          `Invalid usbVendorId: ${filter.usbVendorId}. Must be an integer between 0 and 65535.`,
        );
      }
    }

    if (filter.usbProductId !== undefined) {
      if (
        !Number.isInteger(filter.usbProductId) ||
        filter.usbProductId < 0 ||
        filter.usbProductId > 0xffff
      ) {
        throw new SerialError(
          SerialErrorCode.INVALID_FILTER_OPTIONS,
          `Invalid usbProductId: ${filter.usbProductId}. Must be an integer between 0 and 65535.`,
        );
      }
    }
  }

  return {
    filters: options.filters,
  };
}

import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';
import type { SerialSessionOptions } from '../serial-session-options';

/**
 * Build {@link SerialPortRequestOptions} from {@link SerialSessionOptions}.
 *
 * Converts the `filters` field of {@link SerialSessionOptions} into the
 * shape expected by `navigator.serial.requestPort` and validates USB
 * vendor / product identifiers. Returns `undefined` when no filters are
 * supplied so the browser shows all available ports.
 *
 * @param options - The session options supplied by the caller.
 * @returns The request options, or `undefined` when no filters are set.
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_FILTER_OPTIONS}
 *         when a filter is empty or contains out-of-range IDs.
 *
 * @internal
 */
export function buildRequestOptions(
  options?: SerialSessionOptions,
): SerialPortRequestOptions | undefined {
  if (!options || !options.filters || options.filters.length === 0) {
    return undefined;
  }

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

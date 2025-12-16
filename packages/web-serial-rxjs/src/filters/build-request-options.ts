import { SerialError, SerialErrorCode } from '../errors/serial-error';
import { SerialClientOptions } from '../types/options';

/**
 * Build SerialPortRequestOptions from SerialClientOptions
 * @param options SerialClientOptions
 * @returns SerialPortRequestOptions for navigator.serial.requestPort()
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

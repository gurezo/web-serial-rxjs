import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';

/**
 * Validate {@link SerialPortFilter} entries for session creation.
 *
 * @param filters - Optional filters from {@link SerialSessionOptions}.
 * @returns The same filters reference when valid, or `undefined` when omitted/empty.
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_FILTER_OPTIONS}
 *         when a filter is empty or contains out-of-range IDs.
 *
 * @internal
 */
export function validateSerialPortFilters(
  filters?: SerialPortFilter[],
): SerialPortFilter[] | undefined {
  if (!filters || filters.length === 0) {
    return filters;
  }

  for (let filterIndex = 0; filterIndex < filters.length; filterIndex++) {
    const filter = filters[filterIndex];
    if (!filter.usbVendorId && !filter.usbProductId) {
      throw new SerialError(
        SerialErrorCode.INVALID_FILTER_OPTIONS,
        'Filter must have at least usbVendorId or usbProductId',
        undefined,
        {
          field: 'filters',
          value: filter,
          constraint: 'at-least-one-usb-id',
          filterIndex,
        },
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
          undefined,
          {
            field: 'usbVendorId',
            value: filter.usbVendorId,
            constraint: 'usb-id-0-65535',
            filterIndex,
          },
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
          undefined,
          {
            field: 'usbProductId',
            value: filter.usbProductId,
            constraint: 'usb-id-0-65535',
            filterIndex,
          },
        );
      }
    }
  }

  return filters;
}

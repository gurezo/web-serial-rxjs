import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { validateSerialPortFilters } from '../../src/session/internal/validate-serial-port-filters';

describe('validateSerialPortFilters', () => {
  it('returns undefined when filters are omitted', () => {
    expect(validateSerialPortFilters(undefined)).toBeUndefined();
  });

  it('returns empty array when filters are empty', () => {
    expect(validateSerialPortFilters([])).toEqual([]);
  });

  it('returns valid filters unchanged', () => {
    const filters = [{ usbVendorId: 0x1234, usbProductId: 0x5678 }];
    expect(validateSerialPortFilters(filters)).toBe(filters);
  });

  it.each([
    [{}],
    [{ usbVendorId: -1 }],
    [{ usbVendorId: 0x10000 }],
    [{ usbProductId: -1 }],
    [{ usbProductId: 0x10000 }],
  ])('rejects invalid filter %j', (filter) => {
    expect(() => validateSerialPortFilters([filter])).toThrow(SerialError);
    try {
      validateSerialPortFilters([filter]);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_FILTER_OPTIONS,
      );
    }
  });
});

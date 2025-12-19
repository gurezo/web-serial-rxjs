import { describe, expect, it } from 'vitest';
import { SerialError, SerialErrorCode } from '../../src/errors/serial-error';
import { buildRequestOptions } from '../../src/filters/build-request-options';
import { SerialClientOptions } from '../../src/types/options';

describe('buildRequestOptions', () => {
  describe('when options are undefined', () => {
    it('should return undefined', () => {
      expect(buildRequestOptions(undefined)).toBeUndefined();
    });
  });

  describe('when options have no filters', () => {
    it('should return undefined when filters is undefined', () => {
      const options: SerialClientOptions = {
        baudRate: 9600,
      };

      expect(buildRequestOptions(options)).toBeUndefined();
    });

    it('should return undefined when filters is empty array', () => {
      const options: SerialClientOptions = {
        baudRate: 9600,
        filters: [],
      };

      expect(buildRequestOptions(options)).toBeUndefined();
    });
  });

  describe('when options have valid filters', () => {
    it('should return request options with usbVendorId only', () => {
      const options: SerialClientOptions = {
        filters: [{ usbVendorId: 0x1234 }],
      };

      const result = buildRequestOptions(options);

      expect(result).toBeDefined();
      expect(result?.filters).toHaveLength(1);
      expect(result?.filters?.[0].usbVendorId).toBe(0x1234);
      expect(result?.filters?.[0].usbProductId).toBeUndefined();
    });

    it('should return request options with usbProductId only', () => {
      const options: SerialClientOptions = {
        filters: [{ usbProductId: 0x5678 }],
      };

      const result = buildRequestOptions(options);

      expect(result).toBeDefined();
      expect(result?.filters).toHaveLength(1);
      expect(result?.filters?.[0].usbProductId).toBe(0x5678);
      expect(result?.filters?.[0].usbVendorId).toBeUndefined();
    });

    it('should return request options with both usbVendorId and usbProductId', () => {
      const options: SerialClientOptions = {
        filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
      };

      const result = buildRequestOptions(options);

      expect(result).toBeDefined();
      expect(result?.filters).toHaveLength(1);
      expect(result?.filters?.[0].usbVendorId).toBe(0x1234);
      expect(result?.filters?.[0].usbProductId).toBe(0x5678);
    });

    it('should return request options with multiple filters', () => {
      const options: SerialClientOptions = {
        filters: [
          { usbVendorId: 0x1234 },
          { usbVendorId: 0x5678, usbProductId: 0x9abc },
          { usbProductId: 0xdef0 },
        ],
      };

      const result = buildRequestOptions(options);

      expect(result).toBeDefined();
      expect(result?.filters).toHaveLength(3);
      expect(result?.filters?.[0].usbVendorId).toBe(0x1234);
      expect(result?.filters?.[1].usbVendorId).toBe(0x5678);
      expect(result?.filters?.[1].usbProductId).toBe(0x9abc);
      expect(result?.filters?.[2].usbProductId).toBe(0xdef0);
    });
  });

  describe('when filters are invalid', () => {
    it('should throw SerialError when filter has neither usbVendorId nor usbProductId', () => {
      const options: SerialClientOptions = {
        filters: [{} as SerialPortFilter],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow(
        'Filter must have at least usbVendorId or usbProductId',
      );

      try {
        buildRequestOptions(options);
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.INVALID_FILTER_OPTIONS,
        );
      }
    });

    it('should throw SerialError when usbVendorId is not an integer', () => {
      const options: SerialClientOptions = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Testing invalid type for usbVendorId
        filters: [{ usbVendorId: 1.5 as any }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow('Invalid usbVendorId');

      try {
        buildRequestOptions(options);
        expect.fail('Should have thrown SerialError');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(
          SerialErrorCode.INVALID_FILTER_OPTIONS,
        );
      }
    });

    it('should throw SerialError when usbVendorId is negative', () => {
      const options: SerialClientOptions = {
        filters: [{ usbVendorId: -1 }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow('Invalid usbVendorId');
    });

    it('should throw SerialError when usbVendorId exceeds 0xffff', () => {
      const options: SerialClientOptions = {
        filters: [{ usbVendorId: 0x10000 }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow('Invalid usbVendorId');
    });

    it('should accept usbVendorId at boundary values', () => {
      // Test with 0 (minimum valid value)
      const options1: SerialClientOptions = {
        filters: [{ usbVendorId: 0, usbProductId: 0x1234 }], // Add usbProductId to avoid falsy check
      };
      expect(buildRequestOptions(options1)).toBeDefined();
      expect(buildRequestOptions(options1)?.filters?.[0].usbVendorId).toBe(0);

      // Test with 0xffff (maximum valid value)
      const options2: SerialClientOptions = {
        filters: [{ usbVendorId: 0xffff }],
      };
      expect(buildRequestOptions(options2)).toBeDefined();
      expect(buildRequestOptions(options2)?.filters?.[0].usbVendorId).toBe(
        0xffff,
      );
    });

    it('should throw SerialError when usbProductId is not an integer', () => {
      const options: SerialClientOptions = {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Testing invalid type for usbProductId
        filters: [{ usbProductId: 2.5 as any }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow(
        'Invalid usbProductId',
      );
    });

    it('should throw SerialError when usbProductId is negative', () => {
      const options: SerialClientOptions = {
        filters: [{ usbProductId: -1 }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow(
        'Invalid usbProductId',
      );
    });

    it('should throw SerialError when usbProductId exceeds 0xffff', () => {
      const options: SerialClientOptions = {
        filters: [{ usbProductId: 0x10000 }],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
      expect(() => buildRequestOptions(options)).toThrow(
        'Invalid usbProductId',
      );
    });

    it('should accept usbProductId at boundary values', () => {
      // Test with 0 (minimum valid value)
      const options1: SerialClientOptions = {
        filters: [{ usbVendorId: 0x1234, usbProductId: 0 }], // Add usbVendorId to avoid falsy check
      };
      expect(buildRequestOptions(options1)).toBeDefined();
      expect(buildRequestOptions(options1)?.filters?.[0].usbProductId).toBe(0);

      // Test with 0xffff (maximum valid value)
      const options2: SerialClientOptions = {
        filters: [{ usbProductId: 0xffff }],
      };
      expect(buildRequestOptions(options2)).toBeDefined();
      expect(buildRequestOptions(options2)?.filters?.[0].usbProductId).toBe(
        0xffff,
      );
    });

    it('should validate all filters in array', () => {
      const options: SerialClientOptions = {
        filters: [
          { usbVendorId: 0x1234 }, // Valid
          {} as SerialPortFilter, // Invalid - should throw
        ],
      };

      expect(() => buildRequestOptions(options)).toThrow(SerialError);
    });
  });
});

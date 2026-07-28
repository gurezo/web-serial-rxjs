import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import {
  DEFAULT_LINE_BUFFER_OPTIONS,
} from '../../src/session/internal/line-buffer';
import {
  DEFAULT_SERIAL_SESSION_OPTIONS,
  resolveSerialSessionOptions,
  type SerialSessionOptions,
} from '../../src/session/serial-session-options';
import { DEFAULT_TERMINAL_BUFFER_OPTIONS } from '../../src/terminal/create-terminal-buffer';

describe('resolveSerialSessionOptions', () => {
  it('returns defaults when options are omitted', () => {
    expect(resolveSerialSessionOptions()).toEqual(DEFAULT_SERIAL_SESSION_OPTIONS);
  });

  it('merges top-level partial options', () => {
    expect(
      resolveSerialSessionOptions({
        baudRate: 115200,
        dataBits: 7,
        stopBits: 2,
        parity: 'even',
        bufferSize: 512,
        flowControl: 'hardware',
      }),
    ).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      baudRate: 115200,
      dataBits: 7,
      stopBits: 2,
      parity: 'even',
      bufferSize: 512,
      flowControl: 'hardware',
    });
  });

  it('merges nested terminalBuffer options', () => {
    expect(
      resolveSerialSessionOptions({
        terminalBuffer: { maxLines: 100 },
      }),
    ).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      terminalBuffer: {
        ...DEFAULT_TERMINAL_BUFFER_OPTIONS,
        maxLines: 100,
      },
    });
  });

  it('defaults terminalBuffer.stripAnsi to true', () => {
    expect(resolveSerialSessionOptions().terminalBuffer.stripAnsi).toBe(true);
  });

  it('merges terminalBuffer.stripAnsi false', () => {
    expect(
      resolveSerialSessionOptions({
        terminalBuffer: { stripAnsi: false },
      }).terminalBuffer,
    ).toEqual({
      ...DEFAULT_TERMINAL_BUFFER_OPTIONS,
      stripAnsi: false,
    });
  });

  it('merges nested lineBuffer options', () => {
    expect(
      resolveSerialSessionOptions({
        lineBuffer: { maxChars: 2048 },
      }),
    ).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      lineBuffer: {
        ...DEFAULT_LINE_BUFFER_OPTIONS,
        maxChars: 2048,
      },
    });
  });

  it('passes through filters', () => {
    const filters = [{ usbVendorId: 0x1234, usbProductId: 0x5678 }];
    expect(resolveSerialSessionOptions({ filters })).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      filters,
    });
  });

  it.each([
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: -1 } }, -1],
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: 1.5 } }, 1.5],
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: NaN } }, NaN],
    [
      'terminalBuffer.maxLines',
      { terminalBuffer: { maxLines: Infinity } },
      Infinity,
    ],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: -1 } }, -1],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: 1.5 } }, 1.5],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: NaN } }, NaN],
    [
      'terminalBuffer.maxChars',
      { terminalBuffer: { maxChars: Infinity } },
      Infinity,
    ],
  ])('rejects invalid %s', (field, options, value) => {
    expect(() => resolveSerialSessionOptions(options)).toThrow(SerialError);
    try {
      resolveSerialSessionOptions(options);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
      );
      expect((error as SerialError).context).toEqual({
        field,
        value,
        constraint: 'non-negative-safe-integer',
      });
    }
  });

  it('accepts terminalBuffer zero limits as unlimited', () => {
    expect(
      resolveSerialSessionOptions({
        terminalBuffer: { maxLines: 0, maxChars: 0 },
      }).terminalBuffer,
    ).toEqual({ maxLines: 0, maxChars: 0, stripAnsi: true });
  });

  it.each([
    ['lineBuffer.maxChars', { lineBuffer: { maxChars: -1 } }, -1],
    ['lineBuffer.maxChars', { lineBuffer: { maxChars: 1.5 } }, 1.5],
    ['lineBuffer.maxChars', { lineBuffer: { maxChars: NaN } }, NaN],
    ['lineBuffer.maxChars', { lineBuffer: { maxChars: Infinity } }, Infinity],
  ])('rejects invalid %s', (field, options, value) => {
    expect(() => resolveSerialSessionOptions(options)).toThrow(SerialError);
    try {
      resolveSerialSessionOptions(options);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS,
      );
      expect((error as SerialError).context).toEqual({
        field,
        value,
        constraint: 'non-negative-safe-integer',
      });
    }
  });

  it('accepts lineBuffer zero maxChars as unlimited', () => {
    expect(
      resolveSerialSessionOptions({ lineBuffer: { maxChars: 0 } }).lineBuffer,
    ).toEqual({ maxChars: 0 });
  });

  it.each([
    ['filters', { filters: [{}] }, { field: 'filters', constraint: 'at-least-one-usb-id', filterIndex: 0 }],
    ['filters', { filters: [{ usbVendorId: -1 }] }, { field: 'usbVendorId', value: -1, constraint: 'usb-id-0-65535', filterIndex: 0 }],
    ['filters', { filters: [{ usbVendorId: 0x10000 }] }, { field: 'usbVendorId', value: 0x10000, constraint: 'usb-id-0-65535', filterIndex: 0 }],
    ['filters', { filters: [{ usbProductId: -1 }] }, { field: 'usbProductId', value: -1, constraint: 'usb-id-0-65535', filterIndex: 0 }],
    ['filters', { filters: [{ usbProductId: 0x10000 }] }, { field: 'usbProductId', value: 0x10000, constraint: 'usb-id-0-65535', filterIndex: 0 }],
  ])('rejects invalid %s', (_field, options, expectedContext) => {
    expect(() => resolveSerialSessionOptions(options)).toThrow(SerialError);
    try {
      resolveSerialSessionOptions(options);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_FILTER_OPTIONS,
      );
      expect((error as SerialError).context).toMatchObject(expectedContext);
    }
  });

  it.each([
    ['baudRate', { baudRate: 0 }, 0],
    ['baudRate', { baudRate: -1 }, -1],
    ['baudRate', { baudRate: 1.5 }, 1.5],
    ['baudRate', { baudRate: NaN }, NaN],
    ['baudRate', { baudRate: Infinity }, Infinity],
    ['bufferSize', { bufferSize: 0 }, 0],
    ['bufferSize', { bufferSize: -1 }, -1],
    ['bufferSize', { bufferSize: 1.5 }, 1.5],
    ['bufferSize', { bufferSize: NaN }, NaN],
    ['bufferSize', { bufferSize: Infinity }, Infinity],
  ])('rejects invalid %s', (field, options, value) => {
    expect(() => resolveSerialSessionOptions(options)).toThrow(SerialError);
    try {
      resolveSerialSessionOptions(options);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_CONNECTION_OPTIONS,
      );
      expect((error as SerialError).context).toEqual({
        field,
        value,
        constraint: 'positive-safe-integer',
      });
    }
  });

  it('accepts valid baudRate values', () => {
    expect(resolveSerialSessionOptions({ baudRate: 115200 }).baudRate).toBe(
      115200,
    );
  });

  it('accepts valid bufferSize values', () => {
    expect(resolveSerialSessionOptions({ bufferSize: 512 }).bufferSize).toBe(
      512,
    );
  });

  it('does not treat connection zero as unlimited', () => {
    expect(() => resolveSerialSessionOptions({ baudRate: 0 })).toThrow(
      SerialError,
    );
    expect(() => resolveSerialSessionOptions({ bufferSize: 0 })).toThrow(
      SerialError,
    );
  });

  it('accepts representative SerialSessionOptions shapes', () => {
    const emptyOptions: SerialSessionOptions = {};
    const partialConnectionOptions: SerialSessionOptions = { baudRate: 115200 };
    const mixedOptions: SerialSessionOptions = {
      baudRate: 9600,
      terminalBuffer: { maxLines: 50 },
      lineBuffer: { maxChars: 1024 },
      filters: [{ usbVendorId: 0x1234 }],
    };

    expect(resolveSerialSessionOptions(emptyOptions)).toEqual(
      DEFAULT_SERIAL_SESSION_OPTIONS,
    );
    expect(resolveSerialSessionOptions(partialConnectionOptions)).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      baudRate: 115200,
    });
    expect(resolveSerialSessionOptions(mixedOptions)).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      baudRate: 9600,
      terminalBuffer: {
        ...DEFAULT_TERMINAL_BUFFER_OPTIONS,
        maxLines: 50,
      },
      lineBuffer: {
        ...DEFAULT_LINE_BUFFER_OPTIONS,
        maxChars: 1024,
      },
      filters: [{ usbVendorId: 0x1234 }],
    });
  });
});

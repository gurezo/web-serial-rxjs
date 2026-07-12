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

  it('merges receiveReplay options', () => {
    expect(
      resolveSerialSessionOptions({
        receiveReplay: { enabled: true, bufferSize: 2, maxChars: 100 },
      }),
    ).toEqual({
      ...DEFAULT_SERIAL_SESSION_OPTIONS,
      receiveReplay: {
        enabled: true,
        bufferSize: 2,
        maxChars: 100,
      },
    });
  });

  it('rejects invalid receiveReplay options', () => {
    expect(() =>
      resolveSerialSessionOptions({ receiveReplay: { bufferSize: 0 } }),
    ).toThrow(SerialError);
    try {
      resolveSerialSessionOptions({ receiveReplay: { bufferSize: 0 } });
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS,
      );
      expect((error as SerialError).context).toEqual({
        field: 'receiveReplay.bufferSize',
        value: 0,
        constraint: 'receive-replay-buffer-size-range',
      });
    }
  });

  it.each([
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: -1 } }, -1],
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: 1.5 } }, 1.5],
    ['terminalBuffer.maxLines', { terminalBuffer: { maxLines: NaN } }, NaN],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: -1 } }, -1],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: 1.5 } }, 1.5],
    ['terminalBuffer.maxChars', { terminalBuffer: { maxChars: NaN } }, NaN],
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

  it('accepts representative SerialSessionOptions shapes', () => {
    const emptyOptions: SerialSessionOptions = {};
    const partialConnectionOptions: SerialSessionOptions = { baudRate: 115200 };
    const mixedOptions: SerialSessionOptions = {
      baudRate: 9600,
      receiveReplay: { enabled: true },
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
      receiveReplay: {
        ...DEFAULT_SERIAL_SESSION_OPTIONS.receiveReplay,
        enabled: true,
      },
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

import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import {
  DEFAULT_LINE_BUFFER_OPTIONS,
} from '../../src/session/internal/line-buffer';
import {
  DEFAULT_SERIAL_SESSION_OPTIONS,
  resolveSerialSessionOptions,
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
    }
  });
});

import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import {
  MAX_RECEIVE_REPLAY_BUFFER_SIZE,
  MAX_RECEIVE_REPLAY_MAX_CHARS,
  resolveReceiveReplayOptions,
} from '../../src/session/serial-session-options';

describe('resolveReceiveReplayOptions', () => {
  it('returns defaults when options are omitted', () => {
    expect(resolveReceiveReplayOptions()).toEqual({
      enabled: false,
      bufferSize: 512,
      maxChars: 0,
    });
  });

  it('merges partial options', () => {
    expect(
      resolveReceiveReplayOptions({ enabled: true, bufferSize: 2 }),
    ).toEqual({
      enabled: true,
      bufferSize: 2,
      maxChars: 0,
    });
  });

  it('accepts bufferSize at lower and upper bounds', () => {
    expect(resolveReceiveReplayOptions({ bufferSize: 1 }).bufferSize).toBe(1);
    expect(
      resolveReceiveReplayOptions({ bufferSize: MAX_RECEIVE_REPLAY_BUFFER_SIZE })
        .bufferSize,
    ).toBe(MAX_RECEIVE_REPLAY_BUFFER_SIZE);
  });

  it('accepts maxChars at lower and upper bounds', () => {
    expect(resolveReceiveReplayOptions({ maxChars: 0 }).maxChars).toBe(0);
    expect(
      resolveReceiveReplayOptions({ maxChars: MAX_RECEIVE_REPLAY_MAX_CHARS })
        .maxChars,
    ).toBe(MAX_RECEIVE_REPLAY_MAX_CHARS);
  });

  it.each([
    ['bufferSize', { bufferSize: 0 }],
    ['bufferSize', { bufferSize: -1 }],
    ['bufferSize', { bufferSize: 1.5 }],
    ['bufferSize', { bufferSize: NaN }],
    ['bufferSize', { bufferSize: MAX_RECEIVE_REPLAY_BUFFER_SIZE + 1 }],
    ['maxChars', { maxChars: -1 }],
    ['maxChars', { maxChars: 1.5 }],
    ['maxChars', { maxChars: NaN }],
    ['maxChars', { maxChars: MAX_RECEIVE_REPLAY_MAX_CHARS + 1 }],
  ])('rejects invalid %s', (_field, options) => {
    expect(() => resolveReceiveReplayOptions(options)).toThrow(SerialError);
    try {
      resolveReceiveReplayOptions(options);
    } catch (error) {
      expect(error).toBeInstanceOf(SerialError);
      expect((error as SerialError).code).toBe(
        SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS,
      );
    }
  });
});

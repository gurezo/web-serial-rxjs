import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSerialSession } from '../../src/session/create-serial-session';
import type { SerialSession } from '../../src/session/serial-session';
import type { SerialSessionState } from '../../src/session/serial-session-state';

describe('createSerialSession (skeleton)', () => {
  const originalNavigator = global.navigator;

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Reset navigator for isolation
    delete (global as any).navigator;
  });

  afterEach(() => {
    global.navigator = originalNavigator;
  });

  it('returns an object that satisfies the SerialSession contract', () => {
    const session: SerialSession = createSerialSession();

    expect(typeof session.isBrowserSupported).toBe('function');
    expect(typeof session.connect$).toBe('function');
    expect(typeof session.disconnect$).toBe('function');
    expect(typeof session.send$).toBe('function');
    expect(session.state$).toBeDefined();
    expect(session.errors$).toBeDefined();
    expect(session.receive$).toBeDefined();
  });

  it('accepts SerialSessionOptions without throwing', () => {
    expect(() =>
      createSerialSession({ baudRate: 115200, bufferSize: 1024 }),
    ).not.toThrow();
  });

  describe('isBrowserSupported', () => {
    it('returns true when navigator.serial is present', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (global as any).navigator = { serial: {} };

      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(true);
    });

    it('returns false when navigator.serial is missing', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (global as any).navigator = {};

      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(false);
    });

    it('returns false when navigator is undefined', () => {
      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(false);
    });
  });

  describe('state$', () => {
    it('replays the current idle state on subscribe', async () => {
      const session = createSerialSession();

      const state = await firstValueFrom(session.state$);

      expect(state).toBe<SerialSessionState>('idle');
    });

    it('only emits idle in the skeleton implementation', async () => {
      const session = createSerialSession();

      const states = await lastValueFrom(
        session.state$.pipe(take(1), toArray()),
      );

      expect(states).toEqual<SerialSessionState[]>(['idle']);
    });
  });

  describe('not-yet-implemented runtime methods', () => {
    const failsWithNotImplemented = async (
      observable: ReturnType<SerialSession['connect$']>,
    ) => {
      await expect(firstValueFrom(observable)).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.UNKNOWN,
      });
    };

    it('connect$ fails with SerialErrorCode.UNKNOWN', async () => {
      const session = createSerialSession();

      await failsWithNotImplemented(session.connect$());
    });

    it('disconnect$ fails with SerialErrorCode.UNKNOWN', async () => {
      const session = createSerialSession();

      await failsWithNotImplemented(session.disconnect$());
    });

    it('send$ fails with SerialErrorCode.UNKNOWN for string payload', async () => {
      const session = createSerialSession();

      await failsWithNotImplemented(session.send$('ping\r\n'));
    });

    it('send$ fails with SerialErrorCode.UNKNOWN for bytes payload', async () => {
      const session = createSerialSession();

      await failsWithNotImplemented(session.send$(new Uint8Array([0x41])));
    });

    it('error is a SerialError instance', async () => {
      const session = createSerialSession();

      try {
        await firstValueFrom(session.connect$());
        expect.fail('Expected connect$ to error');
      } catch (error) {
        expect(error).toBeInstanceOf(SerialError);
        expect((error as SerialError).code).toBe(SerialErrorCode.UNKNOWN);
        expect((error as SerialError).message).toContain('issues/199');
      }
    });
  });
});

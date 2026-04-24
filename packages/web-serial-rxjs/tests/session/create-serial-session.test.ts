import {
  firstValueFrom,
  lastValueFrom,
  take,
  toArray,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSerialSession } from '../../src/session/create-serial-session';
import type { SerialSession } from '../../src/session/serial-session';
import type { SerialSessionState } from '../../src/session/serial-session-state';

type MockPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
};

type StreamHandle = {
  stream: ReadableStream<Uint8Array>;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

const makeStream = (): StreamHandle => {
  let captured!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      captured = controller;
    },
  });
  return { stream, controller: captured };
};

const makeMockPort = (
  stream: ReadableStream<Uint8Array>,
  close: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
): MockPort => ({
  readable: stream,
  writable: null,
  open: vi.fn().mockResolvedValue(undefined),
  close,
});

const installNavigator = (port: MockPort): void => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      serial: {
        requestPort: vi.fn().mockResolvedValue(port),
        getPorts: vi.fn().mockResolvedValue([]),
      },
    },
  });
};

const installUnsupportedNavigator = (): void => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {},
  });
};

const flushMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('createSerialSession', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Reset navigator for isolation
    delete (globalThis as any).navigator;
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(
        globalThis,
        'navigator',
        originalNavigatorDescriptor,
      );
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: cleanup mocked navigator
    delete (globalThis as any).navigator;
  });

  describe('contract', () => {
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
  });

  describe('isBrowserSupported', () => {
    it('returns true when navigator.serial is present', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (globalThis as any).navigator = { serial: {} };

      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(true);
    });

    it('returns false when navigator.serial is missing', () => {
      installUnsupportedNavigator();

      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(false);
    });

    it('returns false when navigator is undefined', () => {
      const session = createSerialSession();

      expect(session.isBrowserSupported()).toBe(false);
    });
  });

  describe('state$', () => {
    it('replays idle on subscribe when Web Serial API is available', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (globalThis as any).navigator = { serial: {} };

      const session = createSerialSession();

      const state = await firstValueFrom(session.state$);

      expect(state).toBe<SerialSessionState>('idle');
    });

    it('replays unsupported when navigator.serial is missing', async () => {
      const session = createSerialSession();

      const state = await firstValueFrom(session.state$);

      expect(state).toBe<SerialSessionState>('unsupported');
    });
  });

  describe('connect$ and disconnect$', () => {
    it('transitions idle -> connecting -> connected on successful connect', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession({ baudRate: 115200 });
      const statesPromise = lastValueFrom(
        session.state$.pipe(take(3), toArray()),
      );

      await firstValueFrom(session.connect$());

      const states = await statesPromise;
      expect(states).toEqual<SerialSessionState[]>([
        'idle',
        'connecting',
        'connected',
      ]);
      expect(port.open).toHaveBeenCalledTimes(1);
      expect(port.open).toHaveBeenCalledWith(
        expect.objectContaining({ baudRate: 115200 }),
      );
    });

    it('maps user-cancelled requestPort DOMException to OPERATION_CANCELLED and state -> error', async () => {
      const requestPort = vi
        .fn()
        .mockRejectedValue(new DOMException('user cancel', 'NotFoundError'));
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { serial: { requestPort, getPorts: vi.fn() } },
      });

      const session = createSerialSession();
      const errorsPromise = firstValueFrom(session.errors$);

      await expect(firstValueFrom(session.connect$())).rejects.toBeInstanceOf(
        SerialError,
      );

      const emitted = await errorsPromise;
      expect(emitted).toBeInstanceOf(SerialError);
      expect(emitted.code).toBe(SerialErrorCode.OPERATION_CANCELLED);
      expect(await firstValueFrom(session.state$)).toBe<SerialSessionState>(
        'error',
      );
    });

    it('maps generic port.open failure to PORT_OPEN_FAILED', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      port.open.mockRejectedValueOnce(new Error('cannot open'));
      installNavigator(port);

      const session = createSerialSession();
      const errorsPromise = firstValueFrom(session.errors$);

      await expect(firstValueFrom(session.connect$())).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.PORT_OPEN_FAILED,
      });

      const emitted = await errorsPromise;
      expect(emitted.code).toBe(SerialErrorCode.PORT_OPEN_FAILED);
    });

    it('rejects connect$ with BROWSER_NOT_SUPPORTED when navigator.serial is missing', async () => {
      const session = createSerialSession();

      await expect(
        firstValueFrom(session.connect$()),
      ).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.BROWSER_NOT_SUPPORTED,
      });
    });

    it('disconnect$ completes immediately when state is idle', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (globalThis as any).navigator = { serial: {} };

      const session = createSerialSession();

      await expect(firstValueFrom(session.disconnect$())).resolves.toBeUndefined();
    });

    it('transitions connected -> disconnecting -> idle on disconnect$ and closes the port', async () => {
      const { stream } = makeStream();
      const close = vi.fn().mockResolvedValue(undefined);
      const port = makeMockPort(stream, close);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const statesPromise = lastValueFrom(
        session.state$.pipe(take(3), toArray()),
      );

      await firstValueFrom(session.disconnect$());

      const states = await statesPromise;
      expect(states).toEqual<SerialSessionState[]>([
        'connected',
        'disconnecting',
        'idle',
      ]);
      expect(close).toHaveBeenCalledTimes(1);
    });
  });

  describe('receive$', () => {
    it('emits decoded UTF-8 text chunks after connect$', async () => {
      const { stream, controller } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      const receivedPromise = firstValueFrom(
        session.receive$.pipe(take(1)),
      );

      await firstValueFrom(session.connect$());
      controller.enqueue(new TextEncoder().encode('hello'));

      await expect(receivedPromise).resolves.toBe('hello');
    });

    it('delivers subsequent chunks to late subscribers as strings', async () => {
      const { stream, controller } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      controller.enqueue(new TextEncoder().encode('early'));
      await flushMicrotasks();

      const lateArrival = firstValueFrom(session.receive$.pipe(take(1)));
      controller.enqueue(new TextEncoder().encode('late'));

      await expect(lateArrival).resolves.toBe('late');
    });

    it('routes pump errors to errors$ and moves state$ to error', async () => {
      const { stream, controller } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorPromise = firstValueFrom(session.errors$);
      controller.error(new Error('device unplugged'));

      const received = await errorPromise;
      expect(received).toBeInstanceOf(SerialError);
      expect(received.code).toBe(SerialErrorCode.READ_FAILED);

      await flushMicrotasks();
      expect(await firstValueFrom(session.state$)).toBe<SerialSessionState>(
        'error',
      );
    });
  });

  describe('send$', () => {
    it('rejects with PORT_NOT_OPEN when called before connect$', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (globalThis as any).navigator = { serial: {} };

      const session = createSerialSession();

      await expect(
        firstValueFrom(session.send$('ping\r\n')),
      ).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.PORT_NOT_OPEN,
      });
    });
  });
});

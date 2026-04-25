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
import { SerialSessionState } from '../../src/session/serial-session-state';

const S = SerialSessionState;

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
  writable: WritableStream<Uint8Array> | null = null,
): MockPort => ({
  readable: stream,
  writable,
  open: vi.fn().mockResolvedValue(undefined),
  close,
});

type WritableHarness = {
  stream: WritableStream<Uint8Array>;
  writes: Uint8Array[];
};

const makeRecordingWritable = (
  onChunk?: (chunk: Uint8Array) => Promise<void> | void,
): WritableHarness => {
  const writes: Uint8Array[] = [];
  const stream = new WritableStream<Uint8Array>({
    async write(chunk) {
      writes.push(chunk);
      await onChunk?.(chunk);
    },
  });
  return { stream, writes };
};

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
      expect(session.isConnected$).toBeDefined();
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

      expect(state).toBe<SerialSessionState>(S.Idle);
    });

    it('replays unsupported when navigator.serial is missing', async () => {
      const session = createSerialSession();

      const state = await firstValueFrom(session.state$);

      expect(state).toBe<SerialSessionState>(S.Unsupported);
    });
  });

  describe('isConnected$', () => {
    it('replays false on subscribe when state is unsupported', async () => {
      const session = createSerialSession();

      expect(await firstValueFrom(session.isConnected$)).toBe(false);
    });

    it('replays false on subscribe when state is idle', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Mock navigator
      (globalThis as any).navigator = { serial: {} };

      const session = createSerialSession();

      expect(await firstValueFrom(session.isConnected$)).toBe(false);
    });

    it('is true when connected and false after disconnect$ returns to idle', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      const connectedBools = lastValueFrom(
        session.isConnected$.pipe(take(3), toArray()),
      );

      await firstValueFrom(session.connect$());
      await firstValueFrom(session.disconnect$());

      expect(await connectedBools).toEqual([false, true, false]);
    });

    it('is false when state$ is error', async () => {
      const requestPort = vi
        .fn()
        .mockRejectedValue(new DOMException('user cancel', 'NotFoundError'));
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { serial: { requestPort, getPorts: vi.fn() } },
      });

      const session = createSerialSession();

      await expect(firstValueFrom(session.connect$())).rejects.toBeInstanceOf(
        SerialError,
      );

      expect(await firstValueFrom(session.isConnected$)).toBe(false);
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
        S.Idle,
        S.Connecting,
        S.Connected,
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
        S.Error,
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
        S.Connected,
        S.Disconnecting,
        S.Idle,
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
        S.Error,
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

    it('encodes string payloads as UTF-8 and writes them through the port writer', async () => {
      const { stream } = makeStream();
      const { stream: writable, writes } = makeRecordingWritable();
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      await firstValueFrom(session.send$('ping\r\n'));

      expect(writes).toHaveLength(1);
      expect(new TextDecoder().decode(writes[0])).toBe('ping\r\n');
    });

    it('passes raw Uint8Array payloads straight through to the writer', async () => {
      const { stream } = makeStream();
      const { stream: writable, writes } = makeRecordingWritable();
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      await firstValueFrom(session.send$(payload));

      expect(writes).toHaveLength(1);
      expect(Array.from(writes[0])).toEqual([0x01, 0x02, 0x03]);
    });

    it('guarantees FIFO order for concurrently subscribed send$ calls', async () => {
      const { stream } = makeStream();
      let releaseFirst!: () => void;
      const firstPending = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let chunkIndex = 0;
      const { stream: writable, writes } = makeRecordingWritable(async () => {
        if (chunkIndex === 0) {
          chunkIndex += 1;
          await firstPending;
        }
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const first = firstValueFrom(session.send$('a'));
      const second = firstValueFrom(session.send$('b'));
      const third = firstValueFrom(session.send$('c'));

      await flushMicrotasks();
      expect(writes.map((buf) => new TextDecoder().decode(buf))).toEqual(['a']);

      releaseFirst();
      await Promise.all([first, second, third]);

      expect(writes.map((buf) => new TextDecoder().decode(buf))).toEqual([
        'a',
        'b',
        'c',
      ]);
    });

    it('maps writer failures to WRITE_FAILED and emits them on errors$', async () => {
      const { stream } = makeStream();
      const writable = new WritableStream<Uint8Array>({
        write() {
          return Promise.reject(new Error('write rejected'));
        },
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorsPromise = firstValueFrom(session.errors$);

      await expect(firstValueFrom(session.send$('x'))).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.WRITE_FAILED,
      });

      const emitted = await errorsPromise;
      expect(emitted).toBeInstanceOf(SerialError);
      expect(emitted.code).toBe(SerialErrorCode.WRITE_FAILED);
    });
  });

  describe('errors$ integration (#204)', () => {
    it('emits the same SerialError instance on errors$ and to the connect$ subscriber', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      port.open.mockRejectedValueOnce(new Error('cannot open'));
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const subscription = session.errors$.subscribe((error) => {
        emissions.push(error);
      });

      try {
        const rejection = await firstValueFrom(session.connect$()).catch(
          (error: unknown) => error as SerialError,
        );

        expect(rejection).toBeInstanceOf(SerialError);
        expect(emissions).toHaveLength(1);
        expect(emissions[0]).toBe(rejection);
        expect(emissions[0].code).toBe(SerialErrorCode.PORT_OPEN_FAILED);
      } finally {
        subscription.unsubscribe();
      }
    });

    it('does not mutate state$ when a write fails (non-fatal)', async () => {
      const { stream } = makeStream();
      const writable = new WritableStream<Uint8Array>({
        write() {
          return Promise.reject(new Error('write rejected'));
        },
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      await expect(firstValueFrom(session.send$('x'))).rejects.toMatchObject({
        code: SerialErrorCode.WRITE_FAILED,
      });

      expect(await firstValueFrom(session.state$)).toBe<SerialSessionState>(
        S.Connected,
      );
    });

    it('routes close failures on disconnect$ to errors$ as CONNECTION_LOST and state -> error', async () => {
      const { stream } = makeStream();
      const close = vi.fn().mockRejectedValue(new Error('close failed'));
      const port = makeMockPort(stream, close);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorsPromise = firstValueFrom(session.errors$);

      await expect(
        firstValueFrom(session.disconnect$()),
      ).rejects.toMatchObject({
        name: 'SerialError',
        code: SerialErrorCode.CONNECTION_LOST,
      });

      const emitted = await errorsPromise;
      expect(emitted.code).toBe(SerialErrorCode.CONNECTION_LOST);
      expect(await firstValueFrom(session.state$)).toBe<SerialSessionState>(
        S.Error,
      );
    });

    it('forwards DOMException(NotFoundError) on requestPort as a single OPERATION_CANCELLED emission', async () => {
      const requestPort = vi
        .fn()
        .mockRejectedValue(new DOMException('cancel', 'NotFoundError'));
      Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        writable: true,
        value: { serial: { requestPort, getPorts: vi.fn() } },
      });

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const subscription = session.errors$.subscribe((error) => {
        emissions.push(error);
      });

      try {
        await expect(
          firstValueFrom(session.connect$()),
        ).rejects.toMatchObject({
          code: SerialErrorCode.OPERATION_CANCELLED,
        });

        expect(emissions).toHaveLength(1);
        expect(emissions[0].code).toBe(SerialErrorCode.OPERATION_CANCELLED);
      } finally {
        subscription.unsubscribe();
      }
    });

    it('multiplexes connect, pump, and write failures through the same errors$ channel', async () => {
      const { stream, controller } = makeStream();
      const writable = new WritableStream<Uint8Array>({
        write() {
          return Promise.reject(new Error('write rejected'));
        },
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const subscription = session.errors$.subscribe((error) => {
        emissions.push(error);
      });

      try {
        await firstValueFrom(session.connect$());

        await expect(
          firstValueFrom(session.send$('x')),
        ).rejects.toMatchObject({
          code: SerialErrorCode.WRITE_FAILED,
        });

        controller.error(new Error('device unplugged'));
        await flushMicrotasks();

        expect(emissions.map((error) => error.code)).toEqual([
          SerialErrorCode.WRITE_FAILED,
          SerialErrorCode.READ_FAILED,
        ]);
      } finally {
        subscription.unsubscribe();
      }
    });
  });
});

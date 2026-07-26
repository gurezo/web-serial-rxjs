/**
 * Lifecycle race-condition regression tests for SerialSession (#477).
 *
 * Timing is driven by deferred Promises (not wall-clock setTimeout races).
 * `flushMicrotasks` is only used to drain the microtask queue.
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/477
 */
import {
  filter,
  firstValueFrom,
  lastValueFrom,
  take,
  toArray,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSerialSession } from '../../src/session/create-serial-session';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '../../src/session/serial-session-state';

const S = SerialSessionStatus;

const stubPortInfo: SerialPortInfo = {
  usbVendorId: 0x1a86,
  usbProductId: 0x7523,
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

type MockPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
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
  stream: ReadableStream<Uint8Array> | null,
  close: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
  writable: WritableStream<Uint8Array> | null = null,
): MockPort => ({
  readable: stream,
  writable,
  open: vi.fn().mockResolvedValue(undefined),
  close,
  getInfo: vi.fn().mockReturnValue(stubPortInfo),
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

const installNavigatorWithRequestPort = (
  requestPort: ReturnType<typeof vi.fn>,
): void => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      serial: {
        requestPort,
        getPorts: vi.fn().mockResolvedValue([]),
      },
    },
  });
};

const flushMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

const connectedState = (): SerialSessionState => ({
  status: S.Connected,
  portInfo: stubPortInfo,
});

describe('lifecycle race conditions (#477)', () => {
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

  describe('connect$ / disconnect$ / dispose$ races', () => {
    it('returns to idle when disconnect$ is called while connect$ awaits requestPort', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      const requestPortGate = createDeferred<MockPort>();
      const requestPort = vi.fn().mockReturnValue(requestPortGate.promise);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const connectNext = vi.fn();
        const connectError = vi.fn();
        const connectSub = session.connect$().subscribe({
          next: connectNext,
          error: connectError,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );

        await expect(
          firstValueFrom(session.disconnect$()),
        ).resolves.toBeUndefined();
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });

        requestPortGate.resolve(port);
        await flushMicrotasks();

        // Expected: cancelled connect$ does not emit next; the Observable may
        // remain open until unsubscribe (no late connected transition).
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(connectNext).not.toHaveBeenCalled();
        expect(connectError).not.toHaveBeenCalled();
        expect(unhandled).toEqual([]);
        connectSub.unsubscribe();
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
    });

    it('reaches disposed when dispose$ is called while connect$ awaits requestPort', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      const requestPortGate = createDeferred<MockPort>();
      const requestPort = vi.fn().mockReturnValue(requestPortGate.promise);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const connectNext = vi.fn();
      const connectSub = session.connect$().subscribe({
        next: connectNext,
        error: () => undefined,
      });
      await firstValueFrom(
        session.state$.pipe(
          filter((s) => s.status === S.Connecting),
          take(1),
        ),
      );

      const states = lastValueFrom(session.state$.pipe(toArray()));
      await expect(firstValueFrom(session.dispose$())).resolves.toBeUndefined();

      requestPortGate.resolve(port);
      await flushMicrotasks();
      connectSub.unsubscribe();

      await expect(states).resolves.toEqual(
        expect.arrayContaining([
          { status: S.Connecting },
          { status: S.Disposed },
        ]),
      );
      expect(connectNext).not.toHaveBeenCalled();
      await expect(firstValueFrom(session.connect$())).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
    });

    it('completes concurrent disconnect$ calls while close is pending', async () => {
      const { stream } = makeStream();
      const closeGate = createDeferred<void>();
      const close = vi.fn().mockReturnValue(closeGate.promise);
      const port = makeMockPort(stream, close);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const first = firstValueFrom(session.disconnect$());
      const second = firstValueFrom(session.disconnect$());

      await expect(second).resolves.toBeUndefined();
      closeGate.resolve();
      await expect(first).resolves.toBeUndefined();

      expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
      expect(close).toHaveBeenCalledTimes(1);
    });

    it('completes concurrent dispose$ calls without leaving pending teardown', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const states = lastValueFrom(session.state$.pipe(toArray()));
      const first = firstValueFrom(session.dispose$());
      const second = firstValueFrom(session.dispose$());

      await expect(Promise.all([first, second])).resolves.toEqual([
        undefined,
        undefined,
      ]);
      await expect(states).resolves.toEqual([
        connectedState(),
        { status: S.Disposed },
      ]);
      expect(port.close).toHaveBeenCalledTimes(1);
      await expect(firstValueFrom(session.send$('x'))).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
    });
  });
});

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
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSerialSession } from '../../src/session/create-serial-session';
import * as readPumpModule from '../../src/session/read-pump';
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

        // Cancelled before open: do not open or close, and do not connect.
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
        expect(port.open).not.toHaveBeenCalled();
        expect(port.close).not.toHaveBeenCalled();
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

    it('does not apply a stale requestPort after unsubscribe and reconnect (#626)', async () => {
      const { stream: staleStream } = makeStream();
      const { stream: nextStream } = makeStream();
      const stalePort = makeMockPort(staleStream);
      const nextPort = makeMockPort(nextStream);
      const staleGate = createDeferred<MockPort>();
      const nextGate = createDeferred<MockPort>();
      const requestPort = vi
        .fn()
        .mockReturnValueOnce(staleGate.promise)
        .mockReturnValueOnce(nextGate.promise);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const staleNext = vi.fn();
        const staleError = vi.fn();
        const staleSub = session.connect$().subscribe({
          next: staleNext,
          error: staleError,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );

        staleSub.unsubscribe();
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });

        const nextNext = vi.fn();
        const nextError = vi.fn();
        const nextSub = session.connect$().subscribe({
          next: nextNext,
          error: nextError,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );

        expect(requestPort).toHaveBeenCalledTimes(1);

        staleGate.resolve(stalePort);
        await flushMicrotasks();

        expect(stalePort.open).not.toHaveBeenCalled();
        expect(stalePort.close).not.toHaveBeenCalled();
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Connecting,
        });
        expect(emissions).toEqual([]);
        expect(staleNext).not.toHaveBeenCalled();
        expect(staleError).not.toHaveBeenCalled();
        expect(requestPort).toHaveBeenCalledTimes(2);

        nextGate.resolve(nextPort);
        await flushMicrotasks();

        expect(await firstValueFrom(session.state$)).toEqual(connectedState());
        expect(nextPort.open).toHaveBeenCalledTimes(1);
        expect(nextPort.close).not.toHaveBeenCalled();
        expect(stalePort.open).not.toHaveBeenCalled();
        expect(nextNext).toHaveBeenCalledTimes(1);
        expect(nextError).not.toHaveBeenCalled();
        expect(unhandled).toEqual([]);
        nextSub.unsubscribe();
      } finally {
        process.off('unhandledRejection', onUnhandled);
        errorsSub.unsubscribe();
      }
    });

    it('ignores a stale requestPort rejection after reconnect (#626)', async () => {
      const { stream } = makeStream();
      const nextPort = makeMockPort(stream);
      const staleGate = createDeferred<MockPort>();
      const nextGate = createDeferred<MockPort>();
      const requestPort = vi
        .fn()
        .mockReturnValueOnce(staleGate.promise)
        .mockReturnValueOnce(nextGate.promise);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const staleSub = session.connect$().subscribe({
          error: () => undefined,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );
        staleSub.unsubscribe();

        const nextNext = vi.fn();
        const nextError = vi.fn();
        const nextSub = session.connect$().subscribe({
          next: nextNext,
          error: nextError,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );

        staleGate.reject(new Error('stale requestPort failed'));
        await flushMicrotasks();

        expect(emissions).toEqual([]);
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Connecting,
        });
        expect(nextError).not.toHaveBeenCalled();
        expect(unhandled).toEqual([]);

        nextGate.resolve(nextPort);
        await flushMicrotasks();

        expect(await firstValueFrom(session.state$)).toEqual(connectedState());
        expect(nextPort.open).toHaveBeenCalledTimes(1);
        expect(nextNext).toHaveBeenCalledTimes(1);
        expect(emissions).toEqual([]);
        nextSub.unsubscribe();
      } finally {
        process.off('unhandledRejection', onUnhandled);
        errorsSub.unsubscribe();
      }
    });

    it('releases a port opened by a stale connect without overwriting the newer attempt (#626)', async () => {
      const { stream: staleStream } = makeStream();
      const { stream: nextStream } = makeStream();
      const stalePort = makeMockPort(staleStream);
      const nextPort = makeMockPort(nextStream);
      const openGate = createDeferred<void>();
      stalePort.open.mockReturnValue(openGate.promise);
      const staleGate = createDeferred<MockPort>();
      const nextGate = createDeferred<MockPort>();
      const requestPort = vi
        .fn()
        .mockReturnValueOnce(staleGate.promise)
        .mockReturnValueOnce(nextGate.promise);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const staleNext = vi.fn();
        const staleSub = session.connect$().subscribe({
          next: staleNext,
          error: () => undefined,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );

        staleGate.resolve(stalePort);
        await flushMicrotasks();
        expect(stalePort.open).toHaveBeenCalledTimes(1);

        staleSub.unsubscribe();
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });

        const nextNext = vi.fn();
        const nextSub = session.connect$().subscribe({
          next: nextNext,
          error: () => undefined,
        });
        await firstValueFrom(
          session.state$.pipe(
            filter((s) => s.status === S.Connecting),
            take(1),
          ),
        );
        expect(requestPort).toHaveBeenCalledTimes(1);

        openGate.resolve();
        await flushMicrotasks();

        expect(stalePort.close).toHaveBeenCalledTimes(1);
        expect(staleNext).not.toHaveBeenCalled();
        expect(emissions).toEqual([]);
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Connecting,
        });
        expect(requestPort).toHaveBeenCalledTimes(2);
        expect(unhandled).toEqual([]);

        nextGate.resolve(nextPort);
        await flushMicrotasks();

        expect(await firstValueFrom(session.state$)).toEqual(connectedState());
        expect(nextPort.open).toHaveBeenCalledTimes(1);
        expect(nextPort.close).not.toHaveBeenCalled();
        expect(nextNext).toHaveBeenCalledTimes(1);
        nextSub.unsubscribe();
      } finally {
        process.off('unhandledRejection', onUnhandled);
        errorsSub.unsubscribe();
      }
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

  describe('send$ / read-pump races', () => {
    it('disconnect$ while send$ write is in flight reaches idle without unhandled rejection', async () => {
      const { stream } = makeStream();
      const writeGate = createDeferred<void>();
      const { stream: writable, writes } = makeRecordingWritable(async () => {
        await writeGate.promise;
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown) => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);

      try {
        const sendSettled = firstValueFrom(session.send$('payload')).then(
          () => ({ kind: 'next' as const }),
          (error: unknown) => ({ kind: 'error' as const, error }),
        );
        await flushMicrotasks();
        expect(writes).toHaveLength(1);

        await expect(
          firstValueFrom(session.disconnect$()),
        ).resolves.toBeUndefined();
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
        expect(port.close).toHaveBeenCalledTimes(1);

        writeGate.resolve();
        await flushMicrotasks();
        // Expected: in-flight write is not aborted by disconnect$; it settles
        // when the writer finishes. New sends after disconnect fail.
        const sendResult = await sendSettled;
        expect(sendResult.kind === 'next' || sendResult.kind === 'error').toBe(
          true,
        );
        expect(unhandled).toEqual([]);
        await expect(firstValueFrom(session.send$('again'))).rejects.toMatchObject({
          code: SerialErrorCode.PORT_NOT_OPEN,
        });
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
    });

    it('dispose$ while send$ write is in flight reaches disposed and rejects later send$', async () => {
      const { stream } = makeStream();
      const writeGate = createDeferred<void>();
      const { stream: writable, writes } = makeRecordingWritable(async () => {
        await writeGate.promise;
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const states = lastValueFrom(session.state$.pipe(toArray()));
      const sendSettled = firstValueFrom(session.send$('payload')).then(
        () => ({ kind: 'next' as const }),
        (error: unknown) => ({ kind: 'error' as const, error }),
      );
      await flushMicrotasks();
      expect(writes).toHaveLength(1);

      await expect(firstValueFrom(session.dispose$())).resolves.toBeUndefined();
      writeGate.resolve();
      await flushMicrotasks();

      await expect(states).resolves.toEqual([
        connectedState(),
        { status: S.Disposed },
      ]);
      expect(port.close).toHaveBeenCalledTimes(1);
      const sendResult = await sendSettled;
      expect(sendResult.kind === 'next' || sendResult.kind === 'error').toBe(
        true,
      );
      await expect(firstValueFrom(session.send$('again'))).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
    });

    it('writer lock is released when disconnect$ runs after writer is acquired mid-write', async () => {
      const { stream } = makeStream();
      const writeGate = createDeferred<void>();
      let writeStarted!: () => void;
      const writeStartedPromise = new Promise<void>((resolve) => {
        writeStarted = resolve;
      });
      const { stream: writable } = makeRecordingWritable(async () => {
        writeStarted();
        await writeGate.promise;
      });
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const sendSettled = firstValueFrom(session.send$('x')).then(
        () => undefined,
        () => undefined,
      );
      await writeStartedPromise;

      await firstValueFrom(session.disconnect$());
      writeGate.resolve();
      await sendSettled;
      await flushMicrotasks();

      // WritableStreamDefaultWriter.releaseLock must have run so a second
      // connect can obtain a writer again.
      expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
      const { stream: stream2 } = makeStream();
      const { stream: writable2, writes: writes2 } = makeRecordingWritable();
      const port2 = makeMockPort(stream2, undefined, writable2);
      (
        navigator.serial.requestPort as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(port2);

      await firstValueFrom(session.connect$());
      await firstValueFrom(session.send$('y'));
      expect(writes2.map((buf) => new TextDecoder().decode(buf))).toEqual(['y']);
    });

    it('drops a queued send on disconnect without overlapping the next session send', async () => {
      const { stream } = makeStream();
      const writeGate = createDeferred<void>();
      let activeWrites = 0;
      let maxActiveWrites = 0;
      const trackWrite = async (waitFor?: Promise<void>): Promise<void> => {
        activeWrites += 1;
        maxActiveWrites = Math.max(maxActiveWrites, activeWrites);
        try {
          await waitFor;
        } finally {
          activeWrites -= 1;
        }
      };
      const { stream: writable, writes } = makeRecordingWritable(() =>
        trackWrite(writeGate.promise),
      );
      const port = makeMockPort(stream, undefined, writable);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errors: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        errors.push(error);
      });

      const sendA = firstValueFrom(session.send$('a')).then(
        () => undefined,
        () => undefined,
      );
      await flushMicrotasks();
      expect(writes.map((buf) => new TextDecoder().decode(buf))).toEqual(['a']);

      let queuedError: unknown;
      let queuedErrored = false;
      session.send$('b').subscribe({
        error: (error: unknown) => {
          queuedErrored = true;
          queuedError = error;
        },
      });
      await flushMicrotasks();

      await expect(
        firstValueFrom(session.disconnect$()),
      ).resolves.toBeUndefined();
      await flushMicrotasks();

      expect(queuedErrored).toBe(true);
      expect(queuedError).toBeInstanceOf(SerialError);
      expect(queuedError).toMatchObject({
        code: SerialErrorCode.PORT_NOT_OPEN,
      });
      expect(errors.map((error) => error.code)).not.toContain(
        SerialErrorCode.PORT_NOT_OPEN,
      );
      expect(maxActiveWrites).toBe(1);

      const { stream: stream2 } = makeStream();
      const { stream: writable2, writes: writes2 } = makeRecordingWritable(() =>
        trackWrite(),
      );
      const port2 = makeMockPort(stream2, undefined, writable2);
      (
        navigator.serial.requestPort as ReturnType<typeof vi.fn>
      ).mockResolvedValueOnce(port2);

      await firstValueFrom(session.connect$());
      const sendC = firstValueFrom(session.send$('c'));
      await flushMicrotasks();

      expect(writes2).toHaveLength(0);
      expect(maxActiveWrites).toBe(1);

      writeGate.resolve();
      await sendA;
      await sendC;
      await flushMicrotasks();

      expect(writes.map((buf) => new TextDecoder().decode(buf))).toEqual(['a']);
      expect(writes2.map((buf) => new TextDecoder().decode(buf))).toEqual(['c']);
      expect(maxActiveWrites).toBe(1);
      expect(errors.map((error) => error.code)).not.toContain(
        SerialErrorCode.PORT_NOT_OPEN,
      );
      errorsSub.unsubscribe();
    });

    it('dispose$ during read-pump fatal error handling reaches disposed', async () => {
      const { stream, controller } = makeStream();
      const closeGate = createDeferred<void>();
      const close = vi.fn().mockReturnValue(closeGate.promise);
      const port = makeMockPort(stream, close);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const states = lastValueFrom(session.state$.pipe(toArray()));
      const errors = firstValueFrom(session.errors$);

      controller.error(new Error('device unplugged'));
      const emitted = await errors;
      expect(emitted.code).toBe(SerialErrorCode.READ_FAILED);

      // Race: dispose while fatal pump error teardown still awaits close().
      const disposeDone = firstValueFrom(session.dispose$());
      closeGate.resolve();
      await expect(disposeDone).resolves.toBeUndefined();

      await expect(states).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: S.Error }),
          { status: S.Disposed },
        ]),
      );
      await expect(firstValueFrom(session.connect$())).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
    });
  });

  describe('reconnect and post-dispose races', () => {
    it('allows connect$ again after a failed open', async () => {
      const { stream: stream1 } = makeStream();
      const failingPort = makeMockPort(stream1);
      failingPort.open.mockRejectedValueOnce(new Error('open failed'));

      const { stream: stream2 } = makeStream();
      const okPort = makeMockPort(stream2);

      const requestPort = vi
        .fn()
        .mockResolvedValueOnce(failingPort)
        .mockResolvedValueOnce(okPort);
      installNavigatorWithRequestPort(requestPort);

      const session = createSerialSession();
      const errors = firstValueFrom(session.errors$);

      await expect(firstValueFrom(session.connect$())).rejects.toMatchObject({
        code: SerialErrorCode.PORT_OPEN_FAILED,
      });
      expect((await errors).code).toBe(SerialErrorCode.PORT_OPEN_FAILED);
      expect(await firstValueFrom(session.state$)).toEqual(
        expect.objectContaining({ status: S.Error }),
      );

      await expect(firstValueFrom(session.connect$())).resolves.toBeUndefined();
      expect(await firstValueFrom(session.state$)).toEqual(connectedState());
      expect(okPort.close).not.toHaveBeenCalled();
    });

    it('rejects connect$ and closes the port when readable is missing after open', async () => {
      const { stream } = makeStream();
      // After open succeeds, readable becomes unavailable so pump.start()
      // reports CONNECTION_LOST before the session transitions to connected.
      const port: MockPort = {
        readable: stream,
        writable: null,
        open: vi.fn().mockImplementation(async () => {
          port.readable = null;
        }),
        close: vi.fn().mockResolvedValue(undefined),
        getInfo: vi.fn().mockReturnValue(stubPortInfo),
      };
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const connectResult = firstValueFrom(session.connect$()).then(
        () => ({ kind: 'next' as const }),
        (error: unknown) => ({ kind: 'error' as const, error }),
      );

      const settled = await connectResult;
      await flushMicrotasks();

      expect(emissions).toHaveLength(1);
      const emitted = emissions[0];
      expect(emitted?.code).toBe(SerialErrorCode.CONNECTION_LOST);
      expect(settled).toEqual({ kind: 'error', error: emitted });
      expect(await firstValueFrom(session.state$)).toEqual({
        status: S.Error,
        error: emitted,
      });
      expect(port.close).toHaveBeenCalledTimes(1);
      errorsSub.unsubscribe();
    });

    it('rejects connect$ and send$ after dispose$ completes with SESSION_DISPOSED', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const states = lastValueFrom(session.state$.pipe(toArray()));
      await expect(firstValueFrom(session.dispose$())).resolves.toBeUndefined();
      await expect(states).resolves.toEqual([
        connectedState(),
        { status: S.Disposed },
      ]);

      await expect(firstValueFrom(session.connect$())).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
      await expect(firstValueFrom(session.send$('x'))).rejects.toMatchObject({
        code: SerialErrorCode.SESSION_DISPOSED,
      });
      // dispose must not start new port work afterward
      expect(port.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('connect$ failures after open (#625)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const trackUnhandled = (): {
      unhandled: unknown[];
      stop: () => void;
    } => {
      const unhandled: unknown[] = [];
      const onUnhandled = (reason: unknown): void => {
        unhandled.push(reason);
      };
      process.on('unhandledRejection', onUnhandled);
      return {
        unhandled,
        stop: () => {
          process.off('unhandledRejection', onUnhandled);
        },
      };
    };

    it('rejects connect$ once and closes the port when createReadPump throws', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);
      vi.spyOn(readPumpModule, 'createReadPump').mockImplementation(() => {
        throw new Error('createReadPump failed');
      });

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const connectError = vi.fn();
      const { unhandled, stop } = trackUnhandled();

      try {
        session.connect$().subscribe({ error: connectError });
        await flushMicrotasks();

        expect(unhandled).toEqual([]);
        expect(connectError).toHaveBeenCalledTimes(1);
        const reported = connectError.mock.calls[0]?.[0] as SerialError;
        expect(reported).toBeInstanceOf(SerialError);
        expect(reported.code).toBe(SerialErrorCode.UNKNOWN);
        expect(emissions).toEqual([reported]);
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Error,
          error: reported,
        });
      } finally {
        stop();
        errorsSub.unsubscribe();
      }
    });

    it('stops the pump and closes the port when pump.start throws', async () => {
      const { stream } = makeStream();
      const order: string[] = [];
      const port = makeMockPort(stream);
      port.close.mockImplementation(async () => {
        order.push('close');
      });
      installNavigator(port);

      const stop = vi.fn(async () => {
        order.push('stop');
      });
      vi.spyOn(readPumpModule, 'createReadPump').mockReturnValue({
        start(): void {
          throw new Error('pump start failed');
        },
        stop,
        get isRunning() {
          return false;
        },
      });

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const connectError = vi.fn();
      const { unhandled, stop: stopTracking } = trackUnhandled();

      try {
        session.connect$().subscribe({ error: connectError });
        await flushMicrotasks();

        expect(unhandled).toEqual([]);
        expect(connectError).toHaveBeenCalledTimes(1);
        const reported = connectError.mock.calls[0]?.[0] as SerialError;
        expect(reported).toBeInstanceOf(SerialError);
        expect(reported.code).toBe(SerialErrorCode.UNKNOWN);
        expect(emissions).toEqual([reported]);
        expect(order).toEqual(['stop', 'close']);
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Error,
          error: reported,
        });
      } finally {
        stopTracking();
        errorsSub.unsubscribe();
      }
    });

    it('rejects connect$ and closes the port when getInfo throws during connect', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      port.getInfo.mockImplementation(() => {
        throw new Error('getInfo failed');
      });
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const connectError = vi.fn();
      const { unhandled, stop } = trackUnhandled();

      try {
        session.connect$().subscribe({ error: connectError });
        await flushMicrotasks();

        expect(unhandled).toEqual([]);
        expect(connectError).toHaveBeenCalledTimes(1);
        const reported = connectError.mock.calls[0]?.[0] as SerialError;
        expect(reported).toBeInstanceOf(SerialError);
        expect(reported.code).toBe(SerialErrorCode.UNKNOWN);
        expect(emissions).toEqual([reported]);
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(await firstValueFrom(session.state$)).toEqual({
          status: S.Error,
          error: reported,
        });
      } finally {
        stop();
        errorsSub.unsubscribe();
      }
    });

    it('keeps idle and closes the port when connect$ is unsubscribed as createReadPump throws', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const connectNext = vi.fn();
      const connectError = vi.fn();
      let connectSub!: { unsubscribe: () => void };
      vi.spyOn(readPumpModule, 'createReadPump').mockImplementation(() => {
        connectSub.unsubscribe();
        throw new Error('createReadPump failed');
      });
      const { unhandled, stop } = trackUnhandled();

      try {
        connectSub = session.connect$().subscribe({
          next: connectNext,
          error: connectError,
        });
        await flushMicrotasks();

        expect(unhandled).toEqual([]);
        expect(connectNext).not.toHaveBeenCalled();
        expect(connectError).not.toHaveBeenCalled();
        expect(emissions).toEqual([]);
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
      } finally {
        stop();
        errorsSub.unsubscribe();
      }
    });

    it('keeps disposed and closes the port when dispose$ runs as createReadPump throws', async () => {
      const { stream } = makeStream();
      const port = makeMockPort(stream);
      installNavigator(port);

      const session = createSerialSession();
      const emissions: SerialError[] = [];
      const errorsSub = session.errors$.subscribe((error) => {
        emissions.push(error);
      });
      const states: SerialSessionState[] = [];
      const stateSub = session.state$.subscribe((state) => {
        states.push(state);
      });
      const connectNext = vi.fn();
      const connectError = vi.fn();
      vi.spyOn(readPumpModule, 'createReadPump').mockImplementation(() => {
        session.dispose$().subscribe({ error: () => undefined });
        throw new Error('createReadPump failed');
      });
      const { unhandled, stop } = trackUnhandled();

      try {
        session.connect$().subscribe({
          next: connectNext,
          error: connectError,
        });
        await flushMicrotasks();

        expect(unhandled).toEqual([]);
        expect(connectNext).not.toHaveBeenCalled();
        expect(connectError).not.toHaveBeenCalled();
        expect(emissions).toEqual([]);
        expect(port.close).toHaveBeenCalledTimes(1);
        expect(states.at(-1)).toEqual({ status: S.Disposed });
      } finally {
        stop();
        errorsSub.unsubscribe();
        stateSub.unsubscribe();
      }
    });
  });
});

/**
 * Lifecycle race-condition regression tests for SerialSession (#477).
 *
 * Timing is driven by deferred Promises (not wall-clock setTimeout races).
 * `flushMicrotasks` is only used to drain the microtask queue.
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/477
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('exposes deferred harness helpers for race orchestration', () => {
    const gate = createDeferred<void>();
    const { stream, controller } = makeStream();
    const { stream: writable, writes } = makeRecordingWritable(async () => {
      await gate.promise;
    });
    const port = makeMockPort(stream, undefined, writable);

    expect(gate.promise).toBeInstanceOf(Promise);
    expect(controller).toBeDefined();
    expect(writes).toEqual([]);
    expect(port.readable).toBe(stream);
    expect(typeof flushMicrotasks).toBe('function');
    expect(typeof installNavigator).toBe('function');
    expect(typeof installNavigatorWithRequestPort).toBe('function');
    expect(connectedState()).toEqual({
      status: S.Connected,
      portInfo: stubPortInfo,
    });

    gate.resolve();
  });
});

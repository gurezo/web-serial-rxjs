import { expect, vi } from 'vitest';

export const stubPortInfo: SerialPortInfo = {
  usbVendorId: 0x1a86,
  usbProductId: 0x7523,
};

export type MockPort = {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  getInfo: ReturnType<typeof vi.fn>;
};

export type StreamHandle = {
  stream: ReadableStream<Uint8Array>;
  controller: ReadableStreamDefaultController<Uint8Array>;
};

export type ReaderSpies = {
  cancel: ReturnType<typeof vi.fn>;
  releaseLock: ReturnType<typeof vi.fn>;
};

export type StreamWithReaderSpy = StreamHandle & {
  readerSpies: ReaderSpies[];
};

export type ResourceTracker = {
  readerSpies: ReaderSpies[];
  portClose: ReturnType<typeof vi.fn>;
};

export type ResourceReleaseExpectation = {
  readerCount: number;
  cancelPerReader?: number;
  releaseLockPerReader?: number;
  portCloseCount: number;
};

export const makeStream = (): StreamHandle => {
  let captured!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      captured = controller;
    },
  });
  return { stream, controller: captured };
};

export const makeStreamWithReaderSpy = (): StreamWithReaderSpy => {
  const readerSpies: ReaderSpies[] = [];
  let captured!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      captured = controller;
    },
  });

  vi.spyOn(stream, 'getReader').mockImplementation(function (
    this: ReadableStream<Uint8Array>,
  ) {
    const reader = ReadableStream.prototype.getReader.call(this);
    const originalCancel = reader.cancel.bind(reader);
    const cancelSpy = vi.fn((reason?: unknown) => originalCancel(reason));
    reader.cancel = cancelSpy;

    const originalReleaseLock = reader.releaseLock.bind(reader);
    const releaseLockSpy = vi.fn(() => originalReleaseLock());
    reader.releaseLock = releaseLockSpy;

    readerSpies.push({ cancel: cancelSpy, releaseLock: releaseLockSpy });
    return reader;
  });

  return { stream, controller: captured, readerSpies };
};

export const makeMockPort = (
  stream: ReadableStream<Uint8Array>,
  close: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined),
  writable: WritableStream<Uint8Array> | null = null,
): MockPort => ({
  readable: stream,
  writable,
  open: vi.fn().mockResolvedValue(undefined),
  close,
  getInfo: vi.fn().mockReturnValue(stubPortInfo),
});

export const installNavigator = (port: MockPort): void => {
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

export const installNavigatorWithRequestPort = (
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

export const flushMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

export const createResourceTracker = (
  streamWithSpy: StreamWithReaderSpy,
  port: MockPort,
): ResourceTracker => ({
  readerSpies: streamWithSpy.readerSpies,
  portClose: port.close,
});

export const assertResourceReleased = (
  tracker: ResourceTracker,
  expected: ResourceReleaseExpectation,
): void => {
  const cancelPerReader = expected.cancelPerReader ?? 1;
  const releaseLockPerReader = expected.releaseLockPerReader ?? 1;

  expect(tracker.readerSpies).toHaveLength(expected.readerCount);

  for (const readerSpy of tracker.readerSpies) {
    expect(readerSpy.cancel).toHaveBeenCalledTimes(cancelPerReader);
    expect(readerSpy.releaseLock).toHaveBeenCalledTimes(releaseLockPerReader);
  }

  expect(tracker.portClose).toHaveBeenCalledTimes(expected.portCloseCount);
};

export const resetNavigator = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: Reset navigator for isolation
  delete (globalThis as any).navigator;
};

export const restoreNavigator = (
  originalDescriptor: PropertyDescriptor | undefined,
): void => {
  if (originalDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    return;
  }
  resetNavigator();
};

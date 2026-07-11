import { describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createReadPump } from '../../src/session/read-pump';

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

const makePort = (
  overrides: Partial<SerialPort> & {
    readable?: ReadableStream<Uint8Array> | null;
  } = {},
): SerialPort => {
  const { readable = null, ...rest } = overrides;
  return {
    readable,
    writable: null,
    ...rest,
  } as unknown as SerialPort;
};

const flushMicrotasks = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};

describe('createReadPump', () => {
  it('decodes enqueued chunks to strings and forwards them to onChunk', async () => {
    const { stream, controller } = makeStream();
    const port = makePort({ readable: stream });
    const chunks: string[] = [];
    const onError = vi.fn();

    const pump = createReadPump(port, {
      onChunk: (text) => chunks.push(text),
      onError,
    });
    pump.start();

    controller.enqueue(new TextEncoder().encode('hello'));
    controller.enqueue(new TextEncoder().encode(' world'));
    await flushMicrotasks();

    expect(chunks).toEqual(['hello', ' world']);
    expect(onError).not.toHaveBeenCalled();
    expect(pump.isRunning).toBe(true);

    await pump.stop();
  });

  it('joins multi-byte characters split across chunk boundaries', async () => {
    const { stream, controller } = makeStream();
    const port = makePort({ readable: stream });
    const chunks: string[] = [];

    const pump = createReadPump(port, {
      onChunk: (text) => chunks.push(text),
      onError: vi.fn(),
    });
    pump.start();

    const encoded = new TextEncoder().encode('あ');
    controller.enqueue(encoded.slice(0, 1));
    await flushMicrotasks();
    controller.enqueue(encoded.slice(1));
    await flushMicrotasks();

    expect(chunks.join('')).toBe('あ');

    await pump.stop();
  });

  it('emits a READ_FAILED SerialError to onError when the stream errors', async () => {
    const { stream, controller } = makeStream();
    const port = makePort({ readable: stream });
    const onError = vi.fn<(error: SerialError) => void>();

    const pump = createReadPump(port, {
      onChunk: vi.fn(),
      onError,
    });
    pump.start();

    controller.error(new Error('boom'));
    await flushMicrotasks();

    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0];
    expect(call).toBeDefined();
    const received = call?.[0];
    expect(received).toBeInstanceOf(SerialError);
    if (received instanceof SerialError) {
      expect(received.code).toBe(SerialErrorCode.READ_FAILED);
      expect(received.message).toContain('boom');
    }
    expect(pump.isRunning).toBe(false);
  });

  it('emits a CONNECTION_LOST SerialError when port.readable is null', () => {
    const port = makePort({ readable: null });
    const onError = vi.fn<(error: SerialError) => void>();

    const pump = createReadPump(port, {
      onChunk: vi.fn(),
      onError,
    });
    pump.start();

    expect(onError).toHaveBeenCalledTimes(1);
    const call = onError.mock.calls[0];
    expect(call).toBeDefined();
    const received = call?.[0];
    expect(received).toBeInstanceOf(SerialError);
    if (received instanceof SerialError) {
      expect(received.code).toBe(SerialErrorCode.CONNECTION_LOST);
    }
    expect(pump.isRunning).toBe(false);
  });

  it('notifies onDone when the stream ends with done:true', async () => {
    const { stream, controller } = makeStream();
    const port = makePort({ readable: stream });
    const onDone = vi.fn();
    const onError = vi.fn();

    const pump = createReadPump(port, {
      onChunk: vi.fn(),
      onError,
      onDone,
    });
    pump.start();

    controller.close();
    await flushMicrotasks();

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    expect(pump.isRunning).toBe(false);
  });

  it('stop() cancels the reader and suppresses further onError emissions', async () => {
    const { stream, controller } = makeStream();
    const port = makePort({ readable: stream });
    const onError = vi.fn();
    const chunks: string[] = [];

    const pump = createReadPump(port, {
      onChunk: (text) => chunks.push(text),
      onError,
    });
    pump.start();
    controller.enqueue(new TextEncoder().encode('before-stop'));
    await flushMicrotasks();

    await pump.stop();

    expect(pump.isRunning).toBe(false);
    expect(() => controller.enqueue(new TextEncoder().encode('after-stop'))).toThrow();
    expect(chunks).toEqual(['before-stop']);
    expect(onError).not.toHaveBeenCalled();
  });

  it('start() is a no-op when the pump has already been stopped', async () => {
    const { stream } = makeStream();
    const port = makePort({ readable: stream });

    const pump = createReadPump(port, {
      onChunk: vi.fn(),
      onError: vi.fn(),
    });

    await pump.stop();
    pump.start();

    expect(pump.isRunning).toBe(false);
  });
});

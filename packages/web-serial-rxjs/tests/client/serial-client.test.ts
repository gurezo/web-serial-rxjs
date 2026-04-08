import { defaultIfEmpty, firstValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSerialClient } from '../../src/client';

describe('serial-client', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  beforeEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { serial: {} },
    });
  });

  afterEach(() => {
    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing: cleanup mocked navigator
    delete (globalThis as any).navigator;
  });

  it('returns shared read stream instance and broadcasts chunks', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(nextController) {
        controller = nextController;
      },
    });
    const writable = new WritableStream<Uint8Array>({});
    const port = {
      readable,
      writable,
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as SerialPort;

    const client = createSerialClient();
    await firstValueFrom(client.connect(port).pipe(defaultIfEmpty(undefined)));

    const streamA = client.getReadStream();
    const streamB = client.getReadStream();
    expect(streamA).toBe(streamB);

    const promiseA = firstValueFrom(streamA.pipe(take(1)));
    const promiseB = firstValueFrom(streamB.pipe(take(1)));
    controller!.enqueue(new Uint8Array([65]));

    await expect(promiseA).resolves.toEqual(new Uint8Array([65]));
    await expect(promiseB).resolves.toEqual(new Uint8Array([65]));
  });

  it('decodes text stream and writes text', async () => {
    const writes: Uint8Array[] = [];
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const readable = new ReadableStream<Uint8Array>({
      start(nextController) {
        controller = nextController;
      },
    });
    const writable = new WritableStream<Uint8Array>({
      write(chunk) {
        writes.push(chunk);
      },
    });
    const port = {
      readable,
      writable,
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as SerialPort;

    const client = createSerialClient();
    await firstValueFrom(client.connect(port).pipe(defaultIfEmpty(undefined)));

    const textValuesPromise = firstValueFrom(
      client.getReadStreamAsText().pipe(take(2), toArray()),
    );
    controller!.enqueue(new Uint8Array([0xe2, 0x82]));
    controller!.enqueue(new Uint8Array([0xac]));
    await expect(textValuesPromise).resolves.toEqual(['', '€']);

    await firstValueFrom(client.writeText('ok').pipe(defaultIfEmpty(undefined)));
    expect(new TextDecoder().decode(writes[0])).toBe('ok');
  });

  it('emits reactive connection states and events', async () => {
    const readable = new ReadableStream<Uint8Array>({});
    const writable = new WritableStream<Uint8Array>({});
    const port = {
      readable,
      writable,
      open: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as SerialPort;

    const client = createSerialClient();
    const statesPromise = firstValueFrom(client.connected$.pipe(take(3), toArray()));
    const eventsPromise = firstValueFrom(
      client.connectionEvents$.pipe(take(2), toArray()),
    );

    await firstValueFrom(client.connect(port).pipe(defaultIfEmpty(undefined)));
    await firstValueFrom(client.disconnect().pipe(defaultIfEmpty(undefined)));

    await expect(statesPromise).resolves.toEqual([false, true, false]);
    await expect(eventsPromise).resolves.toEqual(['connected', 'disconnected']);
  });
});

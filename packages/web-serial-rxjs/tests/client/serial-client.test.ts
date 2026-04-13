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

  it('broadcasts bytes$ chunks while connected', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
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

    const streamA = client.bytes$;
    const streamB = client.bytes$;

    const promiseA = firstValueFrom(streamA.pipe(take(1)));
    const promiseB = firstValueFrom(streamB.pipe(take(1)));
    if (!controller) {
      throw new Error('Readable stream controller was not initialized');
    }
    controller.enqueue(new Uint8Array([65]));

    await expect(promiseA).resolves.toEqual(new Uint8Array([65]));
    await expect(promiseB).resolves.toEqual(new Uint8Array([65]));
  });

  it('decodes text$ stream and writes text', async () => {
    const writes: Uint8Array[] = [];
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
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
      client.text$.pipe(take(2), toArray()),
    );
    if (!controller) {
      throw new Error('Readable stream controller was not initialized');
    }
    controller.enqueue(new Uint8Array([0xe2, 0x82]));
    controller.enqueue(new Uint8Array([0xac]));
    await expect(textValuesPromise).resolves.toEqual(['', '€']);

    await firstValueFrom(client.writeText('ok').pipe(defaultIfEmpty(undefined)));
    expect(new TextDecoder().decode(writes[0])).toBe('ok');
  });

  it('parses newline-delimited lines$ across chunk boundaries', async () => {
    let controller: ReadableStreamDefaultController<Uint8Array> | undefined;
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

    const linesPromise = firstValueFrom(client.lines$.pipe(take(3), toArray()));
    if (!controller) {
      throw new Error('Readable stream controller was not initialized');
    }
    controller.enqueue(new TextEncoder().encode('foo\r'));
    controller.enqueue(new TextEncoder().encode('\nbar\nbaz'));
    controller.enqueue(new TextEncoder().encode('\n'));

    await expect(linesPromise).resolves.toEqual(['foo', 'bar', 'baz']);
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
    const serialStatesPromise = firstValueFrom(client.state$.pipe(take(4), toArray()));
    const statesPromise = firstValueFrom(client.connected$.pipe(take(3), toArray()));
    const eventsPromise = firstValueFrom(
      client.connectionEvents$.pipe(take(2), toArray()),
    );

    await firstValueFrom(client.connect(port).pipe(defaultIfEmpty(undefined)));
    await firstValueFrom(client.disconnect().pipe(defaultIfEmpty(undefined)));

    await expect(serialStatesPromise).resolves.toEqual([
      { kind: 'idle' },
      { kind: 'connecting' },
      { kind: 'connected' },
      { kind: 'disconnecting' },
    ]);
    await expect(statesPromise).resolves.toEqual([false, true, false]);
    await expect(eventsPromise).resolves.toEqual(['connected', 'disconnected']);
  });

  it('emits unsupported state and errors in unsupported browsers', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: {},
    });

    const client = createSerialClient();
    const support = client.support();
    expect(support.supported).toBe(false);

    const statePromise = firstValueFrom(client.state$.pipe(take(1)));
    await expect(statePromise).resolves.toMatchObject({
      kind: 'unsupported',
      support: { supported: false },
    });

    const errorsPromise = firstValueFrom(client.errors$.pipe(take(1)));
    await expect(
      firstValueFrom(client.connect().pipe(defaultIfEmpty(undefined))),
    ).rejects.toMatchObject({
      name: 'SerialError',
      code: 'BROWSER_NOT_SUPPORTED',
    });
    await expect(errorsPromise).resolves.toMatchObject({
      code: 'BROWSER_NOT_SUPPORTED',
    });
  });
});

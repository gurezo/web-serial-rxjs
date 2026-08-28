import { describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import {
  captureResources,
  createPortTeardown,
} from '../../src/session/internal/port-teardown';
import type { ReadPump } from '../../src/session/read-pump';
import type { ReceivePipeline } from '../../src/session/internal/receive-pipeline';
import type { SendQueue } from '../../src/session/send-queue';
import {
  createConnectedRuntime,
  createConnectingRuntime,
  createDisconnectingRuntime,
  createErrorRuntime,
} from '../../src/session/session-runtime';

function createReceivePipelineStub(
  calls: string[],
): Pick<ReceivePipeline, 'clearLineBuffer'> {
  return {
    clearLineBuffer: vi.fn(() => {
      calls.push('clearLineBuffer');
    }),
  };
}

function createPumpStub(calls: string[], stopError?: unknown): ReadPump {
  return {
    start: vi.fn(),
    stop: vi.fn(async () => {
      calls.push('stop');
      if (stopError) {
        throw stopError;
      }
    }),
    get isRunning(): boolean {
      return false;
    },
  };
}

function createSendQueueStub(calls: string[]): Pick<SendQueue, 'clear'> {
  return {
    clear: vi.fn(() => {
      calls.push('clearSendQueue');
    }),
  };
}

function createPortTeardownHarness(calls: string[] = []) {
  const receivePipeline = createReceivePipelineStub(calls);
  const sendQueue = createSendQueueStub(calls);
  const teardown = createPortTeardown({
    receivePipeline: receivePipeline as ReceivePipeline,
    sendQueue: sendQueue as SendQueue,
  });
  return { ...teardown, receivePipeline, sendQueue, calls };
}

describe('createPortTeardown (#476)', () => {
  it('clears the line buffer before stopping the pump', async () => {
    const calls: string[] = [];
    const { teardownPump } = createPortTeardownHarness(calls);
    const pump = createPumpStub(calls);

    await teardownPump(pump);

    expect(calls).toEqual(['clearLineBuffer', 'stop']);
  });

  it('still clears the line buffer when no pump is active', async () => {
    const calls: string[] = [];
    const { teardownPump } = createPortTeardownHarness(calls);

    await teardownPump(null);

    expect(calls).toEqual(['clearLineBuffer']);
  });

  it('resolves when the port closes successfully', async () => {
    const { closePortSafely } = createPortTeardownHarness();
    const close = vi.fn(async () => undefined);
    const port = { close } as unknown as SerialPort;

    await expect(closePortSafely(port)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it('swallows rejections from port.close()', async () => {
    const { closePortSafely } = createPortTeardownHarness();
    const port = {
      close: vi.fn(async () => {
        throw new Error('already errored');
      }),
    } as unknown as SerialPort;

    await expect(closePortSafely(port)).resolves.toBeUndefined();
  });

  it('is a no-op when the port is null', async () => {
    const { closePortSafely } = createPortTeardownHarness();

    await expect(closePortSafely(null)).resolves.toBeUndefined();
  });
});

describe('session resource snapshots (#588)', () => {
  it('captures port and pump from connected runtime', () => {
    const port = { close: vi.fn() } as unknown as SerialPort;
    const pump = createPumpStub([]);
    const runtime = createConnectedRuntime(port, pump);

    expect(captureResources(runtime)).toEqual({
      port,
      pump,
    });
  });

  it('captures port without pump from disconnecting runtime', () => {
    const port = { close: vi.fn() } as unknown as SerialPort;
    const runtime = createDisconnectingRuntime(port);

    expect(captureResources(runtime)).toEqual({
      port,
      pump: null,
    });
  });

  it('captures cancelConnect from connecting runtime', () => {
    const cancel = vi.fn();
    const runtime = createConnectingRuntime(cancel);

    expect(captureResources(runtime)).toEqual({
      port: null,
      pump: null,
      cancelConnect: cancel,
    });
  });

  it('captures empty resources from error runtime', () => {
    const runtime = createErrorRuntime(
      new SerialError(SerialErrorCode.READ_FAILED, 'read failed'),
    );

    expect(captureResources(runtime)).toEqual({
      port: null,
      pump: null,
    });
  });

  it('tears down resources in cancel, queue, pump, then port order', async () => {
    const calls: string[] = [];
    const { teardownResources } = createPortTeardownHarness(calls);
    const cancelConnect = vi.fn(() => {
      calls.push('cancelConnect');
    });
    const close = vi.fn(async () => {
      calls.push('closePort');
    });
    const port = { close } as unknown as SerialPort;
    const pump = createPumpStub(calls);

    await teardownResources(
      { port, pump, cancelConnect },
      { closeMode: 'safe' },
    );

    expect(calls).toEqual([
      'cancelConnect',
      'clearSendQueue',
      'clearLineBuffer',
      'stop',
      'closePort',
    ]);
  });

  it('swallows port close failures in safe mode', async () => {
    const { teardownResources } = createPortTeardownHarness();
    const port = {
      close: vi.fn(async () => {
        throw new Error('already errored');
      }),
    } as unknown as SerialPort;

    await expect(
      teardownResources({ port, pump: null }, { closeMode: 'safe' }),
    ).resolves.toBeUndefined();
  });

  it('invokes onCloseError in report mode when port.close rejects', async () => {
    const { teardownResources } = createPortTeardownHarness();
    const closeError = new Error('close failed');
    const port = {
      close: vi.fn(async () => {
        throw closeError;
      }),
    } as unknown as SerialPort;
    const onCloseError = vi.fn((error: unknown): never => {
      throw error;
    });

    await expect(
      teardownResources(
        { port, pump: null },
        { closeMode: 'report', onCloseError },
      ),
    ).rejects.toBe(closeError);
    expect(onCloseError).toHaveBeenCalledWith(closeError);
  });

  it('skips cancelConnect when cancelInFlightConnect is false', async () => {
    const calls: string[] = [];
    const { teardownResources } = createPortTeardownHarness(calls);
    const cancelConnect = vi.fn(() => {
      calls.push('cancelConnect');
    });

    await teardownResources(
      { port: null, pump: null, cancelConnect },
      { cancelInFlightConnect: false },
    );

    expect(cancelConnect).not.toHaveBeenCalled();
    expect(calls).toEqual(['clearSendQueue', 'clearLineBuffer']);
  });
});

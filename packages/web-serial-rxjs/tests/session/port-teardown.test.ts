import { describe, expect, it, vi } from 'vitest';
import { createPortTeardown } from '../../src/session/internal/port-teardown';
import type { ReadPump } from '../../src/session/read-pump';
import type { ReceivePipeline } from '../../src/session/internal/receive-pipeline';

function createReceivePipelineStub(
  calls: string[],
): Pick<ReceivePipeline, 'clearReplay' | 'clearLineBuffer'> {
  return {
    clearReplay: vi.fn(() => {
      calls.push('clearReplay');
    }),
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

describe('createPortTeardown (#476)', () => {
  it('clears the receive buffers before stopping the pump', async () => {
    const calls: string[] = [];
    const receivePipeline = createReceivePipelineStub(calls);
    const { teardownPump } = createPortTeardown({
      receivePipeline: receivePipeline as ReceivePipeline,
    });
    const pump = createPumpStub(calls);

    await teardownPump(pump);

    expect(calls).toEqual(['clearReplay', 'clearLineBuffer', 'stop']);
  });

  it('still clears the receive buffers when no pump is active', async () => {
    const calls: string[] = [];
    const receivePipeline = createReceivePipelineStub(calls);
    const { teardownPump } = createPortTeardown({
      receivePipeline: receivePipeline as ReceivePipeline,
    });

    await teardownPump(null);

    expect(calls).toEqual(['clearReplay', 'clearLineBuffer']);
  });

  it('resolves when the port closes successfully', async () => {
    const receivePipeline = createReceivePipelineStub([]);
    const { closePortSafely } = createPortTeardown({
      receivePipeline: receivePipeline as ReceivePipeline,
    });
    const close = vi.fn(async () => undefined);
    const port = { close } as unknown as SerialPort;

    await expect(closePortSafely(port)).resolves.toBeUndefined();
    expect(close).toHaveBeenCalledOnce();
  });

  it('swallows rejections from port.close()', async () => {
    const receivePipeline = createReceivePipelineStub([]);
    const { closePortSafely } = createPortTeardown({
      receivePipeline: receivePipeline as ReceivePipeline,
    });
    const port = {
      close: vi.fn(async () => {
        throw new Error('already errored');
      }),
    } as unknown as SerialPort;

    await expect(closePortSafely(port)).resolves.toBeUndefined();
  });

  it('is a no-op when the port is null', async () => {
    const receivePipeline = createReceivePipelineStub([]);
    const { closePortSafely } = createPortTeardown({
      receivePipeline: receivePipeline as ReceivePipeline,
    });

    await expect(closePortSafely(null)).resolves.toBeUndefined();
  });
});

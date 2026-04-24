import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { createSendQueue } from '../../src/session/send-queue';

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

describe('createSendQueue', () => {
  it('executes enqueued operations in FIFO order', async () => {
    const queue = createSendQueue();
    const order: number[] = [];
    const first = createDeferred<void>();
    const second = createDeferred<void>();

    const firstRun = firstValueFrom(
      queue.enqueue(async () => {
        order.push(1);
        await first.promise;
        order.push(11);
      }),
    );
    const secondRun = firstValueFrom(
      queue.enqueue(async () => {
        order.push(2);
        await second.promise;
        order.push(22);
      }),
    );

    await Promise.resolve();
    expect(order).toEqual([1]);

    first.resolve();
    await firstRun;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([1, 11, 2]);

    second.resolve();
    await secondRun;
    expect(order).toEqual([1, 11, 2, 22]);
  });

  it('continues executing subsequent operations after a failure', async () => {
    const queue = createSendQueue();
    const failure = new Error('boom');

    const failing = firstValueFrom(
      queue.enqueue(async () => {
        throw failure;
      }),
    );
    const succeeding = firstValueFrom(
      queue.enqueue(async () => 'ok'),
    );

    await expect(failing).rejects.toBe(failure);
    await expect(succeeding).resolves.toBe('ok');
  });

  it('suppresses next/complete when the subscriber unsubscribes before completion', async () => {
    const queue = createSendQueue();
    const gate = createDeferred<void>();
    let runCount = 0;
    let nextFired = false;
    let completeFired = false;

    const subscription = queue
      .enqueue(async () => {
        runCount += 1;
        await gate.promise;
        return 'value';
      })
      .subscribe({
        next: () => {
          nextFired = true;
        },
        complete: () => {
          completeFired = true;
        },
      });

    subscription.unsubscribe();
    gate.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(runCount).toBe(1);
    expect(nextFired).toBe(false);
    expect(completeFired).toBe(false);
  });

  it('clear() starts a fresh chain so later enqueues do not wait for prior pending work', async () => {
    const queue = createSendQueue();
    const gate = createDeferred<void>();
    let secondStartedAt: number | null = null;
    let tick = 0;

    queue.enqueue(async () => {
      await gate.promise;
    }).subscribe();

    queue.clear();

    const second = firstValueFrom(
      queue.enqueue(async () => {
        secondStartedAt = tick;
        return 'second';
      }),
    );

    tick = 1;
    await second;
    expect(secondStartedAt).toBe(1);

    gate.resolve();
  });
});

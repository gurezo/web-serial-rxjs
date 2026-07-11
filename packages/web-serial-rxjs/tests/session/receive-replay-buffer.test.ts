import { describe, expect, it } from 'vitest';
import { firstValueFrom, take, toArray } from 'rxjs';
import { createReceiveReplayBuffer } from '../../src/session/internal/receive-replay-buffer';

describe('createReceiveReplayBuffer', () => {
  it('replays retained chunks to late subscribers', async () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 2, maxChars: 0 });

    buffer.next('a');
    buffer.next('b');
    buffer.next('c');

    const replayed = await firstValueFrom(
      buffer.asObservable().pipe(take(2), toArray()),
    );
    expect(replayed).toEqual(['b', 'c']);
  });

  it('forwards live chunks to active subscribers', async () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 4, maxChars: 0 });
    const live = firstValueFrom(buffer.asObservable().pipe(take(1)));

    buffer.next('live');

    await expect(live).resolves.toBe('live');
  });

  it('drops oldest chunks when bufferSize is exceeded', () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 2, maxChars: 0 });

    expect(buffer.next('a').overflowed).toBe(false);
    expect(buffer.next('b').overflowed).toBe(false);
    expect(buffer.next('c').overflowed).toBe(true);
  });

  it('drops oldest chunks when maxChars is exceeded', async () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 10, maxChars: 4 });

    buffer.next('ab');
    buffer.next('cd');
    const result = buffer.next('ef');

    expect(result.overflowed).toBe(true);
    const replayed = await firstValueFrom(
      buffer.asObservable().pipe(take(2), toArray()),
    );
    expect(replayed).toEqual(['cd', 'ef']);
  });

  it('keeps a single chunk that alone exceeds maxChars', async () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 10, maxChars: 2 });

    buffer.next('abcd');

    const replayed = await firstValueFrom(
      buffer.asObservable().pipe(take(1), toArray()),
    );
    expect(replayed).toEqual(['abcd']);
  });

  it('does not emit after complete', () => {
    const buffer = createReceiveReplayBuffer({ bufferSize: 2, maxChars: 0 });

    buffer.next('a');
    buffer.complete();
    expect(buffer.next('b').overflowed).toBe(false);
  });
});

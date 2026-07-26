import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createReceivePipeline } from '../../src/session/internal/receive-pipeline';
import { resolveSerialSessionOptions } from '../../src/session/serial-session-options';

describe('createReceivePipeline bufferErrors$ (#476)', () => {
  it('emits replay overflow before line overflow within one chunk', () => {
    const pipeline = createReceivePipeline({
      resolvedOptions: resolveSerialSessionOptions({
        receiveReplay: { enabled: true, bufferSize: 1, maxChars: 0 },
        lineBuffer: { maxChars: 3 },
      }),
    });

    const codes: SerialErrorCode[] = [];
    pipeline.bufferErrors$.subscribe((error) => codes.push(error.code));

    pipeline.startLiveReceiveReplay();
    // First chunk stays within both limits; the second chunk trips the replay
    // buffer (bufferSize 1) and the line tail (maxChars 3) in one handleChunk.
    pipeline.handleChunk('aa');
    pipeline.handleChunk('bb');

    expect(codes).toEqual([
      SerialErrorCode.RECEIVE_REPLAY_BUFFER_OVERFLOW,
      SerialErrorCode.LINE_BUFFER_OVERFLOW,
    ]);
  });

  it('completes bufferErrors$ when the pipeline completes', () => {
    const pipeline = createReceivePipeline({
      resolvedOptions: resolveSerialSessionOptions(),
    });

    let completed = false;
    pipeline.bufferErrors$.subscribe({
      complete: () => {
        completed = true;
      },
    });

    pipeline.complete();

    expect(completed).toBe(true);
  });
});

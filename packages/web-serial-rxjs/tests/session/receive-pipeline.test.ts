import { describe, expect, it } from 'vitest';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createReceivePipeline } from '../../src/session/internal/receive-pipeline';
import { resolveSerialSessionOptions } from '../../src/session/serial-session-options';

describe('createReceivePipeline bufferErrors$ (#476)', () => {
  it('emits LINE_BUFFER_OVERFLOW when the line tail exceeds maxChars', () => {
    const pipeline = createReceivePipeline({
      resolvedOptions: resolveSerialSessionOptions({
        lineBuffer: { maxChars: 3 },
      }),
    });

    const codes: SerialErrorCode[] = [];
    pipeline.bufferErrors$.subscribe((error) => codes.push(error.code));

    pipeline.handleChunk('abcd');

    expect(codes).toEqual([SerialErrorCode.LINE_BUFFER_OVERFLOW]);
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

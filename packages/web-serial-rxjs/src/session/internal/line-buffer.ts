import { createNewlineTokenizer } from '../../internal/newline-tokenizer';

/**
 * Options for {@link createLineBuffer}.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/371 | Issue #371}
 */
export interface LineBufferOptions {
  /**
   * Maximum characters retained in the incomplete line tail (no line terminator yet).
   * When exceeded, leading characters are discarded. `0` means unlimited.
   *
   * @default 1048576
   */
  maxChars?: number;
}

/** Default limits applied when {@link LineBufferOptions} fields are omitted. */
export const DEFAULT_LINE_BUFFER_OPTIONS: Required<LineBufferOptions> = {
  maxChars: 1_048_576,
};

/** Result of {@link createLineBuffer.feed}. */
export interface LineBufferFeedResult {
  lines: string[];
  /** `true` when leading characters were discarded due to `maxChars`. */
  overflowed: boolean;
}

/**
 * Handle returned by {@link createLineBuffer}.
 *
 * @internal
 */
export interface LineBuffer {
  feed(chunk: string): LineBufferFeedResult;
  clear(): void;
}

/**
 * Streaming UTF-16 text to newline-delimited lines for {@link createSerialSession}.
 * Supports `\r\n` and `\n` per #237; a lone `\r` that is not the last character
 * in the buffer is treated as a line end (compatibility with some devices). A
 * trailing `\r` is retained until a following chunk disambiguates `\r` vs
 * `\r\n`.
 *
 * @internal
 */
export function createLineBuffer(options?: LineBufferOptions): LineBuffer {
  const limits: Required<LineBufferOptions> = {
    ...DEFAULT_LINE_BUFFER_OPTIONS,
    ...options,
  };

  const tokenizer = createNewlineTokenizer('line');

  const clear = (): void => {
    tokenizer.clear();
  };

  const feed = (chunk: string): LineBufferFeedResult => {
    const events = tokenizer.feed(chunk);
    const out: string[] = [];

    for (const event of events) {
      if (event.type === 'line') {
        out.push(event.content);
      }
    }

    const overflowed = tokenizer.trimPending(limits.maxChars);

    return { lines: out, overflowed };
  };

  return { feed, clear };
}

import { createNewlineTokenizer } from '../../internal/newline-tokenizer';
import type { MaxChars } from '../../internal/branded-numbers';
import { brandMaxChars } from '../../internal/branded-numbers';
import { SerialError } from '../../errors/serial-error';
import { SerialErrorCode } from '../../errors/serial-error-code';

/**
 * Options for {@link createLineBuffer}.
 *
 * Character counts use UTF-16 string length (JavaScript `.length`).
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/371 | Issue #371}
 */
export interface LineBufferOptions {
  /**
   * Maximum characters retained in the incomplete line tail (no line terminator yet).
   * When exceeded, leading characters are discarded. `0` means unlimited.
   * Must be a safe integer `>= 0` when validated.
   *
   * @default 1048576
   */
  maxChars?: number;
}

/** Default limits applied when {@link LineBufferOptions} fields are omitted. */
export const DEFAULT_LINE_BUFFER_OPTIONS: Required<LineBufferOptions> = {
  maxChars: 1_048_576,
};

/** Resolved line buffer options with validated branded numeric fields. */
export type ResolvedLineBufferOptions = {
  maxChars: MaxChars;
};

/**
 * Merge and validate {@link LineBufferOptions}.
 *
 * This is the single normalization path for line buffer defaults and boundary
 * checks used by {@link resolveSerialSessionOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS}
 *         when `maxChars` is out of range.
 */
export function resolveLineBufferOptions(
  options?: LineBufferOptions,
): ResolvedLineBufferOptions {
  const merged: Required<LineBufferOptions> = {
    ...DEFAULT_LINE_BUFFER_OPTIONS,
    ...options,
  };

  const { maxChars } = merged;

  if (!Number.isSafeInteger(maxChars) || maxChars < 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS,
      `Invalid lineBuffer.maxChars: ${maxChars}. Must be a safe integer >= 0.`,
      undefined,
      {
        field: 'lineBuffer.maxChars',
        value: maxChars,
        constraint: 'non-negative-safe-integer',
      },
    );
  }

  return {
    maxChars: brandMaxChars(maxChars),
  };
}

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

/** @internal Resolved limits for {@link createLineBuffer}. */
export interface LineBufferLimits {
  maxChars: MaxChars;
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
export function createLineBuffer(
  options?: LineBufferOptions | LineBufferLimits,
): LineBuffer {
  const limits: LineBufferLimits = resolveLineBufferOptions(options);

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

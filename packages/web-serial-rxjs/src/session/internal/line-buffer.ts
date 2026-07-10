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
 * Streaming UTF-16 text to newline-delimited lines for {@link createSerialSession}.
 * Supports `\r\n` and `\n` per #237; a lone `\r` that is not the last character
 * in the buffer is treated as a line end (compatibility with some devices). A
 * trailing `\r` is retained until a following chunk disambiguates `\r` vs
 * `\r\n`.
 *
 * @internal
 */
export function createLineBuffer(options?: LineBufferOptions): {
  feed(chunk: string): LineBufferFeedResult;
  clear(): void;
} {
  const limits: Required<LineBufferOptions> = {
    ...DEFAULT_LINE_BUFFER_OPTIONS,
    ...options,
  };

  let buffer = '';

  const clear = (): void => {
    buffer = '';
  };

  const trimIncompleteTail = (): boolean => {
    if (limits.maxChars <= 0 || buffer.length <= limits.maxChars) {
      return false;
    }
    buffer = buffer.slice(buffer.length - limits.maxChars);
    return true;
  };

  const feed = (chunk: string): LineBufferFeedResult => {
    buffer += chunk;
    let overflowed = false;
    const out: string[] = [];

    for (;;) {
      const crlf = buffer.indexOf('\r\n');
      if (crlf >= 0) {
        out.push(buffer.slice(0, crlf));
        buffer = buffer.slice(crlf + 2);
        continue;
      }

      // Lone \r (not the last character) is a line end so we must not let
      // a later \n in the same buffer be matched first (e.g. "a\rb\n").
      const cr = buffer.indexOf('\r');
      if (cr >= 0 && cr + 1 < buffer.length && buffer[cr + 1] !== '\n') {
        out.push(buffer.slice(0, cr));
        buffer = buffer.slice(cr + 1);
        continue;
      }

      const nl = buffer.indexOf('\n');
      if (nl >= 0) {
        out.push(buffer.slice(0, nl));
        buffer = buffer.slice(nl + 1);
        continue;
      }

      if (cr >= 0 && cr + 1 === buffer.length) {
        break;
      }

      break;
    }

    if (trimIncompleteTail()) {
      overflowed = true;
    }

    return { lines: out, overflowed };
  };

  return { feed, clear };
}

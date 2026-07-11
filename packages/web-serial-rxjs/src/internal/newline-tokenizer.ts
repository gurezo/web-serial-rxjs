/**
 * Shared CR/LF/CRLF scanner for {@link createLineBuffer} and
 * {@link applyTerminalChunk}. Mode controls intentional semantic differences
 * between line-delimited output and terminal display redraw.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/376 | Issue #376}
 */
export type NewlineTokenizerMode = 'line' | 'terminal';

export type NewlineEvent =
  | { type: 'line'; content: string }
  | { type: 'carriage-return' };

export interface NewlineTokenizer {
  feed(chunk: string): NewlineEvent[];
  clear(): void;
  /** Replaces the incomplete tail (used when folding external state in). */
  restorePending(text: string): void;
  /** Incomplete tail retained across feeds (line mode may end with `\r`). */
  getPendingText(): string;
  /**
   * Discards leading characters when pending text exceeds `maxChars`.
   * @returns `true` when trimming occurred.
   */
  trimPending(maxChars: number): boolean;
}

/**
 * Creates a streaming newline tokenizer.
 *
 * - **line**: interior lone `\r` completes a line (#237); trailing `\r` is
 *   deferred until the next chunk disambiguates `\r` vs `\r\n`.
 * - **terminal**: lone `\r` clears the current line (#275); trailing `\r`
 *   applies immediately.
 */
export function createNewlineTokenizer(
  mode: NewlineTokenizerMode,
): NewlineTokenizer {
  let pending = '';
  let deferredTrailingCr = false;

  const clear = (): void => {
    pending = '';
    deferredTrailingCr = false;
  };

  const restorePending = (text: string): void => {
    pending = text;
    deferredTrailingCr = false;
  };

  const feed = (chunk: string): NewlineEvent[] => {
    const events: NewlineEvent[] = [];
    let i = 0;

    if (mode === 'line' && deferredTrailingCr) {
      deferredTrailingCr = false;
      if (chunk.length > 0 && chunk.charAt(0) === '\n') {
        events.push({ type: 'line', content: pending });
        pending = '';
        i = 1;
      } else {
        events.push({ type: 'line', content: pending });
        pending = '';
      }
    }

    const len = chunk.length;
    for (; i < len; i++) {
      const c = chunk.charAt(i);
      if (c === '\r') {
        const next = i + 1 < len ? chunk.charAt(i + 1) : '';
        if (next === '\n') {
          events.push({ type: 'line', content: pending });
          pending = '';
          i++;
          continue;
        }

        if (mode === 'line') {
          if (next !== '') {
            events.push({ type: 'line', content: pending });
            pending = '';
            continue;
          }
          deferredTrailingCr = true;
          break;
        }

        events.push({ type: 'carriage-return' });
        pending = '';
        continue;
      }

      if (c === '\n') {
        events.push({ type: 'line', content: pending });
        pending = '';
        continue;
      }

      pending += c;
    }

    return events;
  };

  const trimPending = (maxChars: number): boolean => {
    if (maxChars <= 0) {
      return false;
    }

    const text = deferredTrailingCr ? `${pending}\r` : pending;
    if (text.length <= maxChars) {
      return false;
    }

    const trimmed = text.slice(text.length - maxChars);
    if (trimmed.endsWith('\r')) {
      pending = trimmed.slice(0, -1);
      deferredTrailingCr = true;
    } else {
      pending = trimmed;
      deferredTrailingCr = false;
    }
    return true;
  };

  return {
    feed,
    clear,
    restorePending,
    getPendingText: () => (deferredTrailingCr ? `${pending}\r` : pending),
    trimPending,
  };
}

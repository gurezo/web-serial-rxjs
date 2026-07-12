const ESC = '\u001b';

/** CSI final byte range per ECMA-48. */
const CSI_FINAL_BYTE = /[@-~]/;

/** OSC terminator: BEL or ST (ESC \). */
const OSC_TERMINATOR = /(?:\u0007|\u001b\\)/;

/**
 * Stateful ANSI escape stripper for streaming text chunks.
 *
 * Buffers incomplete sequences that span Web Serial read boundaries so
 * partial ESC bytes are not emitted as visible text.
 *
 * @internal
 */
export interface AnsiStripper {
  feed(chunk: string): string;
  flush(): string;
}

/**
 * Strips ANSI escape sequences from a complete string in one pass.
 *
 * @internal
 */
export function stripAnsiSequences(text: string): string {
  const stripper = createAnsiStripper();
  return stripper.feed(text) + stripper.flush();
}

/**
 * Creates a streaming ANSI escape stripper.
 *
 * @internal
 */
export function createAnsiStripper(): AnsiStripper {
  let pending = '';

  const feed = (chunk: string): string => {
    const input = pending + chunk;
    pending = '';
    let output = '';
    let i = 0;

    while (i < input.length) {
      const escIndex = input.indexOf(ESC, i);
      if (escIndex < 0) {
        output += input.slice(i);
        break;
      }

      output += input.slice(i, escIndex);
      const next = escIndex + 1;
      if (next >= input.length) {
        pending = ESC;
        break;
      }

      const code = input.charCodeAt(next);

      // CSI: ESC [
      if (code === 0x5b) {
        const csiStart = next + 1;
        let j = csiStart;
        while (j < input.length && !CSI_FINAL_BYTE.test(input.charAt(j))) {
          j++;
        }
        if (j < input.length) {
          i = j + 1;
          continue;
        }
        pending = input.slice(escIndex);
        break;
      }

      // OSC: ESC ]
      if (code === 0x5d) {
        const oscBody = input.slice(next);
        const match = OSC_TERMINATOR.exec(oscBody);
        if (match && match.index !== undefined) {
          i = escIndex + 1 + match.index + match[0].length;
          continue;
        }
        pending = input.slice(escIndex);
        break;
      }

      // Two-character ESC sequences (e.g. ESC M, ESC 7, ESC 8)
      if (next < input.length) {
        i = next + 1;
        continue;
      }

      pending = input.slice(escIndex);
      break;
    }

    return output;
  };

  const flush = (): string => {
    if (pending.length === 0) {
      return '';
    }
    const remainder = pending;
    pending = '';
    return remainder;
  };

  return { feed, flush };
}

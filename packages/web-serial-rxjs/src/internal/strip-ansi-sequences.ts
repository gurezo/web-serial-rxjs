const ESC = '\u001b';

/** CSI final byte range per ECMA-48. */
const CSI_FINAL_BYTE = /[@-~]/;

const BEL = '\u0007';
const OSC_STRING_TERMINATOR = '\u001b\\';

function findOscTerminator(
  oscBody: string,
): { index: number; length: number } | null {
  let earliest: { index: number; length: number } | null = null;

  const belIndex = oscBody.indexOf(BEL);
  if (belIndex >= 0) {
    earliest = { index: belIndex, length: 1 };
  }

  const stIndex = oscBody.indexOf(OSC_STRING_TERMINATOR);
  if (stIndex >= 0) {
    const candidate = { index: stIndex, length: OSC_STRING_TERMINATOR.length };
    if (!earliest || stIndex < earliest.index) {
      earliest = candidate;
    }
  }

  return earliest;
}

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
        const terminator = findOscTerminator(oscBody);
        if (terminator) {
          i = escIndex + 1 + terminator.index + terminator.length;
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

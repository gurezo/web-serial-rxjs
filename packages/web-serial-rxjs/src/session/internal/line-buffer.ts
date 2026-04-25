/**
 * Streaming UTF-16 text to newline-delimited lines for {@link createSerialSession}.
 * Supports `\r\n` and `\n` per #237; a lone `\r` that is not the last character
 * in the buffer is treated as a line end (compatibility with some devices). A
 * trailing `\r` is retained until a following chunk disambiguates `\r` vs
 * `\r\n`.
 *
 * @internal
 */
export function createLineBuffer(): {
  feed(chunk: string): string[];
  clear(): void;
} {
  let buffer = '';

  const clear = (): void => {
    buffer = '';
  };

  const feed = (chunk: string): string[] => {
    buffer += chunk;
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

    return out;
  };

  return { feed, clear };
}

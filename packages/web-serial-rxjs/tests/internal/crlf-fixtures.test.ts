import { describe, expect, it } from 'vitest';
import { Subject } from 'rxjs';
import { createLineBuffer } from '../../src/session/internal/line-buffer';
import { createTerminalBuffer } from '../../src/terminal/create-terminal-buffer';
import { CRLF_FIXTURES } from './crlf-fixtures';

describe('CRLF fixtures (line buffer)', () => {
  it.each(CRLF_FIXTURES)('$id', ({ chunks, line }) => {
    const buffer = createLineBuffer();

    chunks.forEach((chunk, index) => {
      const result = buffer.feed(chunk);
      expect(result.lines).toEqual(line.linesPerFeed[index]);
      expect(result.overflowed).toBe(false);
    });
  });
});

describe('CRLF fixtures (terminal buffer)', () => {
  it.each(CRLF_FIXTURES)('$id', ({ chunks, terminal }) => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });

    for (const chunk of chunks) {
      receive$.next(chunk);
    }

    expect(last).toBe(terminal);
  });
});

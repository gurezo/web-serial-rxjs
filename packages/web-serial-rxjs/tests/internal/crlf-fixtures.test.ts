import { describe, expect, it } from 'vitest';
import { createLineBuffer } from '../../src/session/internal/line-buffer';
import {
  applyTerminalChunk,
  terminalDisplayText,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-buffer';
import { CRLF_FIXTURES } from './crlf-fixtures';

const emptyTerminal: TerminalBufferState = { completed: '', currentLine: '' };

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
    let state = emptyTerminal;

    for (const chunk of chunks) {
      state = applyTerminalChunk(state, chunk);
    }

    expect(terminalDisplayText(state)).toBe(terminal);
  });
});

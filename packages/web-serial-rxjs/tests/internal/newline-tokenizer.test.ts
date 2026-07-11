import { describe, expect, it } from 'vitest';
import { createNewlineTokenizer } from '../../src/internal/newline-tokenizer';

describe('createNewlineTokenizer (line mode)', () => {
  it('emits a line on LF', () => {
    const t = createNewlineTokenizer('line');
    expect(t.feed('a\n')).toEqual([{ type: 'line', content: 'a' }]);
    expect(t.getPendingText()).toBe('');
  });

  it('emits a line on CRLF', () => {
    const t = createNewlineTokenizer('line');
    expect(t.feed('a\r\n')).toEqual([{ type: 'line', content: 'a' }]);
  });

  it('defers trailing CR until the next chunk', () => {
    const t = createNewlineTokenizer('line');
    expect(t.feed('a\r')).toEqual([]);
    expect(t.getPendingText()).toBe('a\r');
    expect(t.feed('\n')).toEqual([{ type: 'line', content: 'a' }]);
  });

  it('treats interior CR as a line end', () => {
    const t = createNewlineTokenizer('line');
    expect(t.feed('A\rB\n')).toEqual([
      { type: 'line', content: 'A' },
      { type: 'line', content: 'B' },
    ]);
  });

  it('resolves interior CR split across feeds', () => {
    const t = createNewlineTokenizer('line');
    expect(t.feed('a\r')).toEqual([]);
    expect(t.feed('b\n')).toEqual([
      { type: 'line', content: 'a' },
      { type: 'line', content: 'b' },
    ]);
  });

  it('clears pending state', () => {
    const t = createNewlineTokenizer('line');
    t.feed('partial\r');
    t.clear();
    expect(t.getPendingText()).toBe('');
    expect(t.feed('x\n')).toEqual([{ type: 'line', content: 'x' }]);
  });
});

describe('createNewlineTokenizer (terminal mode)', () => {
  it('emits carriage-return on lone CR', () => {
    const t = createNewlineTokenizer('terminal');
    expect(t.feed('A\rB')).toEqual([{ type: 'carriage-return' }]);
    expect(t.getPendingText()).toBe('B');
  });

  it('applies trailing CR immediately', () => {
    const t = createNewlineTokenizer('terminal');
    expect(t.feed('a\r')).toEqual([{ type: 'carriage-return' }]);
    expect(t.getPendingText()).toBe('');
  });

  it('emits a line on CRLF', () => {
    const t = createNewlineTokenizer('terminal');
    expect(t.feed('a\r\nb')).toEqual([{ type: 'line', content: 'a' }]);
    expect(t.getPendingText()).toBe('b');
  });

  it('resolves a\\r then \\nb across chunks', () => {
    const t = createNewlineTokenizer('terminal');
    expect(t.feed('a\r')).toEqual([{ type: 'carriage-return' }]);
    expect(t.feed('\nb')).toEqual([
      { type: 'line', content: '' },
    ]);
    expect(t.getPendingText()).toBe('b');
  });
});

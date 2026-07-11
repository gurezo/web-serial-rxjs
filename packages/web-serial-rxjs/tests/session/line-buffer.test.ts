import { describe, expect, it } from 'vitest';
import { createLineBuffer } from '../../src/session/internal/line-buffer';

describe('createLineBuffer', () => {
  it('clears buffer state', () => {
    const b = createLineBuffer();
    b.feed('partial');
    b.clear();
    expect(b.feed('a\n')).toEqual({ lines: ['a'], overflowed: false });
  });

  it('does not trim when within maxChars', () => {
    const b = createLineBuffer({ maxChars: 8 });
    expect(b.feed('abcdefg')).toEqual({ lines: [], overflowed: false });
  });

  it('discards leading chars when maxChars is exceeded', () => {
    const b = createLineBuffer({ maxChars: 4 });
    expect(b.feed('abcdef')).toEqual({ lines: [], overflowed: true });
    expect(b.feed('\n')).toEqual({ lines: ['cdef'], overflowed: false });
  });

  it('emits trimmed line when overflow is followed by a delimiter', () => {
    const b = createLineBuffer({ maxChars: 3 });
    expect(b.feed('abcd\n')).toEqual({ lines: ['abcd'], overflowed: false });
  });

  it('keeps unlimited growth when maxChars is zero', () => {
    const b = createLineBuffer({ maxChars: 0 });
    const long = 'x'.repeat(20);
    expect(b.feed(long)).toEqual({ lines: [], overflowed: false });
    expect(b.feed('\n')).toEqual({ lines: [long], overflowed: false });
  });

  it('trims incomplete tail without affecting completed lines', () => {
    const b = createLineBuffer({ maxChars: 3 });
    expect(b.feed('ab\ncdef')).toEqual({ lines: ['ab'], overflowed: true });
    expect(b.feed('\n')).toEqual({ lines: ['def'], overflowed: false });
  });
});

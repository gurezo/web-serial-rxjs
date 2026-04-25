import { describe, expect, it } from 'vitest';
import { createLineBuffer } from '../../src/session/internal/line-buffer';

describe('createLineBuffer', () => {
  it('splits on LF', () => {
    const b = createLineBuffer();
    expect(b.feed('a\nb')).toEqual(['a']);
  });

  it('splits on CRLF', () => {
    const b = createLineBuffer();
    expect(b.feed('a\r\nb')).toEqual(['a']);
  });

  it('accumulates across feeds until a delimiter completes', () => {
    const b = createLineBuffer();
    expect(b.feed('a\r')).toEqual([]);
    expect(b.feed('\n')).toEqual(['a']);
  });

  it('emits all complete lines in one feed', () => {
    const b = createLineBuffer();
    expect(b.feed('a\nb\n')).toEqual(['a', 'b']);
  });

  it('resolves interior CR and LF when split across two feeds', () => {
    const b = createLineBuffer();
    expect(b.feed('a\r')).toEqual([]);
    expect(b.feed('b\n')).toEqual(['a', 'b']);
  });

  it('clears buffer state', () => {
    const b = createLineBuffer();
    b.feed('partial');
    b.clear();
    expect(b.feed('a\n')).toEqual(['a']);
  });
});

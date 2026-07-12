import { describe, expect, it } from 'vitest';
import {
  createAnsiStripper,
  stripAnsiSequences,
} from '../../src/internal/strip-ansi-sequences';

describe('stripAnsiSequences', () => {
  it('removes CSI SGR color codes', () => {
    expect(stripAnsiSequences('\u001b[0mhello\u001b[01;34mworld\u001b[0m')).toBe(
      'helloworld',
    );
  });

  it('removes bracketed paste mode CSI', () => {
    expect(stripAnsiSequences('prompt\u001b[?2004h')).toBe('prompt');
  });

  it('removes OSC sequences terminated by BEL', () => {
    expect(stripAnsiSequences('before\u001b]0;title\u0007after')).toBe(
      'beforeafter',
    );
  });

  it('removes OSC sequences terminated by ST', () => {
    expect(stripAnsiSequences('before\u001b]104;rgb:ffff/ffff/ffff\u001b\\after')).toBe(
      'beforeafter',
    );
  });

  it('removes two-character ESC sequences', () => {
    expect(stripAnsiSequences('line\u001b7saved')).toBe('linesaved');
  });

  it('returns plain text unchanged', () => {
    expect(stripAnsiSequences('合計 36\ndrwx------ 5 pi pi 4096 6月 4 13:35 .')).toBe(
      '合計 36\ndrwx------ 5 pi pi 4096 6月 4 13:35 .',
    );
  });
});

describe('createAnsiStripper', () => {
  it('buffers CSI split across chunks', () => {
    const stripper = createAnsiStripper();
    expect(stripper.feed('hello\u001b[')).toBe('hello');
    expect(stripper.feed('01;34mworld')).toBe('world');
    expect(stripper.flush()).toBe('');
  });

  it('buffers ESC split across chunks', () => {
    const stripper = createAnsiStripper();
    expect(stripper.feed('hello\u001b')).toBe('hello');
    expect(stripper.feed('[0mworld')).toBe('world');
    expect(stripper.flush()).toBe('');
  });

  it('buffers OSC split across chunks', () => {
    const stripper = createAnsiStripper();
    expect(stripper.feed('a\u001b]104')).toBe('a');
    expect(stripper.feed(';rgb:ffff/ffff/ffff\u001b\\b')).toBe('b');
    expect(stripper.flush()).toBe('');
  });

  it('issue #428: strips raspberry pi ls -la color codes', () => {
    const stripper = createAnsiStripper();
    const chunks = [
      'pi@raspberrypi:~$ ls -la\n',
      '合計 36\n',
      'drwx------ 5 pi   pi   4096  6月  4 13:35 \u001b[0m\u001b[01;34m.\u001b[0m\n',
      'drwxr-xr-x 3 root root 4096  6月  4 12:43 \u001b[01;34m..\u001b[0m\n',
      'lrwxrwxrwx 1 pi   pi     18  6月  4 13:19 \u001b[01;36mnode_modules\u001b[0m -> \u001b[01;34mmyApp/node_modules\u001b[0m\n',
      'pi@raspberrypi:~$ logout\n',
      '\u001b[!p\u001b]104\u0007\u001b[?7h\u001b[6n',
    ];

    const output = chunks.map((chunk) => stripper.feed(chunk)).join('') + stripper.flush();

    expect(output).toContain('合計 36');
    expect(output).toContain('node_modules -> myApp/node_modules');
    expect(output).not.toContain('\u001b[');
    expect(output).not.toContain('[0m');
    expect(output).not.toContain('[01;34m');
    expect(output).not.toContain('[?2004h');
  });

  it('flush emits trailing incomplete escape as literal text', () => {
    const stripper = createAnsiStripper();
    expect(stripper.feed('tail\u001b[')).toBe('tail');
    expect(stripper.flush()).toBe('\u001b[');
  });
});

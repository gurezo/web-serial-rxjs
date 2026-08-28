import { describe, expect, it } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import { createTerminalBuffer } from '../../src/terminal/create-terminal-buffer';

function subscribeTerminalText(
  receive$: Subject<string>,
  options?: Parameters<typeof createTerminalBuffer>[1],
): () => string {
  const { text$ } = createTerminalBuffer(receive$, options);
  let last = '';
  text$.subscribe((t) => {
    last = t;
  });
  return () => last;
}

/** Issue #290: terminal 表示の再発防止用テストケース群 */
describe('createTerminalBuffer carriage-return folding', () => {
  it('issue #290: A\\rB を分割チャンクでも B に畳み込む', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$);
    receive$.next('A');
    expect(getLast()).toBe('A');
    receive$.next('\rB');
    expect(getLast()).toBe('B');
  });
});

describe('createTerminalBuffer memory limits', () => {
  it('drops oldest completed lines when maxLines is exceeded', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    receive$.next('line1\nline2\nline3\nline4');
    expect(getLast()).toBe('line2\nline3\nline4');
  });

  it('drops leading chars from completed when maxChars is exceeded', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 0, maxChars: 6 });
    receive$.next('abcdef\nghij');
    expect(getLast()).toBe('f\nghij');
  });

  it('trims currentLine when maxChars exceeds completed length', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 0, maxChars: 4 });
    receive$.next('abcdefghij');
    expect(getLast()).toBe('ghij');
  });

  it('keeps unlimited growth when maxLines and maxChars are zero', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, {
      maxLines: 0,
      maxChars: 0,
    });
    receive$.next('a\nb\n');
    receive$.next('c');
    expect(getLast()).toBe('a\nb\nc');
  });

  it('preserves carriage-return redraw after trimming', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 1, maxChars: 0 });
    receive$.next('old\n');
    receive$.next('new\r');
    receive$.next('final\n');
    expect(getLast()).toBe('final\n');
  });

  it('applies maxLines before maxChars when both limits are set', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 10 });
    receive$.next('line1\nline2\nline3\nline4');
    expect(getLast()).toBe('ine3\nline4');
  });

  it('preserves lf-normalized completed lines after crlf input', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    receive$.next('first\r\n');
    receive$.next('second\r\n');
    receive$.next('third\r\n');
    const last = getLast();
    expect(last).toBe('second\nthird\n');
    expect(last).not.toContain('\r');
  });

  it('returns completed unchanged when within maxLines', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 3, maxChars: 0 });
    receive$.next('a\nb\n');
    expect(getLast()).toBe('a\nb\n');
  });

  it('returns completed unchanged when maxLines is zero (unlimited)', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 0, maxChars: 0 });
    receive$.next('line1\nline2\nline3\n');
    expect(getLast()).toBe('line1\nline2\nline3\n');
  });

  it('returns completed unchanged when exactly at maxLines', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    receive$.next('line1\nline2\n');
    expect(getLast()).toBe('line1\nline2\n');
  });

  it('drops oldest line when one line over maxLines', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    receive$.next('line1\nline2\nline3\n');
    expect(getLast()).toBe('line2\nline3\n');
  });

  it('drops many oldest lines when far over maxLines', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    const lines = Array.from({ length: 120 }, (_, i) => `line${i + 1}`).join('\n');
    receive$.next(`${lines}\n`);
    const last = getLast();
    expect(last).toBe('line119\nline120\n');
    expect(last).not.toContain('line1\n');
    expect(last).not.toContain('line118\n');
  });
});

describe('createTerminalBuffer', () => {
  // #290: ls -la 形式
  it('issue #290: ls -la 形式の同一行 redraw で古い行を残さない', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$);
    receive$.next('-rw-r--r--  1 alice  staff  123 ./foo\r');
    receive$.next('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(getLast()).toBe('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(getLast()).not.toContain('alice');
  });

  // #290: prompt 表示
  it('issue #290: carriage-return redraw 後に shell prompt を正しく表示する', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$);
    receive$.next('login: user\r');
    receive$.next('$ ');
    expect(getLast()).toBe('$ ');
    receive$.next('whoami\r\n');
    receive$.next('user\r\n');
    receive$.next('# ');
    expect(getLast().endsWith('# ')).toBe(true);
  });

  it('shares replayed text$ across subscribers', async () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    const first: string[] = [];
    text$.subscribe((t) => first.push(t));
    receive$.next('only');
    const late = await firstValueFrom(text$);
    expect(late).toBe('only');
    expect(first).toEqual(['only']);
  });

  it('drops oldest lines when maxLines option is set', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 2, maxChars: 0 });
    receive$.next('line1\nline2\nline3\nline4');
    expect(getLast()).toBe('line2\nline3\nline4');
  });

  it('drops leading chars when maxChars option is set', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 0, maxChars: 6 });
    receive$.next('abcdef\nghij');
    expect(getLast()).toBe('f\nghij');
  });

  it('keeps unlimited growth when maxLines and maxChars are zero', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, {
      maxLines: 0,
      maxChars: 0,
    });
    receive$.next('line1\nline2\nline3\n');
    expect(getLast()).toBe('line1\nline2\nline3\n');
  });

  it('issue #290: preserves redraw after maxLines trim', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { maxLines: 1, maxChars: 0 });
    receive$.next('old\n');
    receive$.next('-rw-r--r--  1 alice  staff  123 ./foo\r');
    receive$.next('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(getLast()).toBe('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(getLast()).not.toContain('alice');
  });

  it('issue #428: strips ansi color codes from ls -la output by default', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$);

    receive$.next('pi@raspberrypi:~$ ls -la\n');
    receive$.next('合計 36\n');
    receive$.next(
      'drwx------ 5 pi   pi   4096  6月  4 13:35 \u001b[0m\u001b[01;34m.\u001b[0m\n',
    );
    receive$.next(
      'lrwxrwxrwx 1 pi   pi     18  6月  4 13:19 \u001b[01;36mnode_modules\u001b[0m -> \u001b[01;34mmyApp/node_modules\u001b[0m\n',
    );

    const last = getLast();
    expect(last).toContain('合計 36');
    expect(last).toContain('node_modules -> myApp/node_modules');
    expect(last).not.toContain('[0m');
    expect(last).not.toContain('[01;34m');
    expect(last).not.toContain('[01;36m');
  });

  it('issue #428: preserves ansi sequences when stripAnsi is false', () => {
    const receive$ = new Subject<string>();
    const getLast = subscribeTerminalText(receive$, { stripAnsi: false });

    receive$.next('prompt\u001b[?2004h');
    expect(getLast()).toContain('[?2004h');
  });

  it('issue #488: rejects invalid terminal buffer limits at creation', () => {
    const receive$ = new Subject<string>();
    expect(() => createTerminalBuffer(receive$, { maxLines: -1 })).toThrow();
    expect(() => createTerminalBuffer(receive$, { maxChars: Infinity })).toThrow();
  });

  describe('issue #590: terminal parser lifecycle', () => {
    it('feeds chunks with a persistent tokenizer', () => {
      const receive$ = new Subject<string>();
      const getLast = subscribeTerminalText(receive$);
      receive$.next('part');
      receive$.next('ial\n');
      expect(getLast()).toBe('partial\n');
    });

    it('reset clears completed, pending line, and ansi state on resubscribe', () => {
      const receive$ = new Subject<string>();
      const { text$ } = createTerminalBuffer(receive$);
      let last = '';
      const sub = text$.subscribe((t) => {
        last = t;
      });
      receive$.next('hello\u001b[');
      expect(last).toBe('hello');
      sub.unsubscribe();

      text$.subscribe((t) => {
        last = t;
      });
      receive$.next('plain\n');
      expect(last).toBe('plain\n');
    });

    it('restoreState rehydrates parser for pure chunk application', () => {
      const receive$ = new Subject<string>();
      const getLast = subscribeTerminalText(receive$);
      receive$.next('done\npending');
      receive$.next('\n');
      expect(getLast()).toBe('done\npending\n');
    });

    it('folds partial line split across chunks', () => {
      const receive$ = new Subject<string>();
      const getLast = subscribeTerminalText(receive$);
      receive$.next('part');
      receive$.next('ial\n');
      expect(getLast()).toBe('partial\n');
    });

    it('folds crlf split across chunks', () => {
      const receive$ = new Subject<string>();
      const getLast = subscribeTerminalText(receive$);
      receive$.next('line1\nhel');
      receive$.next('lo\n');
      expect(getLast()).toBe('line1\nhello\n');
    });

    it('strips ansi sequence split across chunks', () => {
      const receive$ = new Subject<string>();
      const getLast = subscribeTerminalText(receive$);
      receive$.next('hello\u001b[');
      receive$.next('01;34mworld\n');
      expect(getLast()).toBe('helloworld\n');
    });

    it('resets parser state when all subscribers unsubscribe', () => {
      const receive$ = new Subject<string>();
      const { text$ } = createTerminalBuffer(receive$);
      let last = '';
      const sub = text$.subscribe((t) => {
        last = t;
      });
      receive$.next('part');
      expect(last).toBe('part');
      sub.unsubscribe();

      text$.subscribe((t) => {
        last = t;
      });
      receive$.next('ial\n');
      expect(last).toBe('ial\n');
    });

    it('resets ansi stripper pending on resubscribe', () => {
      const receive$ = new Subject<string>();
      const { text$ } = createTerminalBuffer(receive$);
      let last = '';
      const sub = text$.subscribe((t) => {
        last = t;
      });
      receive$.next('hello\u001b[');
      expect(last).toBe('hello');
      sub.unsubscribe();

      text$.subscribe((t) => {
        last = t;
      });
      receive$.next('plain\n');
      expect(last).toBe('plain\n');
    });
  });
});

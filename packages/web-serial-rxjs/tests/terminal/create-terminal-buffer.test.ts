import { describe, expect, it } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import {
  applyTerminalChunk,
  createTerminalBuffer,
  terminalDisplayText,
  trimCompletedByMaxLines,
  trimTerminalState,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-buffer';

const empty: TerminalBufferState = { completed: '', currentLine: '' };

/** Issue #290: terminal 表示の再発防止用テストケース群 */
describe('applyTerminalChunk', () => {
  it('issue #290: A\\rB を分割チャンクでも B に畳み込む', () => {
    let s = applyTerminalChunk(empty, 'A');
    expect(terminalDisplayText(s)).toBe('A');
    s = applyTerminalChunk(s, '\rB');
    expect(terminalDisplayText(s)).toBe('B');
  });
});

describe('trimTerminalState', () => {
  it('drops oldest completed lines when maxLines is exceeded', () => {
    const state: TerminalBufferState = {
      completed: 'line1\nline2\nline3\n',
      currentLine: 'line4',
    };
    const trimmed = trimTerminalState(state, { maxLines: 2, maxChars: 0 });
    expect(terminalDisplayText(trimmed)).toBe('line2\nline3\nline4');
  });

  it('drops leading chars from completed when maxChars is exceeded', () => {
    const state: TerminalBufferState = {
      completed: 'abcdef\n',
      currentLine: 'ghij',
    };
    const trimmed = trimTerminalState(state, { maxLines: 0, maxChars: 6 });
    expect(terminalDisplayText(trimmed)).toBe('f\nghij');
  });

  it('trims currentLine when maxChars exceeds completed length', () => {
    const state: TerminalBufferState = {
      completed: '',
      currentLine: 'abcdefghij',
    };
    const trimmed = trimTerminalState(state, { maxLines: 0, maxChars: 4 });
    expect(terminalDisplayText(trimmed)).toBe('ghij');
  });

  it('leaves state unchanged when limits are zero (unlimited)', () => {
    const state: TerminalBufferState = {
      completed: 'a\nb\n',
      currentLine: 'c',
    };
    expect(trimTerminalState(state, { maxLines: 0, maxChars: 0 })).toEqual(
      state,
    );
  });

  it('preserves carriage-return redraw after trimming', () => {
    let state = applyTerminalChunk(empty, 'old\n');
    state = applyTerminalChunk(state, 'new\r');
    state = applyTerminalChunk(state, 'final\n');
    const trimmed = trimTerminalState(state, { maxLines: 1, maxChars: 0 });
    expect(terminalDisplayText(trimmed)).toBe('final\n');
  });
});

describe('trimCompletedByMaxLines', () => {
  it('returns completed unchanged when within maxLines', () => {
    expect(trimCompletedByMaxLines('a\nb\n', 3)).toBe('a\nb\n');
  });
});

describe('createTerminalBuffer', () => {
  // #290: ls -la 形式
  it('issue #290: ls -la 形式の同一行 redraw で古い行を残さない', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('-rw-r--r--  1 alice  staff  123 ./foo\r');
    receive$.next('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(last).toBe('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(last).not.toContain('alice');
  });

  // #290: prompt 表示
  it('issue #290: carriage-return redraw 後に shell prompt を正しく表示する', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('login: user\r');
    receive$.next('$ ');
    expect(last).toBe('$ ');
    receive$.next('whoami\r\n');
    receive$.next('user\r\n');
    receive$.next('# ');
    expect(last.endsWith('# ')).toBe(true);
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
    const { text$ } = createTerminalBuffer(receive$, { maxLines: 2, maxChars: 0 });
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('line1\nline2\nline3\nline4');
    expect(last).toBe('line2\nline3\nline4');
  });

  it('drops leading chars when maxChars option is set', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$, { maxLines: 0, maxChars: 6 });
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('abcdef\nghij');
    expect(last).toBe('f\nghij');
  });

  it('keeps unlimited growth when maxLines and maxChars are zero', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$, {
      maxLines: 0,
      maxChars: 0,
    });
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('line1\nline2\nline3\n');
    expect(last).toBe('line1\nline2\nline3\n');
  });

  it('issue #290: preserves redraw after maxLines trim', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$, { maxLines: 1, maxChars: 0 });
    let last = '';
    text$.subscribe((t) => {
      last = t;
    });
    receive$.next('old\n');
    receive$.next('-rw-r--r--  1 alice  staff  123 ./foo\r');
    receive$.next('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(last).toBe('-rw-r--r--  1 bob    staff  123 ./foo\n');
    expect(last).not.toContain('alice');
  });
});

import { describe, expect, it } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import {
  applyTerminalChunk,
  createTerminalBuffer,
  terminalDisplayText,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-buffer';

const empty: TerminalBufferState = { completed: '', currentLine: '' };

/** Issue #290: terminal 表示の再発防止用テストケース群 */
describe('applyTerminalChunk', () => {
  // #290: A\rB
  it('issue #290: A\\rB を同一チャンクで B に畳み込む', () => {
    const s = applyTerminalChunk(empty, 'A\rB');
    expect(terminalDisplayText(s)).toBe('B');
  });

  it('issue #290: A\\rB を分割チャンクでも B に畳み込む', () => {
    let s = applyTerminalChunk(empty, 'A');
    expect(terminalDisplayText(s)).toBe('A');
    s = applyTerminalChunk(s, '\rB');
    expect(terminalDisplayText(s)).toBe('B');
  });

  // #290: A\r\nB
  it('issue #290: A\\r\\nB を通常改行として扱う', () => {
    const s = applyTerminalChunk(empty, 'a\r\nb');
    expect(terminalDisplayText(s)).toBe('a\nb');
  });

  // #290: A\nB
  it('issue #290: A\\nB を2行表示として扱う', () => {
    const s = applyTerminalChunk(empty, 'a\nb');
    expect(terminalDisplayText(s)).toBe('a\nb');
  });

  it('resolves a\\r then \\nb across chunks', () => {
    let s = applyTerminalChunk(empty, 'a\r');
    expect(terminalDisplayText(s)).toBe('');
    s = applyTerminalChunk(s, '\nb');
    expect(terminalDisplayText(s)).toBe('\nb');
  });
});

describe('createTerminalBuffer', () => {
  // #290: A\rB
  it('issue #290: text$ でも A\\rB を B に畳み込む', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    const out: string[] = [];
    text$.subscribe((t) => out.push(t));
    receive$.next('A\rB');
    expect(out.at(-1)).toBe('B');
  });

  it('handles mixed newlines in streamed chunks', () => {
    const receive$ = new Subject<string>();
    const { text$ } = createTerminalBuffer(receive$);
    const out: string[] = [];
    text$.subscribe((t) => out.push(t));
    receive$.next('line1\n');
    receive$.next('x\r\ny\r');
    receive$.next('z\n');
    expect(out.at(-1)).toBe('line1\nx\nz\n');
  });

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
});

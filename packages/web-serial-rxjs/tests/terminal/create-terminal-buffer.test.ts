import { describe, expect, it } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import {
  applyTerminalChunk,
  createTerminalBuffer,
  terminalDisplayText,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-buffer';

const empty: TerminalBufferState = { completed: '', currentLine: '' };

/** Issue #279: terminal 表示の再発防止用テストケース群 */
describe('applyTerminalChunk', () => {
  // A\rB → B（同一行の carriage-return 上書き）
  it('treats A\\rB as B on one chunk', () => {
    const s = applyTerminalChunk(empty, 'A\rB');
    expect(terminalDisplayText(s)).toBe('B');
  });

  it('treats A\\rB when split across chunks', () => {
    let s = applyTerminalChunk(empty, 'A');
    expect(terminalDisplayText(s)).toBe('A');
    s = applyTerminalChunk(s, '\rB');
    expect(terminalDisplayText(s)).toBe('B');
  });

  // A\r\nB → 正常改行（CRLF は 1 行末として扱う）
  it('renders A\\r\\nB as normal newline (issue #279)', () => {
    const s = applyTerminalChunk(empty, 'a\r\nb');
    expect(terminalDisplayText(s)).toBe('a\nb');
  });

  // A\nB → 2 行表示（論理行が LF で区切られる）
  it('renders A\\nB as two display lines (issue #279)', () => {
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
  // A\rB → B（text$ 経由でも累積表示が一致すること）
  it('emits cumulative display text with carriage-return collapse (issue #279)', () => {
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

  // ls -la 形式: 同一行の \r 上書きで列がずれないこと
  it('simulates ls-style same-line redraw without horizontal drift (issue #279)', () => {
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

  it('shows shell prompt ($ / #) after carriage-return redraw', () => {
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

import { describe, expect, it } from 'vitest';
import { Subject, firstValueFrom } from 'rxjs';
import {
  applyTerminalChunk,
  createTerminalBuffer,
  terminalDisplayText,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-buffer';

const empty: TerminalBufferState = { completed: '', currentLine: '' };

describe('applyTerminalChunk', () => {
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

  it('treats CRLF as one line end', () => {
    const s = applyTerminalChunk(empty, 'a\r\nb');
    expect(terminalDisplayText(s)).toBe('a\nb');
  });

  it('treats lone LF as line end', () => {
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
  it('emits cumulative display text with carriage-return collapse', () => {
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

  it('simulates ls-style same-line redraw without horizontal drift', () => {
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

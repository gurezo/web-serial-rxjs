import { type Observable, map, scan, shareReplay } from 'rxjs';

/** @internal Folded state between {@link createTerminalBuffer} emissions. */
export interface TerminalBufferState {
  completed: string;
  currentLine: string;
}

/**
 * Applies one raw decoder chunk to terminal display state.
 * Handles `\r\n` and lone `\n` as line endings, and lone `\r` as
 * carriage return (clear current line for redraw). Does not interpret ANSI escapes.
 *
 * @internal Exported for unit tests.
 */
export function applyTerminalChunk(
  state: TerminalBufferState,
  chunk: string,
): TerminalBufferState {
  let { completed, currentLine } = state;
  const len = chunk.length;

  for (let i = 0; i < len; i++) {
    const c = chunk.charAt(i);
    if (c === '\r') {
      const next = i + 1 < len ? chunk.charAt(i + 1) : '';
      if (next === '\n') {
        completed += currentLine + '\n';
        currentLine = '';
        i++;
      } else {
        currentLine = '';
      }
    } else if (c === '\n') {
      completed += currentLine + '\n';
      currentLine = '';
    } else {
      currentLine += c;
    }
  }

  return { completed, currentLine };
}

/** @internal */
export function terminalDisplayText(state: TerminalBufferState): string {
  return state.completed + state.currentLine;
}

export interface TerminalBuffer {
  /**
   * Cumulative text suitable for terminal-style display: completed lines plus
   * the current line, with `\r` redraws collapsed per Issue #275.
   */
  readonly text$: Observable<string>;
}

const initialTerminalState: TerminalBufferState = {
  completed: '',
  currentLine: '',
};

/**
 * Builds a terminal-oriented text stream from {@link SerialSession.receive$} (or any
 * `Observable<string>` of decoded chunks). Uses internal buffering so callers need not
 * implement carriage-return collapse themselves.
 */
export function createTerminalBuffer(
  receive$: Observable<string>,
): TerminalBuffer {
  const text$ = receive$.pipe(
    scan(
      (state, chunk: string) => applyTerminalChunk(state, chunk),
      initialTerminalState,
    ),
    map(terminalDisplayText),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  return { text$ };
}

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

/** Resolved limits for {@link trimTerminalState}. `0` means unlimited. */
export interface TerminalBufferLimits {
  maxLines: number;
  maxChars: number;
}

/** @internal Count newline-terminated rows in `completed`. */
export function countCompletedLines(completed: string): number {
  if (completed.length === 0) {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < completed.length; i++) {
    if (completed.charAt(i) === '\n') {
      count++;
    }
  }
  return count;
}

/**
 * Drops oldest completed lines when `maxLines` is exceeded.
 *
 * @internal Exported for unit tests.
 */
export function trimCompletedByMaxLines(
  completed: string,
  maxLines: number,
): string {
  if (maxLines <= 0) {
    return completed;
  }

  let trimmed = completed;
  while (countCompletedLines(trimmed) > maxLines) {
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline < 0) {
      break;
    }
    trimmed = trimmed.slice(firstNewline + 1);
  }
  return trimmed;
}

/**
 * Trims {@link TerminalBufferState} to respect memory limits. Oldest
 * `completed` content is removed first; `currentLine` is trimmed only when
 * the display text still exceeds `maxChars` after `completed` is empty.
 *
 * @internal Exported for unit tests.
 */
export function trimTerminalState(
  state: TerminalBufferState,
  limits: TerminalBufferLimits,
): TerminalBufferState {
  let { completed, currentLine } = state;

  if (limits.maxLines > 0) {
    completed = trimCompletedByMaxLines(completed, limits.maxLines);
  }

  if (limits.maxChars > 0) {
    let total = completed.length + currentLine.length;
    while (total > limits.maxChars) {
      const excess = total - limits.maxChars;
      if (completed.length >= excess) {
        completed = completed.slice(excess);
        break;
      }
      const removeFromCurrent = excess - completed.length;
      completed = '';
      currentLine = currentLine.slice(removeFromCurrent);
      total = completed.length + currentLine.length;
    }
  }

  return { completed, currentLine };
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

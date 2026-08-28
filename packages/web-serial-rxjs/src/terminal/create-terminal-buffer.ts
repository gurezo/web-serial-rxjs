import {
  type Observable,
  ReplaySubject,
  finalize,
  map,
  scan,
  share,
} from 'rxjs';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import {
  brandMaxChars,
  brandMaxLines,
  type MaxChars,
  type MaxLines,
} from '../internal/branded-numbers';
import {
  createTerminalParser,
  emptyTerminalState,
  type TerminalBufferState,
} from './create-terminal-parser';

export type { TerminalBufferState };

/**
 * Applies one raw decoder chunk to terminal display state.
 * Handles `\r\n` and lone `\n` as line endings, and lone `\r` as
 * carriage return (clear current line for redraw). When
 * {@link TerminalBufferOptions.stripAnsi} is enabled (default), ANSI escape
 * sequences are removed before line folding.
 *
 * @internal Exported for unit tests.
 */
export function applyTerminalChunk(
  state: TerminalBufferState,
  chunk: string,
): TerminalBufferState {
  const parser = createTerminalParser({ stripAnsi: false });
  parser.restoreState(state);
  return parser.feed(chunk);
}

/** @internal */
export function terminalDisplayText(state: TerminalBufferState): string {
  return state.completed + state.currentLine;
}

/** Resolved limits for {@link trimTerminalState}. `0` means unlimited. */
export interface TerminalBufferLimits {
  maxLines: MaxLines;
  maxChars: MaxChars;
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
 * Uses at most two linear scans and a single `slice()` so bulk line drops
 * stay O(n) instead of rescanning the full string per removed line.
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

  const lineCount = countCompletedLines(completed);
  if (lineCount <= maxLines) {
    return completed;
  }

  const linesToDrop = lineCount - maxLines;
  let dropped = 0;
  for (let i = 0; i < completed.length; i++) {
    if (completed.charAt(i) === '\n') {
      dropped++;
      if (dropped === linesToDrop) {
        return completed.slice(i + 1);
      }
    }
  }
  return completed;
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

/**
 * Options for {@link createTerminalBuffer} memory limits.
 *
 * Character counts use UTF-16 string length (JavaScript `.length`).
 * Pass `0` for `maxLines` or `maxChars` to disable that limit (unlimited).
 */
export interface TerminalBufferOptions {
  /**
   * Maximum number of completed lines to retain in the display buffer.
   * `0` means unlimited. Must be a safe integer `>= 0` when validated.
   *
   * @default 10000
   */
  maxLines?: number;

  /**
   * Maximum total characters in the cumulative display text
   * (`completed` + `currentLine`). Oldest content is dropped first.
   * `0` means unlimited. Must be a safe integer `>= 0` when validated.
   *
   * @default 1048576
   */
  maxChars?: number;

  /**
   * When `true`, strips ANSI escape sequences from incoming chunks before
   * folding carriage-return redraws. Use `false` to preserve raw escape
   * codes in {@link TerminalBuffer.text$}.
   *
   * @default true
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/428 | Issue #428}
   */
  stripAnsi?: boolean;
}

/** Default limits applied when options are omitted. */
export const DEFAULT_TERMINAL_BUFFER_OPTIONS: Required<TerminalBufferOptions> =
  {
    maxLines: 10_000,
    maxChars: 1_048_576,
    stripAnsi: true,
  };

/** Resolved terminal buffer options with validated branded numeric fields. */
export type ResolvedTerminalBufferOptions = {
  maxLines: MaxLines;
  maxChars: MaxChars;
  stripAnsi: boolean;
};

/**
 * Merge and validate {@link TerminalBufferOptions}.
 *
 * This is the single normalization path for terminal buffer defaults and
 * boundary checks (session factory and standalone {@link createTerminalBuffer}).
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS}
 *         when `maxLines` or `maxChars` are out of range.
 */
export function resolveTerminalBufferOptions(
  options?: TerminalBufferOptions,
): ResolvedTerminalBufferOptions {
  const merged: Required<TerminalBufferOptions> = {
    ...DEFAULT_TERMINAL_BUFFER_OPTIONS,
    ...options,
  };

  const { maxLines, maxChars } = merged;

  if (!Number.isSafeInteger(maxLines) || maxLines < 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
      `Invalid terminalBuffer.maxLines: ${maxLines}. Must be a safe integer >= 0.`,
      undefined,
      {
        field: 'terminalBuffer.maxLines',
        value: maxLines,
        constraint: 'non-negative-safe-integer',
      },
    );
  }

  if (!Number.isSafeInteger(maxChars) || maxChars < 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
      `Invalid terminalBuffer.maxChars: ${maxChars}. Must be a safe integer >= 0.`,
      undefined,
      {
        field: 'terminalBuffer.maxChars',
        value: maxChars,
        constraint: 'non-negative-safe-integer',
      },
    );
  }

  return {
    maxLines: brandMaxLines(maxLines),
    maxChars: brandMaxChars(maxChars),
    stripAnsi: merged.stripAnsi,
  };
}

/**
 * Builds a terminal-oriented text stream from {@link SerialSession.receive$} (or any
 * `Observable<string>` of decoded chunks). Uses internal buffering so callers need not
 * implement carriage-return collapse themselves.
 *
 * By default, retains at most {@link DEFAULT_TERMINAL_BUFFER_OPTIONS.maxLines}
 * completed lines and {@link DEFAULT_TERMINAL_BUFFER_OPTIONS.maxChars} characters
 * so long-running sessions do not grow memory without bound. Pass `0` for either
 * limit to disable that constraint.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/370 | Issue #370}
 */
export function createTerminalBuffer(
  receive$: Observable<string>,
  options?: TerminalBufferOptions,
): TerminalBuffer {
  const resolved = resolveTerminalBufferOptions(options);
  const limits: TerminalBufferLimits = {
    maxLines: resolved.maxLines,
    maxChars: resolved.maxChars,
  };
  const parser = createTerminalParser({ stripAnsi: resolved.stripAnsi });

  const text$ = receive$.pipe(
    scan((_state, chunk: string) => {
      parser.feed(chunk);
      const trimmed = trimTerminalState(parser.getState(), limits);
      parser.restoreState(trimmed);
      return trimmed;
    }, emptyTerminalState),
    map(terminalDisplayText),
    finalize(() => {
      parser.reset();
    }),
    share({
      connector: () => new ReplaySubject<string>(1),
      resetOnRefCountZero: true,
    }),
  );

  return { text$ };
}

import { createNewlineTokenizer } from '../internal/newline-tokenizer';
import {
  createAnsiStripper,
  type AnsiStripper,
} from '../internal/strip-ansi-sequences';

/** @internal Folded state between terminal parser feeds. */
export interface TerminalBufferState {
  completed: string;
  currentLine: string;
}

/** Options for {@link createTerminalParser}. */
export interface TerminalParserOptions {
  /**
   * When `true`, strips ANSI escape sequences before newline folding.
   *
   * @default false
   */
  stripAnsi?: boolean;
}

/**
 * Streaming terminal parser that owns newline tokenizer state, optional ANSI
 * stripper state, and completed line accumulation.
 *
 * @internal
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/590 | Issue #590}
 */
export interface TerminalParser {
  feed(chunk: string): TerminalBufferState;
  reset(): void;
  getState(): TerminalBufferState;
  restoreState(state: TerminalBufferState): void;
}

const emptyTerminalState: TerminalBufferState = {
  completed: '',
  currentLine: '',
};

/**
 * Creates a terminal parser with a persistent newline tokenizer and optional
 * ANSI stripper. All streaming mutable state lives on the returned instance.
 *
 * @internal
 */
export function createTerminalParser(
  options: TerminalParserOptions = {},
): TerminalParser {
  const stripAnsi = options.stripAnsi ?? false;
  const tokenizer = createNewlineTokenizer('terminal');
  let ansiStripper: AnsiStripper | null = stripAnsi ? createAnsiStripper() : null;
  let completed = '';

  const resetAnsiStripper = (): void => {
    ansiStripper = stripAnsi ? createAnsiStripper() : null;
  };

  const getState = (): TerminalBufferState => ({
    completed,
    currentLine: tokenizer.getPendingText(),
  });

  const restoreState = (state: TerminalBufferState): void => {
    completed = state.completed;
    tokenizer.restorePending(state.currentLine);
  };

  const reset = (): void => {
    completed = '';
    tokenizer.clear();
    resetAnsiStripper();
  };

  const feed = (chunk: string): TerminalBufferState => {
    const normalized =
      ansiStripper !== null ? ansiStripper.feed(chunk) : chunk;
    const events = tokenizer.feed(normalized);

    for (const event of events) {
      if (event.type === 'line') {
        completed += event.content + '\n';
      }
    }

    return getState();
  };

  return {
    feed,
    reset,
    getState,
    restoreState,
  };
}

export { emptyTerminalState };

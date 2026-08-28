import { describe, expect, it } from 'vitest';
import {
  createTerminalParser,
  type TerminalBufferState,
} from '../../src/terminal/create-terminal-parser';

const empty: TerminalBufferState = { completed: '', currentLine: '' };

describe('createTerminalParser', () => {
  it('feeds chunks with a persistent tokenizer', () => {
    const parser = createTerminalParser();
    expect(parser.feed('part')).toEqual({ completed: '', currentLine: 'part' });
    expect(parser.feed('ial\n')).toEqual({
      completed: 'partial\n',
      currentLine: '',
    });
  });

  it('strips ansi when stripAnsi is enabled', () => {
    const parser = createTerminalParser({ stripAnsi: true });
    parser.feed('hello\u001b[');
    expect(parser.getState()).toEqual({ completed: '', currentLine: 'hello' });
    expect(parser.feed('01;34mworld\n')).toEqual({
      completed: 'helloworld\n',
      currentLine: '',
    });
  });

  it('reset clears completed, pending line, and ansi state', () => {
    const parser = createTerminalParser({ stripAnsi: true });
    parser.feed('hello\u001b[');
    parser.reset();
    expect(parser.getState()).toEqual(empty);
    expect(parser.feed('plain\n')).toEqual({
      completed: 'plain\n',
      currentLine: '',
    });
  });

  it('restoreState rehydrates parser for pure chunk application', () => {
    const parser = createTerminalParser();
    parser.restoreState({ completed: 'done\n', currentLine: 'pending' });
    expect(parser.feed('\n')).toEqual({
      completed: 'done\npending\n',
      currentLine: '',
    });
  });
});

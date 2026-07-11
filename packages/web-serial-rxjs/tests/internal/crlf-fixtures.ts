/**
 * Shared CR/LF regression fixtures for line-buffer and terminal-buffer.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/376 | Issue #376}
 */
export type CrlfFixture = {
  id: string;
  chunks: string[];
  line: { linesPerFeed: string[][] };
  terminal: string;
};

export const CRLF_FIXTURES: CrlfFixture[] = [
  {
    id: 'lf-single',
    chunks: ['a\n'],
    line: { linesPerFeed: [['a']] },
    terminal: 'a\n',
  },
  {
    id: 'crlf-single',
    chunks: ['a\r\n'],
    line: { linesPerFeed: [['a']] },
    terminal: 'a\n',
  },
  {
    id: 'crlf-split',
    chunks: ['a\r', '\n'],
    line: { linesPerFeed: [[], ['a']] },
    terminal: '\n',
  },
  {
    id: 'interior-cr',
    chunks: ['A\rB\n'],
    line: { linesPerFeed: [['A', 'B']] },
    terminal: 'B\n',
  },
  {
    id: 'interior-cr-split',
    chunks: ['a\r', 'b\n'],
    line: { linesPerFeed: [[], ['a', 'b']] },
    terminal: 'b\n',
  },
  {
    id: 'cr-redraw',
    chunks: ['A\rB'],
    line: { linesPerFeed: [['A']] },
    terminal: 'B',
  },
  {
    id: 'cr-redraw-split',
    chunks: ['A', '\rB'],
    line: { linesPerFeed: [[], ['A']] },
    terminal: 'B',
  },
  {
    id: 'cr-then-lf-not-crlf',
    chunks: ['a\r', '\nb'],
    line: { linesPerFeed: [[], ['a']] },
    terminal: '\nb',
  },
  {
    id: 'multi-lf',
    chunks: ['a\nb\n'],
    line: { linesPerFeed: [['a', 'b']] },
    terminal: 'a\nb\n',
  },
  {
    id: 'mixed-stream',
    chunks: ['line1\n', 'x\r\ny\r', 'z\n'],
    line: {
      linesPerFeed: [['line1'], ['x'], ['y', 'z']],
    },
    terminal: 'line1\nx\nz\n',
  },
];

import { describe, expect, it } from 'vitest';
import {
  appendExampleLineEnding,
  DEFAULT_EXAMPLE_LINE_ENDING,
  EXAMPLE_LINE_ENDING_OPTIONS,
  getExampleLineEndingSuffix,
  type ExampleLineEnding,
} from './example-line-ending';

describe('DEFAULT_EXAMPLE_LINE_ENDING', () => {
  it('defaults to lf for backward compatibility', () => {
    expect(DEFAULT_EXAMPLE_LINE_ENDING).toBe('lf');
  });
});

describe('EXAMPLE_LINE_ENDING_OPTIONS', () => {
  it('exposes four options with escape-visible labels', () => {
    expect(EXAMPLE_LINE_ENDING_OPTIONS.map((o) => o.value)).toEqual([
      'none',
      'lf',
      'cr',
      'crlf',
    ]);
    expect(EXAMPLE_LINE_ENDING_OPTIONS.map((o) => o.label)).toEqual([
      'None',
      'LF (\\n)',
      'CR (\\r)',
      'CRLF (\\r\\n)',
    ]);
  });
});

describe('getExampleLineEndingSuffix', () => {
  it.each<[ExampleLineEnding, string]>([
    ['none', ''],
    ['lf', '\n'],
    ['cr', '\r'],
    ['crlf', '\r\n'],
  ])('%s → %j', (ending, expected) => {
    expect(getExampleLineEndingSuffix(ending)).toBe(expected);
  });
});

describe('appendExampleLineEnding', () => {
  it.each<[ExampleLineEnding, string]>([
    ['none', 'hello'],
    ['lf', 'hello\n'],
    ['cr', 'hello\r'],
    ['crlf', 'hello\r\n'],
  ])('appends %s', (ending, expected) => {
    expect(appendExampleLineEnding('hello', ending)).toBe(expected);
  });
});

/**
 * Line ending choices for Example send UI.
 */
export type ExampleLineEnding = 'none' | 'lf' | 'cr' | 'crlf';

/** Default matches the previous hard-coded `\n` append behavior. */
export const DEFAULT_EXAMPLE_LINE_ENDING: ExampleLineEnding = 'lf';

export interface ExampleLineEndingOption {
  readonly value: ExampleLineEnding;
  readonly label: string;
}

/**
 * Options for Example send-UI `<select>` labels.
 * Escape sequences are shown so invisible characters are visible.
 */
export const EXAMPLE_LINE_ENDING_OPTIONS: readonly ExampleLineEndingOption[] = [
  { value: 'none', label: 'None' },
  { value: 'lf', label: 'LF (\\n)' },
  { value: 'cr', label: 'CR (\\r)' },
  { value: 'crlf', label: 'CRLF (\\r\\n)' },
] as const;

const SUFFIX_BY_ENDING: Record<ExampleLineEnding, string> = {
  none: '',
  lf: '\n',
  cr: '\r',
  crlf: '\r\n',
};

/**
 * Returns the byte suffix for the selected line ending.
 */
export function getExampleLineEndingSuffix(ending: ExampleLineEnding): string {
  return SUFFIX_BY_ENDING[ending];
}

/**
 * Appends the selected line ending to `text` for Example send handlers.
 */
export function appendExampleLineEnding(
  text: string,
  ending: ExampleLineEnding,
): string {
  return text + getExampleLineEndingSuffix(ending);
}

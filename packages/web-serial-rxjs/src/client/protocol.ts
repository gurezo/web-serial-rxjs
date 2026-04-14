export interface SerialCommandOptions {
  /**
   * Prompt matcher used to detect command completion.
   *
   * @default '$ '
   */
  prompt?: string | RegExp;
  /**
   * Timeout in milliseconds while waiting for prompt.
   *
   * @default 10000
   */
  timeout?: number;
  /**
   * Line ending appended to command payload.
   *
   * @default '\r\n'
   */
  lineEnding?: string;
}

export interface CommandResult {
  stdout: string;
}

export interface SerialRequest<T> {
  payload: string | Uint8Array;
  collect: (stdout: string) => T;
  prompt?: string | RegExp;
  timeout?: number;
  lineEnding?: string;
}

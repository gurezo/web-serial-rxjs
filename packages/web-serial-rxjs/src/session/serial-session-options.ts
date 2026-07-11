import type { TerminalBufferOptions } from '../terminal/create-terminal-buffer';
import { DEFAULT_TERMINAL_BUFFER_OPTIONS } from '../terminal/create-terminal-buffer';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import {
  DEFAULT_LINE_BUFFER_OPTIONS,
  type LineBufferOptions,
} from './internal/line-buffer';

/**
 * Options for creating a {@link SerialSession} via {@link createSerialSession}.
 *
 * These options configure the serial port connection parameters used when
 * calling `port.open` and `navigator.serial.requestPort`. All properties
 * are optional; omitted fields fall back to {@link DEFAULT_SERIAL_SESSION_OPTIONS}.
 *
 * @example
 * ```typescript
 * const session = createSerialSession({
 *   baudRate: 115200,
 *   dataBits: 8,
 *   stopBits: 1,
 *   parity: 'none',
 *   flowControl: 'none',
 *   filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
 * });
 * ```
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 */
export interface SerialSessionOptions {
  /**
   * Baud rate for the serial port connection (bits per second).
   *
   * Common values include 9600, 19200, 38400, 57600, 115200, etc.
   * Must match the baud rate configured on the connected device.
   *
   * @default 9600
   */
  baudRate?: number;

  /**
   * Number of data bits per character (7 or 8).
   *
   * @default 8
   */
  dataBits?: 7 | 8;

  /**
   * Number of stop bits (1 or 2).
   *
   * @default 1
   */
  stopBits?: 1 | 2;

  /**
   * Parity checking mode.
   *
   * @default 'none'
   */
  parity?: 'none' | 'even' | 'odd';

  /**
   * Buffer size for the underlying read stream, in bytes.
   *
   * @default 255
   */
  bufferSize?: number;

  /**
   * Flow control mode.
   *
   * @default 'none'
   */
  flowControl?: 'none' | 'hardware';

  /**
   * Filters for port selection when requesting a port.
   *
   * When specified, the port selection dialog will only show devices
   * matching these filters. Each filter can specify `usbVendorId` and/or
   * `usbProductId`.
   */
  filters?: SerialPortFilter[];

  /**
   * Optional receive replay: retain recent decoded text **chunks** so late
   * subscribers to {@link SerialSession.receiveReplay$} can read buffered
   * data while a connection is active. Does not change {@link SerialSession.receive$}.
   *
   * @default `{ enabled: false, bufferSize: 512 }` (see {@link DEFAULT_SERIAL_SESSION_OPTIONS})
   */
  receiveReplay?: SerialSessionReceiveReplayOptions;

  /**
   * Limits for {@link SerialSession.terminalText$} display memory. Oldest
   * completed lines and leading characters are dropped when exceeded.
   *
   * @default `{ maxLines: 10000, maxChars: 1048576 }` (see {@link DEFAULT_SERIAL_SESSION_OPTIONS})
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/370 | Issue #370}
   */
  terminalBuffer?: TerminalBufferOptions;

  /**
   * Limits for the incomplete line tail held by {@link SerialSession.lines$}
   * framing. When exceeded, leading characters are discarded and a non-fatal
   * {@link SerialErrorCode.LINE_BUFFER_OVERFLOW} is emitted on {@link SerialSession.errors$}.
   *
   * @default `{ maxChars: 1048576 }` (see {@link DEFAULT_SERIAL_SESSION_OPTIONS})
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/371 | Issue #371}
   */
  lineBuffer?: LineBufferOptions;
}

/**
 * Options for {@link SerialSessionOptions.receiveReplay}.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/265 | Issue #265}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/372 | Issue #372}
 */
export interface SerialSessionReceiveReplayOptions {
  /**
   * When `true`, the session uses a replay buffer for {@link SerialSession.receiveReplay$}
   * for each open connection. When `false` (default), `receiveReplay$` is
   * the same hot stream as {@link SerialSession.receive$} (no chunk replay).
   */
  enabled?: boolean;

  /**
   * Retains the last **N** decoded text chunks (one emission per `onChunk`
   * from the read pump) in the replay buffer. Not the character count. Higher
   * `bufferSize` uses more memory.
   *
   * @default 512
   */
  bufferSize?: number;

  /**
   * Maximum total characters retained across buffered replay chunks for the
   * active connection. When exceeded, oldest chunks are discarded. `0` means
   * unlimited (only `bufferSize` applies).
   *
   * @default 0
   */
  maxChars?: number;
}

/** Maximum allowed {@link SerialSessionReceiveReplayOptions.bufferSize}. */
export const MAX_RECEIVE_REPLAY_BUFFER_SIZE = 65_536;

/** Maximum allowed {@link SerialSessionReceiveReplayOptions.maxChars}. */
export const MAX_RECEIVE_REPLAY_MAX_CHARS = 1_048_576;

const DEFAULT_RECEIVE_REPLAY: Required<SerialSessionReceiveReplayOptions> = {
  enabled: false,
  bufferSize: 512,
  maxChars: 0,
};

/**
 * Merge and validate {@link SerialSessionReceiveReplayOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS}
 *         when `bufferSize` or `maxChars` are out of range.
 */
export function resolveReceiveReplayOptions(
  options?: SerialSessionReceiveReplayOptions,
): Required<SerialSessionReceiveReplayOptions> {
  const merged: Required<SerialSessionReceiveReplayOptions> = {
    ...DEFAULT_RECEIVE_REPLAY,
    ...options,
  };

  const { bufferSize, maxChars } = merged;

  if (
    !Number.isSafeInteger(bufferSize) ||
    bufferSize < 1 ||
    bufferSize > MAX_RECEIVE_REPLAY_BUFFER_SIZE
  ) {
    throw new SerialError(
      SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS,
      `Invalid receiveReplay.bufferSize: ${bufferSize}. Must be a safe integer between 1 and ${MAX_RECEIVE_REPLAY_BUFFER_SIZE}.`,
    );
  }

  if (
    !Number.isSafeInteger(maxChars) ||
    maxChars < 0 ||
    maxChars > MAX_RECEIVE_REPLAY_MAX_CHARS
  ) {
    throw new SerialError(
      SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS,
      `Invalid receiveReplay.maxChars: ${maxChars}. Must be a safe integer between 0 and ${MAX_RECEIVE_REPLAY_MAX_CHARS}.`,
    );
  }

  return merged;
}

/**
 * Fully resolved session options after merging {@link SerialSessionOptions}
 * with {@link DEFAULT_SERIAL_SESSION_OPTIONS}. All invariant fields are
 * required; `filters` remains optional.
 */
export type ResolvedSerialSessionOptions = Required<
  Omit<SerialSessionOptions, 'filters' | 'receiveReplay' | 'terminalBuffer' | 'lineBuffer'>
> & {
  filters?: SerialPortFilter[];
  receiveReplay: Required<SerialSessionReceiveReplayOptions>;
  terminalBuffer: Required<TerminalBufferOptions>;
  lineBuffer: Required<LineBufferOptions>;
};

/**
 * Default values applied to omitted {@link SerialSessionOptions} fields.
 *
 * @internal
 */
export const DEFAULT_SERIAL_SESSION_OPTIONS = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,
  flowControl: 'none',
  receiveReplay: { ...DEFAULT_RECEIVE_REPLAY },
  terminalBuffer: { ...DEFAULT_TERMINAL_BUFFER_OPTIONS },
  lineBuffer: { ...DEFAULT_LINE_BUFFER_OPTIONS },
} satisfies ResolvedSerialSessionOptions;

/**
 * Merge and validate {@link SerialSessionOptions} into a fully resolved
 * options object for internal session use.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS}
 *         when `receiveReplay` values are out of range.
 */
export function resolveSerialSessionOptions(
  options?: SerialSessionOptions,
): ResolvedSerialSessionOptions {
  return {
    ...DEFAULT_SERIAL_SESSION_OPTIONS,
    ...options,
    receiveReplay: resolveReceiveReplayOptions(options?.receiveReplay),
    terminalBuffer: {
      ...DEFAULT_SERIAL_SESSION_OPTIONS.terminalBuffer,
      ...options?.terminalBuffer,
    },
    lineBuffer: {
      ...DEFAULT_SERIAL_SESSION_OPTIONS.lineBuffer,
      ...options?.lineBuffer,
    },
  };
}

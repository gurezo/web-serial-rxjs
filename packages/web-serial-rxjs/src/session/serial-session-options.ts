import {
  brandBaudRate,
  brandMaxChars,
  brandMaxLines,
  brandReceiveReplayBufferSize,
  brandSerialPortBufferSize,
  type BaudRate,
  type MaxChars,
  type MaxLines,
  type ReceiveReplayBufferSize,
  type SerialPortBufferSize,
} from '../internal/branded-numbers';
import type { TerminalBufferOptions } from '../terminal/create-terminal-buffer';
import { DEFAULT_TERMINAL_BUFFER_OPTIONS } from '../terminal/create-terminal-buffer';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import {
  DEFAULT_LINE_BUFFER_OPTIONS,
  type LineBufferOptions,
} from './internal/line-buffer';
import { validateSerialPortFilters } from './internal/validate-serial-port-filters';

/**
 * W3C connection fields shared with {@link SerialOptions}.
 *
 * @internal
 */
type SerialSessionConnectionFields = Pick<
  SerialOptions,
  'baudRate' | 'dataBits' | 'stopBits' | 'parity' | 'bufferSize' | 'flowControl'
>;

/**
 * Options for creating a {@link SerialSession} via {@link createSerialSession}.
 *
 * Connection parameters (`baudRate`, `dataBits`, `stopBits`, `parity`,
 * `bufferSize`, `flowControl`) are derived from the W3C {@link SerialOptions}
 * type and passed to `port.open`. All connection fields are optional here;
 * omitted values fall back to {@link DEFAULT_SERIAL_SESSION_OPTIONS}
 * (`baudRate` 9600, `dataBits` 8, `stopBits` 1, `parity` `'none'`,
 * `bufferSize` 255, `flowControl` `'none'`).
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
 * @see {@link SerialOptions}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/402 | Issue #402}
 */
export interface SerialSessionOptions
  extends Partial<SerialSessionConnectionFields> {
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
/** Resolved receive replay options with validated branded numeric fields. */
export type ResolvedSerialSessionReceiveReplayOptions = {
  enabled: boolean;
  bufferSize: ReceiveReplayBufferSize;
  maxChars: MaxChars;
};

export function resolveReceiveReplayOptions(
  options?: SerialSessionReceiveReplayOptions,
): ResolvedSerialSessionReceiveReplayOptions {
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

  return {
    enabled: merged.enabled,
    bufferSize: brandReceiveReplayBufferSize(bufferSize),
    maxChars: brandMaxChars(maxChars),
  };
}

/**
 * Merge and validate {@link TerminalBufferOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS}
 *         when `maxLines` or `maxChars` are out of range.
 */
/** Resolved terminal buffer options with validated branded numeric fields. */
export type ResolvedTerminalBufferOptions = {
  maxLines: MaxLines;
  maxChars: MaxChars;
};

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
    );
  }

  if (!Number.isSafeInteger(maxChars) || maxChars < 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS,
      `Invalid terminalBuffer.maxChars: ${maxChars}. Must be a safe integer >= 0.`,
    );
  }

  return {
    maxLines: brandMaxLines(maxLines),
    maxChars: brandMaxChars(maxChars),
  };
}

/**
 * Merge and validate {@link LineBufferOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS}
 *         when `maxChars` is out of range.
 */
/** Resolved line buffer options with validated branded numeric fields. */
export type ResolvedLineBufferOptions = {
  maxChars: MaxChars;
};

export function resolveLineBufferOptions(
  options?: LineBufferOptions,
): ResolvedLineBufferOptions {
  const merged: Required<LineBufferOptions> = {
    ...DEFAULT_LINE_BUFFER_OPTIONS,
    ...options,
  };

  const { maxChars } = merged;

  if (!Number.isSafeInteger(maxChars) || maxChars < 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS,
      `Invalid lineBuffer.maxChars: ${maxChars}. Must be a safe integer >= 0.`,
    );
  }

  return {
    maxChars: brandMaxChars(maxChars),
  };
}

/**
 * Fully resolved session options after merging {@link SerialSessionOptions}
 * with {@link DEFAULT_SERIAL_SESSION_OPTIONS}. All invariant fields are
 * required; `filters` remains optional.
 */
export type ResolvedSerialSessionOptions = Required<
  Omit<
    SerialSessionOptions,
    | 'filters'
    | 'receiveReplay'
    | 'terminalBuffer'
    | 'lineBuffer'
    | 'baudRate'
    | 'bufferSize'
  >
> & {
  baudRate: BaudRate;
  bufferSize: SerialPortBufferSize;
  filters?: SerialPortFilter[];
  receiveReplay: ResolvedSerialSessionReceiveReplayOptions;
  terminalBuffer: ResolvedTerminalBufferOptions;
  lineBuffer: ResolvedLineBufferOptions;
};

/**
 * Default values applied to omitted {@link SerialSessionOptions} fields.
 *
 * @internal
 */
export const DEFAULT_SERIAL_SESSION_OPTIONS = {
  baudRate: brandBaudRate(9600),
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: brandSerialPortBufferSize(255),
  flowControl: 'none',
  receiveReplay: resolveReceiveReplayOptions(),
  terminalBuffer: resolveTerminalBufferOptions(),
  lineBuffer: resolveLineBufferOptions(),
} satisfies ResolvedSerialSessionOptions;

/** Resolved W3C connection fields for {@link ResolvedSerialSessionOptions}. */
export type ResolvedSerialSessionConnectionOptions = {
  baudRate: BaudRate;
  dataBits: SerialSessionConnectionFields['dataBits'];
  stopBits: SerialSessionConnectionFields['stopBits'];
  parity: SerialSessionConnectionFields['parity'];
  bufferSize: SerialPortBufferSize;
  flowControl: SerialSessionConnectionFields['flowControl'];
};

/**
 * Merge and validate W3C connection fields from {@link SerialSessionOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_CONNECTION_OPTIONS}
 *         when `baudRate` is out of range.
 */
export function resolveConnectionOptions(
  options?: Pick<
    SerialSessionOptions,
    'baudRate' | 'dataBits' | 'stopBits' | 'parity' | 'bufferSize' | 'flowControl'
  >,
): ResolvedSerialSessionConnectionOptions {
  const merged = {
    baudRate: DEFAULT_SERIAL_SESSION_OPTIONS.baudRate,
    dataBits: DEFAULT_SERIAL_SESSION_OPTIONS.dataBits,
    stopBits: DEFAULT_SERIAL_SESSION_OPTIONS.stopBits,
    parity: DEFAULT_SERIAL_SESSION_OPTIONS.parity,
    bufferSize: DEFAULT_SERIAL_SESSION_OPTIONS.bufferSize,
    flowControl: DEFAULT_SERIAL_SESSION_OPTIONS.flowControl,
    ...options,
  };

  const { baudRate } = merged;

  if (!Number.isSafeInteger(baudRate) || baudRate <= 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_CONNECTION_OPTIONS,
      `Invalid baudRate: ${baudRate}. Must be a safe integer > 0.`,
    );
  }

  return {
    dataBits: merged.dataBits,
    stopBits: merged.stopBits,
    parity: merged.parity,
    flowControl: merged.flowControl,
    baudRate: brandBaudRate(baudRate),
    bufferSize: brandSerialPortBufferSize(merged.bufferSize),
  };
}

/**
 * Merge and validate {@link SerialSessionOptions} into a fully resolved
 * options object for internal session use.
 *
 * @throws {@link SerialError} when option values are out of range:
 *         {@link SerialErrorCode.INVALID_CONNECTION_OPTIONS},
 *         {@link SerialErrorCode.INVALID_FILTER_OPTIONS},
 *         {@link SerialErrorCode.INVALID_RECEIVE_REPLAY_OPTIONS},
 *         {@link SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS}, or
 *         {@link SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS}.
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/403 | Issue #403}
 */
export function resolveSerialSessionOptions(
  options?: SerialSessionOptions,
): ResolvedSerialSessionOptions {
  const connection = resolveConnectionOptions(options);
  const filters = validateSerialPortFilters(options?.filters);

  return {
    ...connection,
    ...(filters !== undefined ? { filters } : {}),
    receiveReplay: resolveReceiveReplayOptions(options?.receiveReplay),
    terminalBuffer: resolveTerminalBufferOptions(options?.terminalBuffer),
    lineBuffer: resolveLineBufferOptions(options?.lineBuffer),
  };
}

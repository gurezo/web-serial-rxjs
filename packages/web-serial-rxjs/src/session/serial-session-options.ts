import {
  brandBaudRate,
  brandMaxChars,
  brandMaxLines,
  brandSerialPortBufferSize,
  type BaudRate,
  type MaxChars,
  type MaxLines,
  type SerialPortBufferSize,
} from '../internal/branded-numbers';
import type { SerialConnectionOptions } from '../types';
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
 * Library-specific options for {@link createSerialSession} that are not passed
 * to W3C `port.open`.
 *
 * @see {@link SerialConnectionOptions} for W3C connection parameters
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/441 | Issue #441}
 */
export interface SerialSessionFeatureOptions {
  /**
   * Filters for port selection when requesting a port.
   *
   * When specified, the port selection dialog will only show devices
   * matching these filters. Each filter can specify `usbVendorId` and/or
   * `usbProductId`.
   */
  filters?: SerialPortFilter[];

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
 * Options for creating a {@link SerialSession} via {@link createSerialSession}.
 *
 * Composes {@link Partial}<{@link SerialConnectionOptions}> (W3C connection
 * parameters passed to `port.open`) with {@link SerialSessionFeatureOptions}
 * (library-specific session features). All connection fields are optional;
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
 * @see {@link SerialConnectionOptions}
 * @see {@link SerialSessionFeatureOptions}
 * @see {@link SerialOptions}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/402 | Issue #402}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/441 | Issue #441}
 */
export interface SerialSessionOptions
  extends Partial<SerialConnectionOptions>, SerialSessionFeatureOptions {}

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
  stripAnsi: boolean;
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
      undefined,
      {
        field: 'lineBuffer.maxChars',
        value: maxChars,
        constraint: 'non-negative-safe-integer',
      },
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
    | 'terminalBuffer'
    | 'lineBuffer'
    | 'baudRate'
    | 'bufferSize'
  >
> & {
  baudRate: BaudRate;
  bufferSize: SerialPortBufferSize;
  filters?: SerialPortFilter[];
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
  terminalBuffer: resolveTerminalBufferOptions(),
  lineBuffer: resolveLineBufferOptions(),
} satisfies ResolvedSerialSessionOptions;

/** Resolved W3C connection fields for {@link ResolvedSerialSessionOptions}. */
export type ResolvedSerialSessionConnectionOptions = Required<
  Omit<SerialConnectionOptions, 'baudRate' | 'bufferSize'>
> & {
  baudRate: BaudRate;
  bufferSize: SerialPortBufferSize;
};

/**
 * Merge and validate W3C connection fields from {@link SerialSessionOptions}.
 *
 * @throws {@link SerialError} with {@link SerialErrorCode.INVALID_CONNECTION_OPTIONS}
 *         when `baudRate` is out of range.
 */
export function resolveConnectionOptions(
  options?: Partial<SerialConnectionOptions>,
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

  const { baudRate, bufferSize } = merged;

  if (!Number.isSafeInteger(baudRate) || baudRate <= 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_CONNECTION_OPTIONS,
      `Invalid baudRate: ${baudRate}. Must be a safe integer > 0.`,
      undefined,
      {
        field: 'baudRate',
        value: baudRate,
        constraint: 'positive-safe-integer',
      },
    );
  }

  return {
    dataBits: merged.dataBits ?? DEFAULT_SERIAL_SESSION_OPTIONS.dataBits,
    stopBits: merged.stopBits ?? DEFAULT_SERIAL_SESSION_OPTIONS.stopBits,
    parity: merged.parity ?? DEFAULT_SERIAL_SESSION_OPTIONS.parity,
    flowControl:
      merged.flowControl ?? DEFAULT_SERIAL_SESSION_OPTIONS.flowControl,
    baudRate: brandBaudRate(baudRate),
    bufferSize: brandSerialPortBufferSize(
      bufferSize ?? DEFAULT_SERIAL_SESSION_OPTIONS.bufferSize,
    ),
  };
}

/**
 * Merge and validate {@link SerialSessionOptions} into a fully resolved
 * options object for internal session use.
 *
 * @throws {@link SerialError} when option values are out of range:
 *         {@link SerialErrorCode.INVALID_CONNECTION_OPTIONS},
 *         {@link SerialErrorCode.INVALID_FILTER_OPTIONS},
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
    terminalBuffer: resolveTerminalBufferOptions(options?.terminalBuffer),
    lineBuffer: resolveLineBufferOptions(options?.lineBuffer),
  };
}

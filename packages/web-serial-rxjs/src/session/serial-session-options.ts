import {
  brandBaudRate,
  brandSerialPortBufferSize,
  type BaudRate,
  type SerialPortBufferSize,
} from '../internal/branded-numbers';
import type { SerialConnectionOptions } from '../types';
import {
  resolveTerminalBufferOptions,
  type ResolvedTerminalBufferOptions,
  type TerminalBufferOptions,
} from '../terminal/create-terminal-buffer';
import { SerialError } from '../errors/serial-error';
import { SerialErrorCode } from '../errors/serial-error-code';
import {
  resolveLineBufferOptions,
  type LineBufferOptions,
  type ResolvedLineBufferOptions,
} from './internal/line-buffer';
import { validateSerialPortFilters } from './internal/validate-serial-port-filters';

export type {
  ResolvedLineBufferOptions,
  ResolvedTerminalBufferOptions,
};

/**
 * Library-specific options for {@link createSerialSession} that are not passed
 * to W3C `port.open`.
 *
 * Responsibility split (Issue #488):
 *
 * - {@link SerialSessionFeatureOptions.filters} — port selection only
 *   (`navigator.serial.requestPort`)
 * - {@link SerialSessionFeatureOptions.lineBuffer} — incomplete-line tail for
 *   {@link SerialSession.lines$}
 * - {@link SerialSessionFeatureOptions.terminalBuffer} — display memory for
 *   {@link SerialSession.terminalText$}
 *
 * Connection parameters (`baudRate`, `dataBits`, …) live on
 * {@link SerialConnectionOptions} and are composed into
 * {@link SerialSessionOptions}. Minimal callers typically only set
 * `baudRate`; other fields keep safe defaults.
 *
 * @see {@link SerialConnectionOptions} for W3C connection parameters
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/441 | Issue #441}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/488 | Issue #488}
 */
export interface SerialSessionFeatureOptions {
  /**
   * Filters for port selection when requesting a port.
   *
   * When specified, the port selection dialog will only show devices
   * matching these filters. Each filter can specify `usbVendorId` and/or
   * `usbProductId`. Not passed to `port.open`.
   */
  filters?: SerialPortFilter[];

  /**
   * Limits for {@link SerialSession.terminalText$} display memory. Oldest
   * completed lines and leading characters are dropped when exceeded.
   * Character counts use UTF-16 string length (JavaScript `.length`).
   *
   * Pass `0` for `maxLines` or `maxChars` to disable that limit (unlimited).
   * Negative values, non-integers, `NaN`, and `Infinity` are rejected at
   * factory time.
   *
   * @default `{ maxLines: 10000, maxChars: 1048576, stripAnsi: true }`
   *   (see {@link DEFAULT_SERIAL_SESSION_OPTIONS})
   * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/370 | Issue #370}
   */
  terminalBuffer?: TerminalBufferOptions;

  /**
   * Limits for the incomplete line tail held by {@link SerialSession.lines$}
   * framing. When exceeded, leading characters are discarded and a non-fatal
   * {@link SerialErrorCode.LINE_BUFFER_OVERFLOW} is emitted on
   * {@link SerialSession.errors$}. Character counts use UTF-16 string length.
   *
   * Pass `0` for `maxChars` to disable the limit (unlimited). Negative values,
   * non-integers, `NaN`, and `Infinity` are rejected at factory time.
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
 * (library-specific session features). All fields are optional; omitted values
 * fall back to {@link DEFAULT_SERIAL_SESSION_OPTIONS}.
 *
 * Minimal usage typically only needs `baudRate`:
 *
 * @example
 * ```typescript
 * const session = createSerialSession({ baudRate: 115200 });
 * ```
 *
 * Full example:
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
 * Boundary semantics for numeric limits:
 *
 * - `undefined` — apply the default from {@link DEFAULT_SERIAL_SESSION_OPTIONS}
 * - `baudRate` / `bufferSize` — must be safe integers `> 0` (rejected otherwise)
 * - `terminalBuffer` / `lineBuffer` limits — safe integers `>= 0`; `0` means unlimited
 *
 * @see {@link SerialConnectionOptions}
 * @see {@link SerialSessionFeatureOptions}
 * @see {@link SerialOptions}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/199 | Issue #199}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/402 | Issue #402}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/441 | Issue #441}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/488 | Issue #488}
 */
export interface SerialSessionOptions
  extends Partial<SerialConnectionOptions>, SerialSessionFeatureOptions {}

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
 * Nested buffer defaults are owned by {@link resolveTerminalBufferOptions} and
 * {@link resolveLineBufferOptions}; this object is the single session-level
 * snapshot used by {@link resolveSerialSessionOptions}.
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
 *         when `baudRate` or `bufferSize` are out of range.
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

  if (!Number.isSafeInteger(bufferSize) || bufferSize <= 0) {
    throw new SerialError(
      SerialErrorCode.INVALID_CONNECTION_OPTIONS,
      `Invalid bufferSize: ${bufferSize}. Must be a safe integer > 0.`,
      undefined,
      {
        field: 'bufferSize',
        value: bufferSize,
        constraint: 'positive-safe-integer',
      },
    );
  }

  return {
    dataBits: merged.dataBits,
    stopBits: merged.stopBits,
    parity: merged.parity,
    flowControl: merged.flowControl,
    baudRate: brandBaudRate(baudRate),
    bufferSize: brandSerialPortBufferSize(bufferSize),
  };
}

/**
 * Merge and validate {@link SerialSessionOptions} into a fully resolved
 * options object for internal session use.
 *
 * Defaults and validation for nested buffers live next to their option types
 * ({@link resolveTerminalBufferOptions}, {@link resolveLineBufferOptions}).
 * This function is the single entry point that assembles connection + feature
 * options for a session.
 *
 * @throws {@link SerialError} when option values are out of range:
 *         {@link SerialErrorCode.INVALID_CONNECTION_OPTIONS},
 *         {@link SerialErrorCode.INVALID_FILTER_OPTIONS},
 *         {@link SerialErrorCode.INVALID_TERMINAL_BUFFER_OPTIONS}, or
 *         {@link SerialErrorCode.INVALID_LINE_BUFFER_OPTIONS}.
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/403 | Issue #403}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/488 | Issue #488}
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

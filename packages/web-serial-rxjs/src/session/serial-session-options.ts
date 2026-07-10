import type { TerminalBufferOptions } from '../terminal/create-terminal-buffer';
import { DEFAULT_TERMINAL_BUFFER_OPTIONS } from '../terminal/create-terminal-buffer';
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
}

const DEFAULT_RECEIVE_REPLAY: Required<SerialSessionReceiveReplayOptions> = {
  enabled: false,
  bufferSize: 512,
};

/**
 * Default values applied to omitted {@link SerialSessionOptions} fields.
 *
 * @internal
 */
export const DEFAULT_SERIAL_SESSION_OPTIONS: Required<
  Omit<SerialSessionOptions, 'filters' | 'receiveReplay' | 'terminalBuffer' | 'lineBuffer'>
> & {
  filters?: SerialPortFilter[];
  receiveReplay: Required<SerialSessionReceiveReplayOptions>;
  terminalBuffer: Required<TerminalBufferOptions>;
  lineBuffer: Required<LineBufferOptions>;
} = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 255,
  flowControl: 'none',
  filters: undefined,
  receiveReplay: { ...DEFAULT_RECEIVE_REPLAY },
  terminalBuffer: { ...DEFAULT_TERMINAL_BUFFER_OPTIONS },
  lineBuffer: { ...DEFAULT_LINE_BUFFER_OPTIONS },
};

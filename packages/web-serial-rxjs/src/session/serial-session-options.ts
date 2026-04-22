import type { SerialClientOptions } from '../types/options';

/**
 * Options for creating a {@link SerialSession} via {@link createSerialSession}.
 *
 * For the v2 API these options mirror the v1 {@link SerialClientOptions}
 * surface (baud rate, data bits, stop bits, parity, buffer size, flow
 * control, and filters). A dedicated interface is kept so the v2 options
 * surface can diverge in later sub-issues of #199 without touching v1.
 *
 * @see {@link SerialClientOptions}
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/200 | Issue #200}
 */
export type SerialSessionOptions = SerialClientOptions;

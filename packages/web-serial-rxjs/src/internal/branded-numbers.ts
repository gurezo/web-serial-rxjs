declare const baudRateBrand: unique symbol;
/** Validated serial port baud rate (safe integer > 0). */
export type BaudRate = number & { readonly [baudRateBrand]: true };

declare const serialPortBufferSizeBrand: unique symbol;
/** Validated W3C {@link SerialOptions} `bufferSize`. */
export type SerialPortBufferSize = number & {
  readonly [serialPortBufferSizeBrand]: true;
};

declare const receiveReplayBufferSizeBrand: unique symbol;
/** Validated receive replay chunk count limit. */
export type ReceiveReplayBufferSize = number & {
  readonly [receiveReplayBufferSizeBrand]: true;
};

declare const maxCharsBrand: unique symbol;
/** Validated character limit for buffers (`0` means unlimited). */
export type MaxChars = number & { readonly [maxCharsBrand]: true };

declare const maxLinesBrand: unique symbol;
/** Validated line count limit for terminal display (`0` means unlimited). */
export type MaxLines = number & { readonly [maxLinesBrand]: true };

/** @internal Brand a validated baud rate. */
export function brandBaudRate(value: number): BaudRate {
  return value as BaudRate;
}

/** @internal Brand a validated serial port buffer size. */
export function brandSerialPortBufferSize(value: number): SerialPortBufferSize {
  return value as SerialPortBufferSize;
}

/** @internal Brand a validated receive replay buffer size. */
export function brandReceiveReplayBufferSize(
  value: number,
): ReceiveReplayBufferSize {
  return value as ReceiveReplayBufferSize;
}

/** @internal Brand a validated max character limit. */
export function brandMaxChars(value: number): MaxChars {
  return value as MaxChars;
}

/** @internal Brand a validated max line limit. */
export function brandMaxLines(value: number): MaxLines {
  return value as MaxLines;
}

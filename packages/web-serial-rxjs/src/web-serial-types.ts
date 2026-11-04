/**
 * Web Serial dictionaries that appear on the public API.
 *
 * Module-scoped copies of the W3C dictionaries used by
 * {@link SerialConnectionOptions}, session `filters`, and connected
 * `portInfo`. They are not global augmentations, so they do not merge with
 * `@types/w3c-web-serial` or a future DOM lib.
 *
 * Shapes follow `@types/w3c-web-serial` 1.0.9 (TypeScript <= 7.0), including
 * explicit `undefined`, so the packaged types stay mutually assignable with
 * those globals under `exactOptionalPropertyTypes`.
 *
 * The `SerialPort` class is not part of this module.
 *
 * @see {@link https://github.com/gurezo/web-serial-rxjs/issues/659 | Issue #659}
 * @see {@link https://wicg.github.io/serial/}
 */

/**
 * Connection parameters for `port.open`.
 *
 * Port-selection `filters` are not part of this dictionary.
 *
 * @see {@link https://wicg.github.io/serial/#dom-serialoptions}
 */
export interface SerialOptions {
  baudRate: number;
  dataBits?: 7 | 8 | undefined;
  stopBits?: 1 | 2 | undefined;
  parity?: 'none' | 'even' | 'odd' | undefined;
  bufferSize?: number | undefined;
  flowControl?: 'none' | 'hardware' | undefined;
}

/**
 * Snapshot from `SerialPort.getInfo()`, exposed as connected `portInfo`.
 *
 * @see {@link https://wicg.github.io/serial/#serialportinfo-dictionary}
 */
export interface SerialPortInfo {
  usbVendorId?: number | undefined;
  usbProductId?: number | undefined;
  /**
   * Bluetooth service class UUID when the port is a Bluetooth service.
   * Otherwise absent or `undefined`.
   */
  bluetoothServiceClassId?: number | string | undefined;
}

/**
 * Filter forwarded to `navigator.serial.requestPort`.
 *
 * @see {@link https://wicg.github.io/serial/#dom-serialportfilter}
 */
export interface SerialPortFilter {
  usbVendorId?: number | undefined;
  usbProductId?: number | undefined;
  bluetoothServiceClassId?: number | string | undefined;
}

import { describe, expect, it } from 'vitest';
import type {
  SerialOptions as PackagedSerialOptions,
  SerialPortFilter as PackagedSerialPortFilter,
  SerialPortInfo as PackagedSerialPortInfo,
} from '../../src/web-serial-types';

/**
 * Packaged Web Serial dictionaries must stay mutually assignable with the
 * globals from `@types/w3c-web-serial` (Issue #659).
 *
 * Module-scoped copies do not merge with those globals. Structural
 * compatibility is what keeps `port.open` / `requestPort` / `getInfo()`
 * working without a cast.
 */
type MutuallyAssignable<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false;

type OptionsAssignable = MutuallyAssignable<
  PackagedSerialOptions,
  SerialOptions
>;
type PortInfoAssignable = MutuallyAssignable<
  PackagedSerialPortInfo,
  SerialPortInfo
>;
type PortFilterAssignable = MutuallyAssignable<
  PackagedSerialPortFilter,
  SerialPortFilter
>;

describe('packaged Web Serial dictionary assignability (#659)', () => {
  it('keeps SerialOptions mutually assignable with the global dictionary', () => {
    const assignable: OptionsAssignable = true;
    expect(assignable).toBe(true);
  });

  it('keeps SerialPortInfo mutually assignable with the global dictionary', () => {
    const assignable: PortInfoAssignable = true;
    expect(assignable).toBe(true);
  });

  it('keeps SerialPortFilter mutually assignable with the global dictionary', () => {
    const assignable: PortFilterAssignable = true;
    expect(assignable).toBe(true);
  });
});

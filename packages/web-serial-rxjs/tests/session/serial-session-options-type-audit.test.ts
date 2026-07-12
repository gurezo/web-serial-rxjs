import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createSerialSession,
  resolveSerialSessionOptions,
  type SerialConnectionOptions,
  type SerialSessionFeatureOptions,
  type SerialSessionOptions,
} from '../../src/index';

/**
 * Regression guard for the session options type responsibility audit (Issue #441).
 * Keep in sync with MIGRATION_V3 §10 and API_REFERENCE.
 */
const CANONICAL_OPTIONS_TYPE_EXPORTS = [
  'SerialConnectionOptions',
  'SerialSessionFeatureOptions',
  'SerialSessionOptions',
] as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicIndexSource = readFileSync(
  join(__dirname, '../../src/index.ts'),
  'utf8',
);

describe('session options type audit (#441)', () => {
  it('exports connection and feature option types from the public barrel', () => {
    for (const name of CANONICAL_OPTIONS_TYPE_EXPORTS) {
      expect(publicIndexSource).toContain(name);
    }
  });

  it('accepts connection-only options at runtime', () => {
    const options: Partial<SerialConnectionOptions> = { baudRate: 115200 };
    expect(() => createSerialSession(options)).not.toThrow();
    expect(resolveSerialSessionOptions(options).baudRate).toBe(115200);
  });

  it('accepts feature-only options at runtime', () => {
    const options: SerialSessionFeatureOptions = {
      receiveReplay: { enabled: true, bufferSize: 64 },
    };
    expect(() => createSerialSession(options)).not.toThrow();
    expect(resolveSerialSessionOptions(options).receiveReplay.enabled).toBe(true);
  });

  it('accepts combined connection and feature options at runtime', () => {
    const options: SerialSessionOptions = {
      baudRate: 9600,
      filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
      lineBuffer: { maxChars: 4096 },
    };
    expect(() => createSerialSession(options)).not.toThrow();
    expect(resolveSerialSessionOptions(options).lineBuffer.maxChars).toBe(4096);
  });

  it('accepts readonly input objects for createSerialSession', () => {
    const options = {
      baudRate: 115200,
      filters: [{ usbVendorId: 0x1234, usbProductId: 0x5678 }],
    } as const satisfies Partial<SerialSessionOptions>;

    expect(() => createSerialSession(options)).not.toThrow();
  });
});

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
 * Regression guard for the session options type responsibility audit
 * (Issues #441 / #488). Keep in sync with concepts.md and migration guides.
 */
const CANONICAL_OPTIONS_TYPE_EXPORTS = [
  'SerialConnectionOptions',
  'SerialSessionFeatureOptions',
  'SerialSessionOptions',
] as const;

const CANONICAL_FEATURE_OPTION_KEYS = [
  'filters',
  'terminalBuffer',
  'lineBuffer',
] as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicIndexSource = readFileSync(
  join(__dirname, '../../src/index.ts'),
  'utf8',
);
const featureOptionsSource = readFileSync(
  join(__dirname, '../../src/session/serial-session-options.ts'),
  'utf8',
);
const packageSrcRoot = join(__dirname, '../../src');

describe('session options type audit (#441 / #488)', () => {
  it('exports connection and feature option types from the public barrel', () => {
    for (const name of CANONICAL_OPTIONS_TYPE_EXPORTS) {
      expect(publicIndexSource).toContain(name);
    }
  });

  it('keeps SerialSessionFeatureOptions keys aligned with session responsibilities', () => {
    for (const key of CANONICAL_FEATURE_OPTION_KEYS) {
      expect(featureOptionsSource).toContain(`${key}?:`);
    }
    expect(featureOptionsSource).not.toContain('receiveReplay');
  });

  it('does not leave receiveReplay in package source', () => {
    const sources = [
      'index.ts',
      'session/serial-session-options.ts',
      'session/serial-session.ts',
      'session/create-serial-session.ts',
    ].map((relativePath) =>
      readFileSync(join(packageSrcRoot, relativePath), 'utf8'),
    );

    for (const source of sources) {
      expect(source).not.toMatch(/receiveReplay/);
    }
  });

  it('accepts connection-only options at runtime', () => {
    const options: Partial<SerialConnectionOptions> = { baudRate: 115200 };
    expect(() => createSerialSession(options)).not.toThrow();
    expect(resolveSerialSessionOptions(options).baudRate).toBe(115200);
  });

  it('accepts feature-only options at runtime', () => {
    const options: SerialSessionFeatureOptions = {
      lineBuffer: { maxChars: 2048 },
    };
    expect(() => createSerialSession(options)).not.toThrow();
    expect(resolveSerialSessionOptions(options).lineBuffer.maxChars).toBe(2048);
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

  it('accepts baudRate-only minimal session creation', () => {
    expect(() => createSerialSession({ baudRate: 115200 })).not.toThrow();
  });
});

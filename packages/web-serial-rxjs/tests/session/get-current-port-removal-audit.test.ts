import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  createSerialSession,
  type SerialSession,
} from '../../src/index';

/**
 * Regression guard for raw SerialPort escape-hatch removal
 * (Issues #437 / #474, PR #448).
 * Keep in sync with MIGRATION_V3 §7.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageSrcRoot = join(__dirname, '../../src');

const PUBLIC_SURFACE_SOURCES = [
  'index.ts',
  'session/serial-session.ts',
  'session/create-serial-session.ts',
  'session/index.ts',
] as const;

describe('getCurrentPort removal audit (#474)', () => {
  it('keeps getCurrentPort out of the public session surface sources', () => {
    for (const relativePath of PUBLIC_SURFACE_SOURCES) {
      const source = readFileSync(join(packageSrcRoot, relativePath), 'utf8');
      expect(source, relativePath).not.toContain('getCurrentPort');
    }
  });

  it('does not export getRuntimePort from the public barrel', () => {
    const publicIndexSource = readFileSync(
      join(packageSrcRoot, 'index.ts'),
      'utf8',
    );
    const sessionIndexSource = readFileSync(
      join(packageSrcRoot, 'session/index.ts'),
      'utf8',
    );
    expect(publicIndexSource).not.toContain('getRuntimePort');
    expect(sessionIndexSource).not.toContain('getRuntimePort');
  });

  it('excludes getCurrentPort from keyof SerialSession at the type level', () => {
    type HasGetCurrentPort = 'getCurrentPort' extends keyof SerialSession
      ? true
      : false;
    const removed: HasGetCurrentPort = false;
    expect(removed).toBe(false);
  });

  it('does not expose getCurrentPort on createSerialSession() return value', () => {
    const session = createSerialSession({ baudRate: 115200 });
    expect(
      Object.prototype.hasOwnProperty.call(session, 'getCurrentPort'),
    ).toBe(false);
    expect(
      Object.getOwnPropertyNames(session).includes('getCurrentPort'),
    ).toBe(false);
  });
});

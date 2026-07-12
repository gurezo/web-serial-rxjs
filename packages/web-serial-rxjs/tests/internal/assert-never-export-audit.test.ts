import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index';

/**
 * Regression guard for the assertNever public export audit (Issue #440).
 * Keep in sync with MIGRATION_V3 §9 and API_REFERENCE.
 */
const CANONICAL_PUBLIC_EXPORTS = [
  'createSerialSession',
  'createTerminalBuffer',
  'DEFAULT_TERMINAL_BUFFER_OPTIONS',
  'SerialError',
  'SerialErrorCode',
  'SerialSessionStatus',
] as const;

const DEPRECATED_PUBLIC_EXPORTS = ['assertNever'] as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const assertNeverSource = readFileSync(
  join(__dirname, '../../src/internal/assert-never.ts'),
  'utf8',
);

describe('assertNever public export audit (#440)', () => {
  it('retains assertNever on the public barrel for v3.x backward compatibility', () => {
    expect(publicApi.assertNever).toBeTypeOf('function');
  });

  it('marks assertNever as deprecated in source JSDoc', () => {
    expect(assertNeverSource).toContain('@deprecated');
    expect(assertNeverSource).toContain('@internal');
  });

  it('excludes assertNever from the canonical public API list', () => {
    for (const name of CANONICAL_PUBLIC_EXPORTS) {
      expect(name in publicApi).toBe(true);
      expect(DEPRECATED_PUBLIC_EXPORTS).not.toContain(name);
    }
    expect(DEPRECATED_PUBLIC_EXPORTS).toContain('assertNever');
    expect(CANONICAL_PUBLIC_EXPORTS).not.toContain('assertNever');
  });
});

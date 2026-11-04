import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index';

/**
 * Regression guard for the assertNever public export audit (Issue #440).
 * The public re-export was removed in v5 (Issue #658). The helper stays internal.
 */
const CANONICAL_PUBLIC_EXPORTS = [
  'createSerialSession',
  'createTerminalBuffer',
  'DEFAULT_TERMINAL_BUFFER_OPTIONS',
  'SerialError',
  'SerialErrorCode',
  'SerialSessionStatus',
] as const;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageSrcRoot = join(__dirname, '../../src');
const publicIndexSource = readFileSync(join(packageSrcRoot, 'index.ts'), 'utf8');
const assertNeverSource = readFileSync(
  join(packageSrcRoot, 'internal/assert-never.ts'),
  'utf8',
);

describe('assertNever public export audit (#440)', () => {
  it('does not export assertNever from the public barrel', () => {
    expect('assertNever' in publicApi).toBe(false);
    expect(publicIndexSource).not.toMatch(/\bassertNever\b/);
  });

  it('keeps the internal helper without a public deprecation note', () => {
    expect(assertNeverSource).toContain('@internal');
    expect(assertNeverSource).not.toContain('@deprecated');
    expect(assertNeverSource).toContain('export function assertNever');
  });

  it('keeps assertNever off the canonical public API list', () => {
    for (const name of CANONICAL_PUBLIC_EXPORTS) {
      expect(name in publicApi).toBe(true);
    }
    expect(CANONICAL_PUBLIC_EXPORTS).not.toContain('assertNever');
  });
});

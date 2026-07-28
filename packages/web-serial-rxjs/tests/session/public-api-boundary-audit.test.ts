import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index';

/**
 * Regression guard for the v4 public API boundary (Issue #489 / Parent #485).
 *
 * Keep the allowlists in sync with:
 * - `src/index.ts` (public barrel / TypeDoc entry)
 * - package README / concepts docs when the surface changes intentionally
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '../..');
const publicIndexSource = readFileSync(
  join(packageRoot, 'src/index.ts'),
  'utf8',
);

/**
 * Runtime values exported from the package root barrel.
 * Intentional API additions must update this list explicitly.
 */
const CANONICAL_RUNTIME_EXPORTS = [
  'assertNever',
  'createSerialSession',
  'createTerminalBuffer',
  'DEFAULT_LINE_BUFFER_OPTIONS',
  'DEFAULT_TERMINAL_BUFFER_OPTIONS',
  'isConnectedSessionState',
  'isWebSerialSupported',
  'resolveSerialSessionOptions',
  'SerialError',
  'SerialErrorCode',
  'SerialSessionStatus',
] as const;

/**
 * Type-only exports from `src/index.ts` (`export type { ... }`).
 * Parsed from source because they do not appear on `import * as publicApi`.
 */
const CANONICAL_TYPE_EXPORTS = [
  'ConnectedSessionState',
  'ConnectingSessionState',
  'DisconnectingSessionState',
  'DisposedSessionState',
  'ErrorSessionState',
  'IdleSessionState',
  'LineBufferOptions',
  'ResolvedSerialSessionOptions',
  'SerialConnectionOptions',
  'SerialErrorCauseContext',
  'SerialErrorContextMap',
  'SerialPayload',
  'SerialSession',
  'SerialSessionFeatureOptions',
  'SerialSessionOptions',
  'SerialSessionState',
  'TerminalBuffer',
  'TerminalBufferOptions',
  'UnsupportedSessionState',
  'ValidationErrorConstraint',
  'ValidationErrorContext',
] as const;

function parseExportedTypeNames(source: string): string[] {
  const names: string[] = [];
  const typeExportBlocks =
    source.matchAll(/export\s+type\s*\{([^}]+)\}/gs);
  for (const match of typeExportBlocks) {
    const block = match[1] ?? '';
    for (const part of block.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      // Support `Foo as Bar` / trailing comments are unlikely; take the local name.
      const localName = trimmed.split(/\s+as\s+/)[0]?.trim();
      if (localName && /^[A-Za-z_][A-Za-z0-9_]*$/.test(localName)) {
        names.push(localName);
      }
    }
  }
  return names.sort();
}

describe('v4 public API boundary audit (#489) — export allowlist', () => {
  it('keeps package-root runtime exports aligned with the allowlist', () => {
    const actual = Object.keys(publicApi).sort();
    const expected = [...CANONICAL_RUNTIME_EXPORTS].sort();
    expect(actual).toEqual(expected);
  });

  it('exposes every allowlisted runtime export', () => {
    for (const name of CANONICAL_RUNTIME_EXPORTS) {
      expect(name in publicApi, name).toBe(true);
    }
  });

  it('keeps package-root type exports aligned with the allowlist', () => {
    const actual = parseExportedTypeNames(publicIndexSource);
    const expected = [...CANONICAL_TYPE_EXPORTS].sort();
    expect(actual).toEqual(expected);
  });
});

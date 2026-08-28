import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for unused / test-only internal exports (Issue #591 / Parent #585).
 *
 * Complements `public-api-boundary-audit.test.ts`, which locks the public barrel.
 * This audit keeps internal modules from reintroducing exports removed during
 * the unused-code inventory.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '../..');
const packageSrcRoot = join(packageRoot, 'src');

const publicIndexSource = readFileSync(
  join(packageSrcRoot, 'index.ts'),
  'utf8',
);

/** Internal-only exports that must not return on the package root barrel. */
const REMOVED_PUBLIC_BARREL_SYMBOLS = [
  'resolveConnectionOptions',
  'DEFAULT_SERIAL_SESSION_OPTIONS',
  'applyTerminalChunk',
  'terminalDisplayText',
  'trimCompletedByMaxLines',
  'trimTerminalState',
  'countCompletedLines',
  'createTerminalParser',
  'assertNeverRuntime',
] as const;

/** Source files deleted during the #591 terminal/parser consolidation. */
const REMOVED_SOURCE_FILES = [
  'terminal/create-terminal-parser.ts',
] as const;

function readSrc(relativePath: string): string {
  return readFileSync(join(packageSrcRoot, relativePath), 'utf8');
}

function parseExportedValueNames(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/export\s*\{([^}]+)\}/gs)) {
    const block = match[1] ?? '';
    for (const part of block.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      const exported = trimmed.split(/\s+as\s+/).pop()?.trim();
      if (exported && /^[A-Za-z_][A-Za-z0-9_]*$/.test(exported)) {
        names.push(exported);
      }
    }
  }
  for (const match of source.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class)\s+([A-Za-z_][A-Za-z0-9_]*)/g,
  )) {
    const name = match[1];
    if (name) {
      names.push(name);
    }
  }
  return [...new Set(names)];
}

describe('unused export audit (#591) — removed public barrel symbols', () => {
  it('keeps removed internal symbols off src/index.ts', () => {
    for (const name of REMOVED_PUBLIC_BARREL_SYMBOLS) {
      expect(publicIndexSource, name).not.toMatch(
        new RegExp(`\\b${name}\\b`),
      );
    }
  });
});

describe('unused export audit (#591) — session options internals', () => {
  const serialSessionOptionsSource = readSrc('session/serial-session-options.ts');

  it('does not export resolveConnectionOptions', () => {
    expect(parseExportedValueNames(serialSessionOptionsSource)).not.toContain(
      'resolveConnectionOptions',
    );
    expect(serialSessionOptionsSource).toMatch(
      /^function resolveConnectionOptions/m,
    );
  });

  it('does not export DEFAULT_SERIAL_SESSION_OPTIONS', () => {
    expect(parseExportedValueNames(serialSessionOptionsSource)).not.toContain(
      'DEFAULT_SERIAL_SESSION_OPTIONS',
    );
    expect(serialSessionOptionsSource).toMatch(
      /^const DEFAULT_SERIAL_SESSION_OPTIONS/m,
    );
  });
});

describe('unused export audit (#591) — session runtime internals', () => {
  it('does not export assertNeverRuntime', () => {
    const source = readSrc('session/session-runtime.ts');
    expect(source).not.toMatch(/\bassertNeverRuntime\b/);
    expect(source).toContain('assertNever(runtime)');
  });
});

describe('unused export audit (#591) — terminal buffer internals', () => {
  const terminalBufferSource = readSrc('terminal/create-terminal-buffer.ts');

  it('does not export test-only terminal helper functions', () => {
    const exported = parseExportedValueNames(terminalBufferSource);
    expect(exported).not.toContain('applyTerminalChunk');
    expect(exported).not.toContain('terminalDisplayText');
    expect(exported).not.toContain('trimCompletedByMaxLines');
    expect(exported).not.toContain('trimTerminalState');
    expect(exported).not.toContain('countCompletedLines');
    expect(exported).not.toContain('createTerminalParser');
  });

  it('keeps create-terminal-parser.ts removed', () => {
    for (const relativePath of REMOVED_SOURCE_FILES) {
      expect(
        existsSync(join(packageSrcRoot, relativePath)),
        relativePath,
      ).toBe(false);
    }
  });
});

describe('unused export audit (#591) — queue and read pump handler types', () => {
  it('keeps SendQueueOperation module-private', () => {
    const source = readSrc('session/send-queue.ts');
    expect(source).toMatch(/^type SendQueueOperation/m);
    expect(source).not.toMatch(/^export type SendQueueOperation/m);
  });

  it('keeps read pump handler aliases module-private', () => {
    const source = readSrc('session/read-pump.ts');
    expect(source).toMatch(/^type ReadPumpChunkHandler/m);
    expect(source).toMatch(/^type ReadPumpErrorHandler/m);
    expect(source).toMatch(/^type ReadPumpDoneHandler/m);
    expect(source).not.toMatch(/^export type ReadPumpChunkHandler/m);
    expect(source).not.toMatch(/^export type ReadPumpErrorHandler/m);
    expect(source).not.toMatch(/^export type ReadPumpDoneHandler/m);
  });
});

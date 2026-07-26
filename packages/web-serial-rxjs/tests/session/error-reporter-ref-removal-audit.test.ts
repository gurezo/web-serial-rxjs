import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard for removing the late-assigned error reporter reference
 * (Issues #472 / #476).
 *
 * The factory must wire every dependency in a single forward direction, so
 * there is no mutable `errorReporterRef` placeholder and no non-null
 * assertions that assume initialization order. Keep in sync with the receive
 * pipeline decoupling (`bufferErrors$`) and `port-teardown.ts`.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sessionSrcRoot = join(__dirname, '../../src/session');

function readSessionSource(relativePath: string): string {
  return readFileSync(join(sessionSrcRoot, relativePath), 'utf8');
}

describe('errorReporterRef removal audit (#476)', () => {
  it('does not reintroduce the late-assigned error reporter reference', () => {
    const source = readSessionSource('create-serial-session.ts');

    expect(source).not.toContain('errorReporterRef');
  });

  it('does not assume initialization order via non-null assertions', () => {
    const source = readSessionSource('create-serial-session.ts');

    expect(source).not.toContain('reportError!');
    expect(source).not.toContain('createDisposedError!');
  });

  it('keeps the receive pipeline decoupled from reportError', () => {
    const source = readSessionSource('internal/receive-pipeline.ts');

    expect(source).not.toContain('reportError');
    expect(source).toContain('bufferErrors$');
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createSerialSession, type SerialSession } from '../../src/index';

/**
 * Regression guard for the single session state write source
 * (Issues #472 / #475, PR #479).
 *
 * `state$` is the canonical lifecycle source: it is written only by
 * `SessionRuntimeController.transition` through one `BehaviorSubject`.
 * Keep in sync with MIGRATION_V3 §5 and §6.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageSrcRoot = join(__dirname, '../../src');
const sessionSrcRoot = join(packageSrcRoot, 'session');

/** Duplicate lifecycle state APIs and their backing subjects, removed in #479. */
const REMOVED_STATE_MIRRORS = [
  'isConnected$',
  'portInfo$',
  'getPortInfo',
  'isConnectedSubject',
  'portInfoSubject',
] as const;

const PUBLIC_SURFACE_SOURCES = [
  'index.ts',
  'session/serial-session.ts',
  'session/create-serial-session.ts',
  'session/index.ts',
] as const;

/** The only module allowed to own the writable lifecycle subject. */
const LIFECYCLE_SUBJECT_OWNER = 'session-runtime.ts';

function listSessionSources(): readonly string[] {
  return readdirSync(sessionSrcRoot, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts'))
    .sort();
}

function readSessionSource(relativePath: string): string {
  return readFileSync(join(sessionSrcRoot, relativePath), 'utf8');
}

describe('session state write source audit (#475)', () => {
  it('keeps removed state mirrors out of the public session surface sources', () => {
    for (const relativePath of PUBLIC_SURFACE_SOURCES) {
      const source = readFileSync(join(packageSrcRoot, relativePath), 'utf8');
      for (const name of REMOVED_STATE_MIRRORS) {
        expect(source, `${relativePath} / ${name}`).not.toContain(name);
      }
    }
  });

  it('excludes removed state mirrors from keyof SerialSession', () => {
    type HasIsConnected = 'isConnected$' extends keyof SerialSession
      ? true
      : false;
    type HasPortInfo = 'portInfo$' extends keyof SerialSession ? true : false;
    type HasGetPortInfo = 'getPortInfo' extends keyof SerialSession
      ? true
      : false;

    const isConnectedRemoved: HasIsConnected = false;
    const portInfoRemoved: HasPortInfo = false;
    const getPortInfoRemoved: HasGetPortInfo = false;

    expect([
      isConnectedRemoved,
      portInfoRemoved,
      getPortInfoRemoved,
    ]).toEqual([false, false, false]);
  });

  it('does not expose removed state mirrors on createSerialSession() return value', () => {
    const session = createSerialSession({ baudRate: 115200 });
    const ownProperties = Object.getOwnPropertyNames(session);

    for (const name of REMOVED_STATE_MIRRORS) {
      expect(ownProperties, name).not.toContain(name);
    }
  });

  it('declares the writable lifecycle subject in exactly one module', () => {
    const owners = listSessionSources().filter((relativePath) =>
      readSessionSource(relativePath).includes(
        'BehaviorSubject<SerialSessionState>',
      ),
    );

    expect(owners).toEqual([LIFECYCLE_SUBJECT_OWNER]);
  });

  it('routes every lifecycle write outside the runtime module through transition()', () => {
    for (const relativePath of listSessionSources()) {
      if (relativePath === LIFECYCLE_SUBJECT_OWNER) {
        continue;
      }
      const source = readSessionSource(relativePath);

      expect(source, relativePath).not.toContain('runtimeToPublicState');
      expect(source, relativePath).not.toContain('stateSubject');
    }
  });
});

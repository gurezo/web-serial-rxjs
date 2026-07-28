import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as publicApi from '../../src/index';
import {
  createSerialSession,
  type SerialSession,
} from '../../src/index';

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
const packageSrcRoot = join(packageRoot, 'src');
const publicIndexSource = readFileSync(
  join(packageSrcRoot, 'index.ts'),
  'utf8',
);

const PUBLIC_SURFACE_SOURCES = [
  'index.ts',
  'session/serial-session.ts',
  'session/create-serial-session.ts',
  'session/index.ts',
  'session/serial-session-options.ts',
] as const;

/** Exact `SerialSession` public members for v4 (Issue #485 target shape). */
const CANONICAL_SESSION_KEYS = [
  'connect$',
  'disconnect$',
  'dispose$',
  'errors$',
  'lines$',
  'receive$',
  'send$',
  'state$',
  'terminalText$',
] as const;

/** APIs removed in Phase 1 / Phase 2 that must not return on `SerialSession`. */
const REMOVED_SESSION_APIS = [
  'destroy$',
  'getCurrentPort',
  'getPortInfo',
  'isBrowserSupported',
  'isConnected$',
  'portInfo$',
  'receiveReplay$',
] as const;

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

describe('v4 public API boundary audit (#489) — SerialSession shape', () => {
  it('keeps keyof SerialSession aligned with the canonical member set', () => {
    type ExpectedKeys = (typeof CANONICAL_SESSION_KEYS)[number];
    type ActualKeys = keyof SerialSession;
    type ExtraKeys = Exclude<ActualKeys, ExpectedKeys>;
    type MissingKeys = Exclude<ExpectedKeys, ActualKeys>;
    type ExactShape = [ExtraKeys] extends [never]
      ? [MissingKeys] extends [never]
        ? true
        : false
      : false;

    const exact: ExactShape = true;
    expect(exact).toBe(true);
  });

  it('exposes only canonical members on createSerialSession() at runtime', () => {
    const session = createSerialSession({ baudRate: 115200 });
    const actual = Object.getOwnPropertyNames(session).sort();
    const expected = [...CANONICAL_SESSION_KEYS].sort();
    expect(actual).toEqual(expected);
  });
});

describe('v4 public API boundary audit (#489) — removed APIs', () => {
  it('excludes removed APIs from keyof SerialSession', () => {
    type HasDestroy = 'destroy$' extends keyof SerialSession ? true : false;
    type HasGetCurrentPort = 'getCurrentPort' extends keyof SerialSession
      ? true
      : false;
    type HasGetPortInfo = 'getPortInfo' extends keyof SerialSession
      ? true
      : false;
    type HasIsBrowserSupported =
      'isBrowserSupported' extends keyof SerialSession ? true : false;
    type HasIsConnected = 'isConnected$' extends keyof SerialSession
      ? true
      : false;
    type HasPortInfo = 'portInfo$' extends keyof SerialSession ? true : false;
    type HasReceiveReplay = 'receiveReplay$' extends keyof SerialSession
      ? true
      : false;

    const removed: [
      HasDestroy,
      HasGetCurrentPort,
      HasGetPortInfo,
      HasIsBrowserSupported,
      HasIsConnected,
      HasPortInfo,
      HasReceiveReplay,
    ] = [false, false, false, false, false, false, false];

    expect(removed).toEqual([
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it('keeps removed APIs out of public session surface sources', () => {
    for (const relativePath of PUBLIC_SURFACE_SOURCES) {
      const source = readFileSync(join(packageSrcRoot, relativePath), 'utf8');
      for (const name of REMOVED_SESSION_APIS) {
        expect(source, `${relativePath} / ${name}`).not.toContain(name);
      }
      expect(source, `${relativePath} / receiveReplay`).not.toMatch(
        /receiveReplay/,
      );
    }
  });

  it('does not expose removed APIs on createSerialSession() return value', () => {
    const session = createSerialSession({ baudRate: 115200 });
    const ownProperties = Object.getOwnPropertyNames(session);

    for (const name of REMOVED_SESSION_APIS) {
      expect(ownProperties, name).not.toContain(name);
      expect(Object.prototype.hasOwnProperty.call(session, name), name).toBe(
        false,
      );
    }
  });

  it('does not re-export isBrowserSupported from the package root barrel', () => {
    expect('isBrowserSupported' in publicApi).toBe(false);
    expect(publicIndexSource).not.toMatch(/\bisBrowserSupported\b/);
    expect('isWebSerialSupported' in publicApi).toBe(true);
  });
});

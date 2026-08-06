import { EMPTY, of, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';
import {
  createSerialSession,
  SerialSessionStatus,
  type SerialError,
  type SerialPayload,
  type SerialSession,
  type SerialSessionState,
} from '../../src/index';

/**
 * Compile-time assignability guards for the swappable `SerialSession` contract
 * (Issue #536).
 *
 * Runtime member presence for `createSerialSession()` is covered by
 * `create-serial-session.test.ts` ("contract") and
 * `public-api-boundary-audit.test.ts`. This file focuses on structural typing:
 * a hand-written fake must be assignable to `SerialSession` without a separate
 * `SerialSessionLike` alias.
 */

/** Forces TypeScript to treat `session` as a `SerialSession` (compile-time only). */
function assertSerialSession(session: SerialSession): SerialSession {
  return session;
}

function createMinimalFakeSerialSession(
  overrides: Partial<SerialSession> = {},
): SerialSession {
  const idle: SerialSessionState = { status: SerialSessionStatus.Idle };
  return {
    state$: of(idle),
    errors$: EMPTY as Observable<SerialError>,
    receive$: EMPTY,
    terminalText$: of(''),
    lines$: EMPTY,
    connect$: () => EMPTY,
    disconnect$: () => EMPTY,
    dispose$: () => EMPTY,
    send$: (_data: SerialPayload) => EMPTY,
    ...overrides,
  };
}

describe('SerialSession contract assignability (Issue #536)', () => {
  it('accepts createSerialSession() return value as SerialSession', () => {
    const session = assertSerialSession(createSerialSession({ baudRate: 115200 }));
    expect(session.state$).toBeDefined();
    expect(typeof session.connect$).toBe('function');
    expect(typeof session.send$).toBe('function');
  });

  it('accepts a hand-written fake that structurally matches SerialSession', () => {
    const fake = createMinimalFakeSerialSession();
    const session = assertSerialSession(fake);

    expect(session).toBe(fake);
    expect(typeof session.connect$).toBe('function');
    expect(typeof session.disconnect$).toBe('function');
    expect(typeof session.dispose$).toBe('function');
    expect(typeof session.send$).toBe('function');
    expect(session.state$).toBeDefined();
    expect(session.errors$).toBeDefined();
    expect(session.receive$).toBeDefined();
    expect(session.terminalText$).toBeDefined();
    expect(session.lines$).toBeDefined();
  });

  it('keeps fake assignable when Partial overrides are applied via satisfies', () => {
    const connected: SerialSessionState = {
      status: SerialSessionStatus.Connected,
      portInfo: { usbVendorId: 0x1234, usbProductId: 0x5678 },
    };

    const fake = {
      ...createMinimalFakeSerialSession(),
      state$: of(connected),
    } satisfies SerialSession;

    const session = assertSerialSession(fake);
    expect(session.state$).toBe(fake.state$);
  });
});

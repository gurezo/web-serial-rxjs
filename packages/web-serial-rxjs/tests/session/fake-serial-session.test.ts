import { firstValueFrom, take, toArray } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import type { SerialSession } from '../../src/session/serial-session';
import { SerialSessionStatus } from '../../src/session/serial-session-state';
import { createFakeSerialSession } from '../helpers/fake-serial-session';

/**
 * Hardware-free Fake SerialSession scenarios (Issue #537).
 *
 * These tests document and guard the controllable Fake used by the Guide
 * testing recipe. They do not require a USB serial device.
 */

function assertSerialSession(session: SerialSession): SerialSession {
  return session;
}

describe('createFakeSerialSession (Issue #537)', () => {
  it('starts in idle and is assignable to SerialSession', async () => {
    const fake = createFakeSerialSession();
    const session = assertSerialSession(fake.session);

    await expect(firstValueFrom(session.state$)).resolves.toEqual({
      status: SerialSessionStatus.Idle,
    });
    expect(typeof session.connect$).toBe('function');
    expect(typeof session.send$).toBe('function');
  });

  it('transitions connecting → connected on connect$()', async () => {
    const { session } = createFakeSerialSession();
    const statesPromise = firstValueFrom(session.state$.pipe(take(3), toArray()));

    await firstValueFrom(session.connect$());

    await expect(statesPromise).resolves.toEqual([
      { status: SerialSessionStatus.Idle },
      { status: SerialSessionStatus.Connecting },
      {
        status: SerialSessionStatus.Connected,
        portInfo: { usbVendorId: 0x1234, usbProductId: 0x5678 },
      },
    ]);
  });

  it('reproduces connect failure via failNextConnect', async () => {
    const fake = createFakeSerialSession();
    const { session } = fake;
    const custom = new SerialError(
      SerialErrorCode.PORT_OPEN_FAILED,
      'permission denied',
    );
    fake.failNextConnect(custom);

    const errorPromise = firstValueFrom(session.errors$);
    await expect(firstValueFrom(session.connect$())).rejects.toBe(custom);
    await expect(errorPromise).resolves.toBe(custom);
    await expect(firstValueFrom(session.state$)).resolves.toEqual({
      status: SerialSessionStatus.Idle,
    });
  });

  it('emits string chunks on receive$', async () => {
    const fake = createFakeSerialSession();
    const chunkPromise = firstValueFrom(fake.session.receive$);

    fake.emitReceive('hello');

    await expect(chunkPromise).resolves.toBe('hello');
    await expect(firstValueFrom(fake.session.terminalText$)).resolves.toBe(
      'hello',
    );
  });

  it('emits line data on lines$', async () => {
    const fake = createFakeSerialSession();
    const linePromise = firstValueFrom(fake.session.lines$);

    fake.emitLine('OK');

    await expect(linePromise).resolves.toBe('OK');
  });

  it('records successful send$ payloads', async () => {
    const fake = createFakeSerialSession();

    await firstValueFrom(fake.session.send$('AT\r\n'));

    expect(fake.sent).toEqual(['AT\r\n']);
  });

  it('reproduces send failure via failNextSend', async () => {
    const fake = createFakeSerialSession();
    const custom = new SerialError(
      SerialErrorCode.WRITE_FAILED,
      'port closed',
    );
    fake.failNextSend(custom);

    const errorPromise = firstValueFrom(fake.session.errors$);
    await expect(firstValueFrom(fake.session.send$('x'))).rejects.toBe(custom);
    await expect(errorPromise).resolves.toBe(custom);
    expect(fake.sent).toEqual(['x']);
  });

  it('simulates device disconnect', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());

    const errorPromise = firstValueFrom(fake.session.errors$);
    fake.simulateDeviceDisconnect();

    await expect(firstValueFrom(fake.session.state$)).resolves.toEqual({
      status: SerialSessionStatus.Idle,
    });
    const error = await errorPromise;
    expect(error.is(SerialErrorCode.CONNECTION_LOST)).toBe(true);
  });

  it('transitions disconnecting → idle on disconnect$()', async () => {
    const { session } = createFakeSerialSession();
    await firstValueFrom(session.connect$());

    const statesPromise = firstValueFrom(
      session.state$.pipe(take(3), toArray()),
    );

    await firstValueFrom(session.disconnect$());

    await expect(statesPromise).resolves.toEqual([
      {
        status: SerialSessionStatus.Connected,
        portInfo: { usbVendorId: 0x1234, usbProductId: 0x5678 },
      },
      { status: SerialSessionStatus.Disconnecting },
      { status: SerialSessionStatus.Idle },
    ]);
  });

  it('reaches disposed on dispose$()', async () => {
    const { session } = createFakeSerialSession();

    await firstValueFrom(session.dispose$());

    await expect(firstValueFrom(session.state$)).resolves.toEqual({
      status: SerialSessionStatus.Disposed,
    });
  });

  it('notifies errors$ via emitError', async () => {
    const fake = createFakeSerialSession();
    const custom = new SerialError(
      SerialErrorCode.READ_FAILED,
      'read failed',
    );
    const errorPromise = firstValueFrom(fake.session.errors$);

    fake.emitError(custom);

    await expect(errorPromise).resolves.toBe(custom);
  });

  it('allows setState for arbitrary lifecycle values', async () => {
    const fake = createFakeSerialSession();
    fake.setState({
      status: SerialSessionStatus.Error,
      error: new SerialError(SerialErrorCode.UNKNOWN, 'boom'),
    });

    const state = await firstValueFrom(fake.session.state$);
    expect(state.status).toBe(SerialSessionStatus.Error);
    if (state.status === SerialSessionStatus.Error) {
      expect(state.error.message).toBe('boom');
    }
  });
});

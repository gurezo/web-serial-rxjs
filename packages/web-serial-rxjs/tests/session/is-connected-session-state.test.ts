import { filter, firstValueFrom, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { isConnectedSessionState } from '../../src/session/is-connected-session-state';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '../../src/session/serial-session-state';

const S = SerialSessionStatus;

const stubPortInfo: SerialPortInfo = {
  usbVendorId: 0x1a86,
  usbProductId: 0x7523,
};

describe('isConnectedSessionState', () => {
  const connected: SerialSessionState = {
    status: S.Connected,
    portInfo: stubPortInfo,
  };

  const nonConnectedStates: SerialSessionState[] = [
    { status: S.Idle },
    { status: S.Connecting },
    { status: S.Disconnecting },
    { status: S.Unsupported },
    {
      status: S.Error,
      error: new SerialError(SerialErrorCode.UNKNOWN, 'test'),
    },
    { status: S.Disposed },
  ];

  it('returns true for connected state', () => {
    expect(isConnectedSessionState(connected)).toBe(true);
  });

  it.each(nonConnectedStates.map((state) => [state.status, state] as const))(
    'returns false for %s state',
    (_status, state) => {
      expect(isConnectedSessionState(state)).toBe(false);
    },
  );

  it('narrows state in RxJS filter pipelines', async () => {
    const state = await firstValueFrom(
      of<SerialSessionState>(connected).pipe(filter(isConnectedSessionState)),
    );

    expect(state.portInfo).toEqual(stubPortInfo);
  });
});

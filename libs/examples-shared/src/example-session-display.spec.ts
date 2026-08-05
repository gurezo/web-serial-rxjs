import {
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { describe, expect, it } from 'vitest';
import {
  formatExamplePortInfo,
  formatExampleSerialErrorDetail,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
} from './example-session-display';

describe('formatExampleSessionStatus', () => {
  it('formats idle with Japanese label', () => {
    const display = formatExampleSessionStatus({
      status: SerialSessionStatus.Idle,
    });

    expect(display).toEqual({
      status: 'idle',
      label: 'アイドル',
      display: 'idle（アイドル）',
      inProgress: false,
    });
  });

  it('marks connecting and disconnecting as in progress', () => {
    expect(
      formatExampleSessionStatus({ status: SerialSessionStatus.Connecting })
        .inProgress,
    ).toBe(true);
    expect(
      formatExampleSessionStatus({ status: SerialSessionStatus.Disconnecting })
        .inProgress,
    ).toBe(true);
    expect(
      formatExampleSessionStatus({
        status: SerialSessionStatus.Connected,
        portInfo: {},
      }).inProgress,
    ).toBe(false);
  });
});

describe('formatExamplePortInfo', () => {
  it('formats vendor and product ids as hex', () => {
    expect(
      formatExamplePortInfo({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
    ).toEqual({
      vendorId: '0x2341',
      productId: '0x0043',
      display: 'Vendor ID: 0x2341 / Product ID: 0x0043',
    });
  });

  it('uses 不明 when ids are missing', () => {
    expect(formatExamplePortInfo({})).toEqual({
      vendorId: '不明',
      productId: '不明',
      display: 'Vendor ID: 不明 / Product ID: 不明',
    });
  });
});

describe('formatExampleSerialErrorDetail', () => {
  it('includes code and maps cancel to info', () => {
    const error = new SerialError(
      SerialErrorCode.OPERATION_CANCELLED,
      'cancelled',
      { cause: undefined },
    );

    const detail = formatExampleSerialErrorDetail(error);

    expect(detail.type).toBe('info');
    expect(detail.code).toBe(SerialErrorCode.OPERATION_CANCELLED);
    expect(detail.message).toContain('キャンセル');
  });

  it('summarizes cause and structured context', () => {
    const error = new SerialError(
      SerialErrorCode.WRITE_FAILED,
      'write failed',
      new Error('device busy'),
    );

    const detail = formatExampleSerialErrorDetail(error);

    expect(detail).toMatchObject({
      type: 'error',
      message: 'write failed',
      code: SerialErrorCode.WRITE_FAILED,
    });
    expect(detail.contextSummary).toContain('cause: Error: device busy');
  });

  it('summarizes maxChars for line buffer overflow', () => {
    const error = new SerialError(
      SerialErrorCode.LINE_BUFFER_OVERFLOW,
      'overflow',
      undefined,
      { maxChars: 4096 },
    );

    expect(formatExampleSerialErrorDetail(error).contextSummary).toBe(
      'maxChars: 4096',
    );
  });
});

describe('getExampleControlsEnabled', () => {
  const idle: SerialSessionState = { status: SerialSessionStatus.Idle };
  const connected: SerialSessionState = {
    status: SerialSessionStatus.Connected,
    portInfo: { usbVendorId: 1, usbProductId: 2 },
  };
  const connecting: SerialSessionState = {
    status: SerialSessionStatus.Connecting,
  };
  const disconnecting: SerialSessionState = {
    status: SerialSessionStatus.Disconnecting,
  };

  it('enables connect only when idle and canConnect', () => {
    expect(getExampleControlsEnabled(idle, true)).toEqual({
      connect: true,
      disconnect: false,
      send: false,
    });
    expect(getExampleControlsEnabled(idle, false).connect).toBe(false);
  });

  it('enables disconnect and send when connected', () => {
    expect(getExampleControlsEnabled(connected, true)).toEqual({
      connect: false,
      disconnect: true,
      send: true,
    });
  });

  it('disables all actions while connecting or disconnecting', () => {
    expect(getExampleControlsEnabled(connecting, true)).toEqual({
      connect: false,
      disconnect: false,
      send: false,
    });
    expect(getExampleControlsEnabled(disconnecting, true)).toEqual({
      connect: false,
      disconnect: false,
      send: false,
    });
  });
});

import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatExampleSerialError,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
} from './example-requirements';

describe('getExampleRequirementsCopy', () => {
  it('returns Japanese requirements title and items', () => {
    const copy = getExampleRequirementsCopy();

    expect(copy.title).toBe('利用条件');
    expect(copy.items).toHaveLength(3);
    expect(copy.items[0]).toContain('HTTPS');
    expect(copy.items[1]).toContain('ユーザー操作');
    expect(copy.items[2]).toContain('デスクトップ');
  });
});

describe('getExampleSupportStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports canConnect when Web Serial and secure context are available', () => {
    vi.stubGlobal('navigator', { serial: {} });
    vi.stubGlobal('window', { isSecureContext: true });

    const status = getExampleSupportStatus();

    expect(status.apiSupported).toBe(true);
    expect(status.secureContext).toBe(true);
    expect(status.canConnect).toBe(true);
    expect(status.unsupportedReason).toBe('none');
    expect(status.statusType).toBe('success');
    expect(status.statusMessage).toContain('サポート');
  });

  it('reports no-web-serial when navigator.serial is missing', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', { isSecureContext: true });

    const status = getExampleSupportStatus();

    expect(status.apiSupported).toBe(false);
    expect(status.canConnect).toBe(false);
    expect(status.unsupportedReason).toBe('no-web-serial');
    expect(status.statusType).toBe('error');
    expect(status.statusMessage).toContain('サポートしていません');
    expect(status.statusMessage).toContain('Firefox');
  });

  it('reports insecure-context when isSecureContext is false', () => {
    vi.stubGlobal('navigator', { serial: {} });
    vi.stubGlobal('window', { isSecureContext: false });

    const status = getExampleSupportStatus();

    expect(status.apiSupported).toBe(true);
    expect(status.secureContext).toBe(false);
    expect(status.canConnect).toBe(false);
    expect(status.unsupportedReason).toBe('insecure-context');
    expect(status.statusMessage).toContain('セキュアコンテキスト');
  });

  it('reports both when API and secure context are unavailable', () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', { isSecureContext: false });

    const status = getExampleSupportStatus();

    expect(status.unsupportedReason).toBe('both');
    expect(status.canConnect).toBe(false);
    expect(status.statusMessage).toContain('HTTPS');
  });
});

describe('formatExampleSerialError', () => {
  it('maps OPERATION_CANCELLED to an info guidance message', () => {
    const error = new SerialError(
      SerialErrorCode.OPERATION_CANCELLED,
      'Port selection was cancelled by the user',
    );

    expect(formatExampleSerialError(error)).toEqual({
      type: 'info',
      message:
        'ポート選択がキャンセルされました。再度『接続』を押してポートを選んでください。',
    });
  });

  it('keeps other errors as error tone with original message', () => {
    const error = new SerialError(SerialErrorCode.WRITE_FAILED, 'write failed');

    expect(formatExampleSerialError(error)).toEqual({
      type: 'error',
      message: 'write failed',
    });
  });
});

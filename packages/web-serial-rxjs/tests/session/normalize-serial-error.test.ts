import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { normalizeSerialError } from '../../src/session/normalize-serial-error';

describe('normalizeSerialError', () => {
  it('returns SerialError instances unchanged', () => {
    const original = new SerialError(
      SerialErrorCode.PORT_NOT_OPEN,
      'port not open',
    );

    const normalized = normalizeSerialError(original, {
      fallbackCode: SerialErrorCode.UNKNOWN,
    });

    expect(normalized).toBe(original);
  });

  it('maps DOMException(NotFoundError) to OPERATION_CANCELLED', () => {
    const dom = new DOMException('No port selected', 'NotFoundError');

    const normalized = normalizeSerialError(dom, {
      fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
    });

    expect(normalized).toBeInstanceOf(SerialError);
    expect(normalized.code).toBe(SerialErrorCode.OPERATION_CANCELLED);
    expect(normalized.originalError).toBe(dom);
  });

  it('wraps arbitrary Error instances using the provided fallback code', () => {
    const cause = new Error('cannot open');

    const normalized = normalizeSerialError(cause, {
      fallbackCode: SerialErrorCode.PORT_OPEN_FAILED,
      messagePrefix: 'Failed to open port',
    });

    expect(normalized.code).toBe(SerialErrorCode.PORT_OPEN_FAILED);
    expect(normalized.message).toBe('Failed to open port: cannot open');
    expect(normalized.originalError).toBe(cause);
  });

  it('wraps non-Error values into Error causes so originalError is always an Error', () => {
    const normalized = normalizeSerialError('string failure', {
      fallbackCode: SerialErrorCode.WRITE_FAILED,
      messagePrefix: 'Failed to write data',
    });

    expect(normalized.code).toBe(SerialErrorCode.WRITE_FAILED);
    expect(normalized.message).toBe('Failed to write data: string failure');
    expect(normalized.originalError).toBeInstanceOf(Error);
    expect(normalized.originalError?.message).toBe('string failure');
  });

  it('uses the default message prefix when one is not provided', () => {
    const cause = new Error('boom');

    const normalized = normalizeSerialError(cause, {
      fallbackCode: SerialErrorCode.UNKNOWN,
    });

    expect(normalized.message).toBe('Serial operation failed: boom');
  });

  it('passes through non-NotFoundError DOMExceptions using the fallback code', () => {
    const dom = new DOMException('locked', 'InvalidStateError');

    const normalized = normalizeSerialError(dom, {
      fallbackCode: SerialErrorCode.CONNECTION_LOST,
      messagePrefix: 'Failed to close port',
    });

    expect(normalized.code).toBe(SerialErrorCode.CONNECTION_LOST);
    expect(normalized.message).toBe('Failed to close port: locked');
    expect(normalized.originalError).toBe(dom);
  });
});

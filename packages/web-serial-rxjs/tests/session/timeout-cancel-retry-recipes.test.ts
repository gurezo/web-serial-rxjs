import { Subject, firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { SerialSessionStatus } from '../../src/session/serial-session-state';
import { createFakeSerialSession } from '../helpers/fake-serial-session';
import {
  connectWithLimitedRetry$,
  connectWithTimeout$,
  exponentialBackoffDelayMs,
  isTimeoutError,
  isUserCancelled,
  reconnectUnlessDisposed$,
  requestIdempotentWithRetry$,
  requestNonIdempotent$,
  requestWithTimeout$,
  shouldRetryConnect,
  withCancel$,
} from '../helpers/timeout-cancel-retry-recipes';

/**
 * Timeout / cancel / retry recipe scenarios (Issue #539).
 *
 * Uses the Fake SerialSession from #537 — no USB hardware required.
 */

describe('timeout-cancel-retry recipes (Issue #539)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out a hanging connect$', async () => {
    const fake = createFakeSerialSession();
    fake.hangNextConnect();

    const result = firstValueFrom(
      connectWithTimeout$(fake.session, { timeoutMs: 50 }),
    );
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it('times out when no matching response arrives', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());

    const result = firstValueFrom(
      requestWithTimeout$(fake.session, 'AT\r\n', 'OK', { timeoutMs: 50 }),
    );
    const assertion = expect(result).rejects.toSatisfy(isTimeoutError);

    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(fake.sent).toEqual(['AT\r\n']);
  });

  it('cancels an in-flight wait with takeUntil / destroy$', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());
    const destroy$ = new Subject<void>();

    let completed = false;
    let errored = false;
    const emissions: string[] = [];

    const sub = withCancel$(
      requestWithTimeout$(fake.session, 'AT\r\n', 'OK', { timeoutMs: 5000 }),
      destroy$,
    ).subscribe({
      next: (line) => emissions.push(line),
      error: () => {
        errored = true;
      },
      complete: () => {
        completed = true;
      },
    });

    expect(fake.sent).toEqual(['AT\r\n']);

    destroy$.next();
    destroy$.complete();

    expect(completed).toBe(true);
    expect(errored).toBe(false);
    expect(emissions).toEqual([]);
    expect(sub.closed).toBe(true);

    // Late reply after cancel must not be delivered
    fake.emitLine('OK');
    expect(emissions).toEqual([]);
  });

  it('retries connect a limited number of times then succeeds', async () => {
    const fake = createFakeSerialSession();
    fake.failConnectTimes(
      2,
      new SerialError(SerialErrorCode.PORT_OPEN_FAILED, 'busy'),
    );

    const result = firstValueFrom(
      connectWithLimitedRetry$(fake.session, {
        count: 2,
        baseDelayMs: 10,
        timeoutMs: 1000,
      }),
    );

    // First failure → backoff 10ms → second failure → backoff 20ms → success
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(20);
    await expect(result).resolves.toBeUndefined();
    await expect(firstValueFrom(fake.session.state$)).resolves.toMatchObject({
      status: SerialSessionStatus.Connected,
    });
  });

  it('exhausts limited retries and fails', async () => {
    const fake = createFakeSerialSession();
    const openError = new SerialError(
      SerialErrorCode.PORT_OPEN_FAILED,
      'still busy',
    );
    fake.failConnectTimes(3, openError);

    const result = firstValueFrom(
      connectWithLimitedRetry$(fake.session, {
        count: 2,
        baseDelayMs: 5,
        timeoutMs: 1000,
      }),
    );
    const assertion = expect(result).rejects.toBe(openError);

    await vi.advanceTimersByTimeAsync(5);
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
  });

  it('uses exponential backoff delays', () => {
    expect(exponentialBackoffDelayMs(1, 100)).toBe(100);
    expect(exponentialBackoffDelayMs(2, 100)).toBe(200);
    expect(exponentialBackoffDelayMs(3, 100)).toBe(400);
  });

  it('does not retry user cancel (OPERATION_CANCELLED)', async () => {
    const fake = createFakeSerialSession();
    const cancelled = new SerialError(
      SerialErrorCode.OPERATION_CANCELLED,
      'user cancelled port picker',
    );
    fake.failNextConnect(cancelled);

    expect(shouldRetryConnect(cancelled)).toBe(false);
    expect(isUserCancelled(cancelled)).toBe(true);

    const result = firstValueFrom(
      connectWithLimitedRetry$(fake.session, {
        count: 5,
        baseDelayMs: 10,
        timeoutMs: 1000,
      }),
    );

    // No timer advance needed — cancel must fail immediately without retry delay
    await expect(result).rejects.toBe(cancelled);
  });

  it('does not reconnect after dispose$', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.dispose$());

    await expect(
      firstValueFrom(
        reconnectUnlessDisposed$(fake.session, {
          count: 2,
          baseDelayMs: 5,
        }),
      ),
    ).rejects.toMatchObject({
      code: SerialErrorCode.SESSION_DISPOSED,
    });

    await expect(
      firstValueFrom(
        connectWithLimitedRetry$(fake.session, {
          count: 2,
          baseDelayMs: 5,
        }),
      ),
    ).rejects.toMatchObject({
      code: SerialErrorCode.SESSION_DISPOSED,
    });
  });

  it('does not auto-resend non-idempotent commands', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());
    fake.failNextSend(
      new SerialError(SerialErrorCode.WRITE_FAILED, 'write failed'),
    );

    await expect(
      firstValueFrom(
        requestNonIdempotent$(fake.session, 'MOTOR_START\r\n', 'OK', {
          timeoutMs: 50,
        }),
      ),
    ).rejects.toMatchObject({ code: SerialErrorCode.WRITE_FAILED });

    // Exactly one send attempt — no automatic resend
    expect(fake.sent).toEqual(['MOTOR_START\r\n']);
  });

  it('may retry idempotent requests when explicitly opted in', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());
    fake.failNextSend(
      new SerialError(SerialErrorCode.WRITE_FAILED, 'transient'),
    );

    const result = firstValueFrom(
      requestIdempotentWithRetry$(fake.session, 'STATUS?\r\n', 'OK', {
        idempotent: true,
        count: 1,
        baseDelayMs: 10,
        timeoutMs: 200,
      }),
    );

    await vi.advanceTimersByTimeAsync(10);

    // Drive reply after the retried send is recorded
    await vi.waitFor(() => {
      expect(fake.sent.length).toBeGreaterThanOrEqual(2);
    });
    fake.emitLine('OK');

    await expect(result).resolves.toBe('OK');
    expect(fake.sent).toEqual(['STATUS?\r\n', 'STATUS?\r\n']);
  });
});

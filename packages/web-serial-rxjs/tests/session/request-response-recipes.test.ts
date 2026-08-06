import {
  TimeoutError,
  firstValueFrom,
  from,
  switchMap,
  take,
  toArray,
} from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createFakeSerialSession } from '../helpers/fake-serial-session';
import {
  isResponseTimeout,
  isSendFailure,
  requestLine$,
  requestLinesInOrder$,
  requestUntil$,
  waitForLine$,
  waitUntilBuffer$,
} from '../helpers/request-response-recipes';

/**
 * Request / Response recipe scenarios (Issue #538).
 *
 * Uses the Fake SerialSession from #537 — no USB hardware required.
 */

describe('request-response recipes (Issue #538)', () => {
  it('waits for the next exact line on lines$', async () => {
    const fake = createFakeSerialSession();
    const linePromise = firstValueFrom(waitForLine$(fake.session, 'OK'));

    fake.emitLine('BUSY');
    fake.emitLine('OK');

    await expect(linePromise).resolves.toBe('OK');
  });

  it('matches lines by substring predicate and RegExp', async () => {
    const fake = createFakeSerialSession();

    const containsPromise = firstValueFrom(
      waitForLine$(fake.session, (line) => line.includes('ready')),
    );
    fake.emitLine('not yet');
    fake.emitLine('device ready');
    await expect(containsPromise).resolves.toBe('device ready');

    const regexPromise = firstValueFrom(
      waitForLine$(fake.session, /^VERSION=\d+$/),
    );
    fake.emitLine('VERSION=x');
    fake.emitLine('VERSION=42');
    await expect(regexPromise).resolves.toBe('VERSION=42');
  });

  it('completes the wait subscription after take(1)', async () => {
    const fake = createFakeSerialSession();
    const emissions: string[] = [];
    let completed = false;

    const sub = waitForLine$(fake.session, 'OK').subscribe({
      next: (line) => emissions.push(line),
      complete: () => {
        completed = true;
      },
    });

    fake.emitLine('OK');
    fake.emitLine('OK');

    expect(emissions).toEqual(['OK']);
    expect(completed).toBe(true);
    expect(sub.closed).toBe(true);
  });

  it('times out when no matching line arrives', async () => {
    const fake = createFakeSerialSession();

    await expect(
      firstValueFrom(waitForLine$(fake.session, 'OK', { timeoutMs: 50 })),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('misses a fast reply when send happens before wait (hot stream)', async () => {
    const fake = createFakeSerialSession();

    await firstValueFrom(fake.session.send$('AT\r\n'));
    fake.emitLine('OK');

    await expect(
      firstValueFrom(waitForLine$(fake.session, 'OK', { timeoutMs: 50 })),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('requestLine$ subscribes first then send$ and captures the reply', async () => {
    const fake = createFakeSerialSession();

    const responsePromise = firstValueFrom(
      requestLine$(fake.session, 'AT\r\n', 'OK'),
    );

    queueMicrotask(() => {
      expect(fake.sent).toEqual(['AT\r\n']);
      fake.emitLine('OK');
    });

    await expect(responsePromise).resolves.toBe('OK');
  });

  it('distinguishes send failure (SerialError) from response timeout', async () => {
    const fake = createFakeSerialSession();
    const writeError = new SerialError(
      SerialErrorCode.WRITE_FAILED,
      'port closed',
    );
    fake.failNextSend(writeError);

    try {
      await firstValueFrom(requestLine$(fake.session, 'AT\r\n', 'OK'));
      expect.unreachable('expected send failure');
    } catch (error) {
      expect(isSendFailure(error)).toBe(true);
      expect(isResponseTimeout(error)).toBe(false);
      expect(error).toBe(writeError);
    }

    try {
      await firstValueFrom(
        requestLine$(fake.session, 'AT\r\n', 'OK', { timeoutMs: 50 }),
      );
      expect.unreachable('expected timeout');
    } catch (error) {
      expect(isResponseTimeout(error)).toBe(true);
      expect(isSendFailure(error)).toBe(false);
    }
  });

  it('buffers receive$ chunks until a prompt / terminator appears', async () => {
    const fake = createFakeSerialSession();
    const bufferPromise = firstValueFrom(
      waitUntilBuffer$(fake.session, (buf) => /device>\s*$/.test(buf)),
    );

    fake.emitReceive('hel');
    fake.emitReceive('lo\r\n');
    fake.emitReceive('device> ');

    await expect(bufferPromise).resolves.toBe('hello\r\ndevice> ');
  });

  it('requestUntil$ waits for a terminator after send', async () => {
    const fake = createFakeSerialSession();
    const responsePromise = firstValueFrom(
      requestUntil$(
        fake.session,
        'status\r\n',
        (buf) => buf.includes('END'),
        { timeoutMs: 500 },
      ),
    );

    queueMicrotask(() => {
      fake.emitReceive('sta');
      fake.emitReceive('tus\r\nEND');
    });

    await expect(responsePromise).resolves.toBe('status\r\nEND');
  });

  it('serializes multiple requests with concatMap (not switchMap)', async () => {
    const fake = createFakeSerialSession();
    const replies: string[] = [];

    const run = firstValueFrom(
      requestLinesInOrder$(
        fake.session,
        [
          { payload: 'CMD1\r\n', matcher: 'R1' },
          { payload: 'CMD2\r\n', matcher: 'R2' },
          { payload: 'CMD3\r\n', matcher: 'R3' },
        ],
        { timeoutMs: 500 },
      ).pipe(take(3), toArray()),
    );

    // Drive replies as each command is recorded
    const drive = async () => {
      for (const expected of ['CMD1\r\n', 'CMD2\r\n', 'CMD3\r\n'] as const) {
        await viWaitUntil(() => fake.sent.includes(expected));
        const reply =
          expected === 'CMD1\r\n'
            ? 'R1'
            : expected === 'CMD2\r\n'
              ? 'R2'
              : 'R3';
        fake.emitLine(reply);
        replies.push(reply);
      }
    };

    void drive();

    await expect(run).resolves.toEqual(['R1', 'R2', 'R3']);
    expect(fake.sent).toEqual(['CMD1\r\n', 'CMD2\r\n', 'CMD3\r\n']);
    expect(replies).toEqual(['R1', 'R2', 'R3']);
  });

  it('documents why switchMap is unsafe without correlation ids', async () => {
    const fake = createFakeSerialSession();

    // switchMap cancels the previous wait when a new command starts
    const lastOnly = firstValueFrom(
      from([
        { payload: 'A\r\n', matcher: 'RA' as const },
        { payload: 'B\r\n', matcher: 'RB' as const },
      ]).pipe(
        switchMap(({ payload, matcher }) =>
          requestLine$(fake.session, payload, matcher, { timeoutMs: 200 }),
        ),
        take(1),
      ),
    );

    queueMicrotask(() => {
      fake.emitLine('RA');
      fake.emitLine('RB');
    });

    // Only the last in-flight request can win under switchMap
    await expect(lastOnly).resolves.toBe('RB');
    expect(fake.sent).toEqual(['A\r\n', 'B\r\n']);
  });
});

/** Tiny poll helper to avoid pulling Vitest fake timers into recipe tests. */
async function viWaitUntil(
  predicate: () => boolean,
  timeoutMs = 1000,
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('viWaitUntil timed out');
    }
    await new Promise((r) => setTimeout(r, 0));
  }
}

import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import { createSerialSession } from '../../src/session/create-serial-session';
import { SerialSessionStatus } from '../../src/session/serial-session-state';
import {
  assertResourceReleased,
  createResourceTracker,
  flushMicrotasks,
  installNavigator,
  makeMockPort,
  makeStreamWithReaderSpy,
  resetNavigator,
  restoreNavigator,
} from '../helpers/serial-session-test-harness';

const S = SerialSessionStatus;

describe('SerialSession resource lifecycle (#587)', () => {
  const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'navigator',
  );

  beforeEach(() => {
    resetNavigator();
  });

  afterEach(() => {
    restoreNavigator(originalNavigatorDescriptor);
  });

  describe('disconnect$', () => {
    it('releases reader and port after connect → read → disconnect', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const receivedPromise = firstValueFrom(session.receive$.pipe(take(1)));
      streamWithSpy.controller.enqueue(new TextEncoder().encode('hello'));
      await expect(receivedPromise).resolves.toBe('hello');

      await firstValueFrom(session.disconnect$());

      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
    });

    it('releases reader and port after connect → disconnect without read', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());
      await firstValueFrom(session.disconnect$());

      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      expect(await firstValueFrom(session.state$)).toEqual({ status: S.Idle });
    });
  });

  describe('dispose$', () => {
    it('releases reader and port after connect → read → dispose', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const receivedPromise = firstValueFrom(session.receive$.pipe(take(1)));
      streamWithSpy.controller.enqueue(new TextEncoder().encode('hello'));
      await expect(receivedPromise).resolves.toBe('hello');

      const states = lastValueFrom(session.state$.pipe(toArray()));
      await firstValueFrom(session.dispose$());

      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      await expect(states).resolves.toEqual([
        { status: S.Connected, portInfo: expect.any(Object) },
        { status: S.Disposed },
      ]);
    });

    it('releases reader and port when disposing from error state', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorPromise = firstValueFrom(session.errors$);
      streamWithSpy.controller.error(new Error('device unplugged'));
      await errorPromise;
      await flushMicrotasks();

      const states = lastValueFrom(session.state$.pipe(toArray()));
      await firstValueFrom(session.dispose$());

      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      await expect(states).resolves.toEqual(
        expect.arrayContaining([{ status: S.Disposed }]),
      );
    });
  });

  describe('fatal error paths', () => {
    it('releases reader and port after read error', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorPromise = firstValueFrom(session.errors$);
      streamWithSpy.controller.error(new Error('device unplugged'));
      const received = await errorPromise;
      await flushMicrotasks();

      expect(received).toBeInstanceOf(SerialError);
      expect(received.code).toBe(SerialErrorCode.READ_FAILED);
      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      expect(await firstValueFrom(session.state$)).toEqual({
        status: S.Error,
        error: received,
      });
    });

    it('releases reader and port after connection lost', async () => {
      const streamWithSpy = makeStreamWithReaderSpy();
      const port = makeMockPort(streamWithSpy.stream);
      installNavigator(port);
      const tracker = createResourceTracker(streamWithSpy, port);

      const session = createSerialSession();
      await firstValueFrom(session.connect$());

      const errorPromise = firstValueFrom(session.errors$);
      streamWithSpy.controller.close();
      const received = await errorPromise;
      await flushMicrotasks();

      expect(received).toBeInstanceOf(SerialError);
      expect(received.code).toBe(SerialErrorCode.CONNECTION_LOST);
      assertResourceReleased(tracker, {
        readerCount: 1,
        portCloseCount: 1,
      });
      expect(await firstValueFrom(session.state$)).toEqual({
        status: S.Error,
        error: received,
      });
    });
  });
});

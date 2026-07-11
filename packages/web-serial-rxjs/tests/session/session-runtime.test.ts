import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialError } from '../../src/errors/serial-error';
import { SerialErrorCode } from '../../src/errors/serial-error-code';
import type { ReadPump } from '../../src/session/read-pump';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '../../src/session/serial-session-state';
import {
  ALLOWED_TRANSITIONS,
  createConnectedRuntime,
  createConnectingRuntime,
  createDisconnectingRuntime,
  createDisposedRuntime,
  createErrorRuntime,
  createIdleRuntime,
  createInitialRuntime,
  createSessionRuntimeController,
  createUnsupportedRuntime,
  isValidTransition,
  runtimeToPublicState,
  runtimeToSessionStatus,
} from '../../src/session/session-runtime';

const S = SerialSessionStatus;

const stubPortInfo: SerialPortInfo = { usbVendorId: 1, usbProductId: 2 };

const stubError = new SerialError(SerialErrorCode.READ_FAILED, 'test error');

function createMockPort(): SerialPort {
  return {
    getInfo: () => stubPortInfo,
    open: vi.fn(),
    close: vi.fn(),
    readable: null,
    writable: null,
  } as unknown as SerialPort;
}

function createMockPump(): ReadPump {
  return {
    start: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    isRunning: false,
  };
}

describe('session-runtime', () => {
  describe('runtime factories', () => {
    it('createInitialRuntime returns idle when supported', () => {
      const runtime = createInitialRuntime(true);

      expect(runtime).toEqual(createIdleRuntime());
      expect(runtimeToSessionStatus(runtime)).toBe(S.Idle);
    });

    it('createInitialRuntime returns unsupported when not supported', () => {
      const runtime = createInitialRuntime(false);

      expect(runtime).toEqual(createUnsupportedRuntime());
      expect(runtimeToSessionStatus(runtime)).toBe(S.Unsupported);
    });

    it('createConnectedRuntime holds port and pump', () => {
      const port = createMockPort();
      const pump = createMockPump();
      const runtime = createConnectedRuntime(port, pump);

      expect(runtime.status).toBe(S.Connected);
      expect(runtime.port).toBe(port);
      expect(runtime.pump).toBe(pump);
    });
  });

  describe('runtimeToPublicState', () => {
    it('maps connected runtime to portInfo payload', () => {
      const port = createMockPort();
      const pump = createMockPump();
      const runtime = createConnectedRuntime(port, pump);

      expect(runtimeToPublicState(runtime)).toEqual({
        status: S.Connected,
        portInfo: stubPortInfo,
      });
    });

    it('maps error runtime to error payload', () => {
      const runtime = createErrorRuntime(stubError);

      expect(runtimeToPublicState(runtime)).toEqual({
        status: S.Error,
        error: stubError,
      });
    });

    it('maps idle runtime to status-only payload', () => {
      expect(runtimeToPublicState(createIdleRuntime())).toEqual({
        status: S.Idle,
      });
    });
  });

  describe('isValidTransition', () => {
    it('matches ALLOWED_TRANSITIONS for happy path', () => {
      expect(isValidTransition(S.Idle, S.Connecting)).toBe(true);
      expect(isValidTransition(S.Connecting, S.Connected)).toBe(true);
      expect(isValidTransition(S.Connected, S.Disconnecting)).toBe(true);
      expect(isValidTransition(S.Disconnecting, S.Idle)).toBe(true);
    });

    it('rejects same-state transitions', () => {
      expect(isValidTransition(S.Idle, S.Idle)).toBe(false);
    });

    it('rejects invalid transitions', () => {
      expect(isValidTransition(S.Idle, S.Connected)).toBe(false);
      expect(isValidTransition(S.Connected, S.Idle)).toBe(false);
    });

    it('covers every state in ALLOWED_TRANSITIONS', () => {
      for (const state of Object.values(S)) {
        expect(ALLOWED_TRANSITIONS[state]).toBeDefined();
      }
    });
  });

  describe('SessionRuntimeController', () => {
    let warnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    describe('construction', () => {
      it('starts in idle by default', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        expect(controller.status).toBe(S.Idle);
      });

      it('honours an explicit initial unsupported runtime', () => {
        const controller = createSessionRuntimeController(
          createUnsupportedRuntime(),
        );

        expect(controller.status).toBe(S.Unsupported);
      });
    });

    describe('state$', () => {
      it('replays the current state on subscribe', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        const state = await firstValueFrom(controller.state$);

        expect(state).toEqual<SerialSessionState>({ status: S.Idle });
      });

      it('emits every valid transition in order', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();

        const collected = lastValueFrom(
          controller.state$.pipe(take(5), toArray()),
        );

        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createConnectedRuntime(port, pump));
        controller.transition(createDisconnectingRuntime(port));
        controller.transition(createIdleRuntime());

        await expect(collected).resolves.toEqual<SerialSessionState[]>([
          { status: S.Idle },
          { status: S.Connecting },
          { status: S.Connected, portInfo: stubPortInfo },
          { status: S.Disconnecting },
          { status: S.Idle },
        ]);
      });
    });

    describe('happy path transitions', () => {
      it('moves idle -> connecting -> connected -> disconnecting -> idle', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();

        expect(
          controller.transition(createConnectingRuntime(() => undefined)),
        ).toBe(true);
        expect(controller.status).toBe(S.Connecting);

        expect(
          controller.transition(createConnectedRuntime(port, pump)),
        ).toBe(true);
        expect(controller.status).toBe(S.Connected);

        expect(
          controller.transition(createDisconnectingRuntime(port)),
        ).toBe(true);
        expect(controller.status).toBe(S.Disconnecting);

        expect(controller.transition(createIdleRuntime())).toBe(true);
        expect(controller.status).toBe(S.Idle);
      });
    });

    describe('error path', () => {
      it('allows error from connecting, connected and disconnecting', () => {
        const port = createMockPort();
        const pump = createMockPump();

        const fromConnecting = createSessionRuntimeController(createIdleRuntime());
        fromConnecting.transition(createConnectingRuntime(() => undefined));
        expect(fromConnecting.transition(createErrorRuntime(stubError))).toBe(
          true,
        );
        expect(fromConnecting.status).toBe(S.Error);

        const fromConnected = createSessionRuntimeController(createIdleRuntime());
        fromConnected.transition(createConnectingRuntime(() => undefined));
        fromConnected.transition(createConnectedRuntime(port, pump));
        expect(fromConnected.transition(createErrorRuntime(stubError))).toBe(
          true,
        );
        expect(fromConnected.status).toBe(S.Error);

        const fromDisconnecting = createSessionRuntimeController(
          createIdleRuntime(),
        );
        fromDisconnecting.transition(createConnectingRuntime(() => undefined));
        fromDisconnecting.transition(createConnectedRuntime(port, pump));
        fromDisconnecting.transition(createDisconnectingRuntime(port));
        expect(fromDisconnecting.transition(createErrorRuntime(stubError))).toBe(
          true,
        );
        expect(fromDisconnecting.status).toBe(S.Error);
      });

      it('recovers from error back to idle and forward to connecting', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createErrorRuntime(stubError));

        expect(controller.transition(createIdleRuntime())).toBe(true);
        expect(controller.status).toBe(S.Idle);

        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createErrorRuntime(stubError));
        expect(
          controller.transition(createConnectingRuntime(() => undefined)),
        ).toBe(true);
        expect(controller.status).toBe(S.Connecting);
      });
    });

    describe('invalid transitions', () => {
      it('ignores idle -> connected and warns', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();

        expect(
          controller.transition(createConnectedRuntime(port, pump)),
        ).toBe(false);
        expect(controller.status).toBe(S.Idle);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });

      it('ignores connected -> idle (must go through disconnecting)', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();
        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createConnectedRuntime(port, pump));

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(controller.status).toBe(S.Connected);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });

      it('returns false and does not emit on same-state transition', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(warnSpy).not.toHaveBeenCalled();

        const states = await lastValueFrom(
          controller.state$.pipe(take(1), toArray()),
        );
        expect(states).toEqual<SerialSessionState[]>([{ status: S.Idle }]);
      });
    });

    describe('unsupported (terminal)', () => {
      it('rejects every transition once entered via construction', () => {
        const controller = createSessionRuntimeController(
          createUnsupportedRuntime(),
        );
        const port = createMockPort();
        const pump = createMockPump();

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(
          controller.transition(createConnectingRuntime(() => undefined)),
        ).toBe(false);
        expect(
          controller.transition(createConnectedRuntime(port, pump)),
        ).toBe(false);
        expect(
          controller.transition(createDisconnectingRuntime(port)),
        ).toBe(false);
        expect(controller.transition(createErrorRuntime(stubError))).toBe(false);
        expect(controller.status).toBe(S.Unsupported);
      });
    });

    describe('disposed (terminal)', () => {
      it('allows transition to disposed from every active state', () => {
        const port = createMockPort();
        const pump = createMockPump();

        const fromIdle = createSessionRuntimeController(createIdleRuntime());
        expect(fromIdle.transition(createDisposedRuntime())).toBe(true);
        expect(fromIdle.status).toBe(S.Disposed);

        const fromConnecting = createSessionRuntimeController(createIdleRuntime());
        fromConnecting.transition(createConnectingRuntime(() => undefined));
        expect(fromConnecting.transition(createDisposedRuntime())).toBe(true);
        expect(fromConnecting.status).toBe(S.Disposed);

        const fromConnected = createSessionRuntimeController(createIdleRuntime());
        fromConnected.transition(createConnectingRuntime(() => undefined));
        fromConnected.transition(createConnectedRuntime(port, pump));
        expect(fromConnected.transition(createDisposedRuntime())).toBe(true);
        expect(fromConnected.status).toBe(S.Disposed);

        const fromDisconnecting = createSessionRuntimeController(
          createIdleRuntime(),
        );
        fromDisconnecting.transition(createConnectingRuntime(() => undefined));
        fromDisconnecting.transition(createConnectedRuntime(port, pump));
        fromDisconnecting.transition(createDisconnectingRuntime(port));
        expect(fromDisconnecting.transition(createDisposedRuntime())).toBe(true);
        expect(fromDisconnecting.status).toBe(S.Disposed);

        const fromError = createSessionRuntimeController(createIdleRuntime());
        fromError.transition(createConnectingRuntime(() => undefined));
        fromError.transition(createErrorRuntime(stubError));
        expect(fromError.transition(createDisposedRuntime())).toBe(true);
        expect(fromError.status).toBe(S.Disposed);
      });

      it('rejects every transition once entered', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();
        controller.transition(createDisposedRuntime());

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(
          controller.transition(createConnectingRuntime(() => undefined)),
        ).toBe(false);
        expect(
          controller.transition(createConnectedRuntime(port, pump)),
        ).toBe(false);
        expect(
          controller.transition(createDisconnectingRuntime(port)),
        ).toBe(false);
        expect(controller.transition(createErrorRuntime(stubError))).toBe(false);
        expect(controller.status).toBe(S.Disposed);
      });
    });

    describe('complete', () => {
      it('completes the state$ stream', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        const collected = lastValueFrom(controller.state$.pipe(toArray()));

        controller.transition(createConnectingRuntime(() => undefined));
        controller.complete();

        await expect(collected).resolves.toEqual<SerialSessionState[]>([
          { status: S.Idle },
          { status: S.Connecting },
        ]);
      });
    });

    describe('runtime narrowing', () => {
      it('connected runtime always has port and pump', () => {
        const port = createMockPort();
        const pump = createMockPump();
        const controller = createSessionRuntimeController(createIdleRuntime());
        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createConnectedRuntime(port, pump));

        const runtime = controller.runtime;
        if (runtime.status === S.Connected) {
          expect(runtime.port).toBe(port);
          expect(runtime.pump).toBe(pump);
        } else {
          throw new Error('expected connected runtime');
        }
      });
    });
  });
});

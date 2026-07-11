import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReadPump } from '../../src/session/read-pump';
import { SerialSessionState } from '../../src/session/serial-session-state';
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
  runtimeToSessionState,
} from '../../src/session/session-runtime';

const S = SerialSessionState;

function createMockPort(): SerialPort {
  return {
    getInfo: () => ({ usbVendorId: 1, usbProductId: 2 }),
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
      expect(runtimeToSessionState(runtime)).toBe(S.Idle);
    });

    it('createInitialRuntime returns unsupported when not supported', () => {
      const runtime = createInitialRuntime(false);

      expect(runtime).toEqual(createUnsupportedRuntime());
      expect(runtimeToSessionState(runtime)).toBe(S.Unsupported);
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

        expect(controller.status).toBe<SerialSessionState>(S.Idle);
      });

      it('honours an explicit initial unsupported runtime', () => {
        const controller = createSessionRuntimeController(
          createUnsupportedRuntime(),
        );

        expect(controller.status).toBe<SerialSessionState>(S.Unsupported);
      });
    });

    describe('state$', () => {
      it('replays the current state on subscribe', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        const state = await firstValueFrom(controller.state$);

        expect(state).toBe<SerialSessionState>(S.Idle);
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
          S.Idle,
          S.Connecting,
          S.Connected,
          S.Disconnecting,
          S.Idle,
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
        expect(controller.status).toBe<SerialSessionState>(S.Connecting);

        expect(
          controller.transition(createConnectedRuntime(port, pump)),
        ).toBe(true);
        expect(controller.status).toBe<SerialSessionState>(S.Connected);

        expect(
          controller.transition(createDisconnectingRuntime(port)),
        ).toBe(true);
        expect(controller.status).toBe<SerialSessionState>(S.Disconnecting);

        expect(controller.transition(createIdleRuntime())).toBe(true);
        expect(controller.status).toBe<SerialSessionState>(S.Idle);
      });
    });

    describe('error path', () => {
      it('allows error from connecting, connected and disconnecting', () => {
        const port = createMockPort();
        const pump = createMockPump();

        const fromConnecting = createSessionRuntimeController(createIdleRuntime());
        fromConnecting.transition(createConnectingRuntime(() => undefined));
        expect(fromConnecting.transition(createErrorRuntime())).toBe(true);
        expect(fromConnecting.status).toBe<SerialSessionState>(S.Error);

        const fromConnected = createSessionRuntimeController(createIdleRuntime());
        fromConnected.transition(createConnectingRuntime(() => undefined));
        fromConnected.transition(createConnectedRuntime(port, pump));
        expect(fromConnected.transition(createErrorRuntime())).toBe(true);
        expect(fromConnected.status).toBe<SerialSessionState>(S.Error);

        const fromDisconnecting = createSessionRuntimeController(
          createIdleRuntime(),
        );
        fromDisconnecting.transition(createConnectingRuntime(() => undefined));
        fromDisconnecting.transition(createConnectedRuntime(port, pump));
        fromDisconnecting.transition(createDisconnectingRuntime(port));
        expect(fromDisconnecting.transition(createErrorRuntime())).toBe(true);
        expect(fromDisconnecting.status).toBe<SerialSessionState>(S.Error);
      });

      it('recovers from error back to idle and forward to connecting', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createErrorRuntime());

        expect(controller.transition(createIdleRuntime())).toBe(true);
        expect(controller.status).toBe<SerialSessionState>(S.Idle);

        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createErrorRuntime());
        expect(
          controller.transition(createConnectingRuntime(() => undefined)),
        ).toBe(true);
        expect(controller.status).toBe<SerialSessionState>(S.Connecting);
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
        expect(controller.status).toBe<SerialSessionState>(S.Idle);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });

      it('ignores connected -> idle (must go through disconnecting)', () => {
        const controller = createSessionRuntimeController(createIdleRuntime());
        const port = createMockPort();
        const pump = createMockPump();
        controller.transition(createConnectingRuntime(() => undefined));
        controller.transition(createConnectedRuntime(port, pump));

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(controller.status).toBe<SerialSessionState>(S.Connected);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      });

      it('returns false and does not emit on same-state transition', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        expect(controller.transition(createIdleRuntime())).toBe(false);
        expect(warnSpy).not.toHaveBeenCalled();

        const states = await lastValueFrom(
          controller.state$.pipe(take(1), toArray()),
        );
        expect(states).toEqual<SerialSessionState[]>([S.Idle]);
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
        expect(controller.transition(createErrorRuntime())).toBe(false);
        expect(controller.status).toBe<SerialSessionState>(S.Unsupported);
      });
    });

    describe('disposed (terminal)', () => {
      it('allows transition to disposed from every active state', () => {
        const port = createMockPort();
        const pump = createMockPump();

        const fromIdle = createSessionRuntimeController(createIdleRuntime());
        expect(fromIdle.transition(createDisposedRuntime())).toBe(true);
        expect(fromIdle.status).toBe<SerialSessionState>(S.Disposed);

        const fromConnecting = createSessionRuntimeController(createIdleRuntime());
        fromConnecting.transition(createConnectingRuntime(() => undefined));
        expect(fromConnecting.transition(createDisposedRuntime())).toBe(true);
        expect(fromConnecting.status).toBe<SerialSessionState>(S.Disposed);

        const fromConnected = createSessionRuntimeController(createIdleRuntime());
        fromConnected.transition(createConnectingRuntime(() => undefined));
        fromConnected.transition(createConnectedRuntime(port, pump));
        expect(fromConnected.transition(createDisposedRuntime())).toBe(true);
        expect(fromConnected.status).toBe<SerialSessionState>(S.Disposed);

        const fromDisconnecting = createSessionRuntimeController(
          createIdleRuntime(),
        );
        fromDisconnecting.transition(createConnectingRuntime(() => undefined));
        fromDisconnecting.transition(createConnectedRuntime(port, pump));
        fromDisconnecting.transition(createDisconnectingRuntime(port));
        expect(fromDisconnecting.transition(createDisposedRuntime())).toBe(true);
        expect(fromDisconnecting.status).toBe<SerialSessionState>(S.Disposed);

        const fromError = createSessionRuntimeController(createIdleRuntime());
        fromError.transition(createConnectingRuntime(() => undefined));
        fromError.transition(createErrorRuntime());
        expect(fromError.transition(createDisposedRuntime())).toBe(true);
        expect(fromError.status).toBe<SerialSessionState>(S.Disposed);
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
        expect(controller.transition(createErrorRuntime())).toBe(false);
        expect(controller.status).toBe<SerialSessionState>(S.Disposed);
      });
    });

    describe('complete', () => {
      it('completes the state$ stream', async () => {
        const controller = createSessionRuntimeController(createIdleRuntime());

        const collected = lastValueFrom(controller.state$.pipe(toArray()));

        controller.transition(createConnectingRuntime(() => undefined));
        controller.complete();

        await expect(collected).resolves.toEqual<SerialSessionState[]>([
          S.Idle,
          S.Connecting,
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

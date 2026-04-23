import { firstValueFrom, lastValueFrom, take, toArray } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SerialSessionState } from '../../src/session/serial-session-state';
import { SessionStateMachine } from '../../src/session/session-state-machine';

describe('SessionStateMachine', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('construction', () => {
    it('starts in idle by default', () => {
      const machine = new SessionStateMachine();

      expect(machine.current).toBe<SerialSessionState>('idle');
    });

    it('honours an explicit initial state', () => {
      const machine = new SessionStateMachine('unsupported');

      expect(machine.current).toBe<SerialSessionState>('unsupported');
    });
  });

  describe('state$', () => {
    it('replays the current state on subscribe', async () => {
      const machine = new SessionStateMachine();

      const state = await firstValueFrom(machine.state$);

      expect(state).toBe<SerialSessionState>('idle');
    });

    it('emits every valid transition in order', async () => {
      const machine = new SessionStateMachine();

      const collected = lastValueFrom(
        machine.state$.pipe(take(5), toArray()),
      );

      machine.toConnecting();
      machine.toConnected();
      machine.toDisconnecting();
      machine.toIdle();

      await expect(collected).resolves.toEqual<SerialSessionState[]>([
        'idle',
        'connecting',
        'connected',
        'disconnecting',
        'idle',
      ]);
    });
  });

  describe('happy path transitions', () => {
    it('moves idle -> connecting -> connected -> disconnecting -> idle', () => {
      const machine = new SessionStateMachine();

      expect(machine.toConnecting()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('connecting');

      expect(machine.toConnected()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('connected');

      expect(machine.toDisconnecting()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('disconnecting');

      expect(machine.toIdle()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('idle');
    });
  });

  describe('error path', () => {
    it('allows error from connecting, connected and disconnecting', () => {
      const fromConnecting = new SessionStateMachine();
      fromConnecting.toConnecting();
      expect(fromConnecting.toError()).toBe(true);
      expect(fromConnecting.current).toBe<SerialSessionState>('error');

      const fromConnected = new SessionStateMachine();
      fromConnected.toConnecting();
      fromConnected.toConnected();
      expect(fromConnected.toError()).toBe(true);
      expect(fromConnected.current).toBe<SerialSessionState>('error');

      const fromDisconnecting = new SessionStateMachine();
      fromDisconnecting.toConnecting();
      fromDisconnecting.toConnected();
      fromDisconnecting.toDisconnecting();
      expect(fromDisconnecting.toError()).toBe(true);
      expect(fromDisconnecting.current).toBe<SerialSessionState>('error');
    });

    it('recovers from error back to idle and forward to connecting', () => {
      const machine = new SessionStateMachine();
      machine.toConnecting();
      machine.toError();

      expect(machine.toIdle()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('idle');

      machine.toConnecting();
      machine.toError();
      expect(machine.toConnecting()).toBe(true);
      expect(machine.current).toBe<SerialSessionState>('connecting');
    });
  });

  describe('invalid transitions', () => {
    it('ignores idle -> connected and warns', () => {
      const machine = new SessionStateMachine();

      expect(machine.toConnected()).toBe(false);
      expect(machine.current).toBe<SerialSessionState>('idle');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores connected -> idle (must go through disconnecting)', () => {
      const machine = new SessionStateMachine();
      machine.toConnecting();
      machine.toConnected();

      expect(machine.toIdle()).toBe(false);
      expect(machine.current).toBe<SerialSessionState>('connected');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('returns false and does not emit on same-state transition', async () => {
      const machine = new SessionStateMachine();

      expect(machine.toIdle()).toBe(false);
      expect(warnSpy).not.toHaveBeenCalled();

      const states = await lastValueFrom(
        machine.state$.pipe(take(1), toArray()),
      );
      expect(states).toEqual<SerialSessionState[]>(['idle']);
    });
  });

  describe('unsupported (terminal)', () => {
    it('rejects every transition once entered via construction', () => {
      const machine = new SessionStateMachine('unsupported');

      expect(machine.toIdle()).toBe(false);
      expect(machine.toConnecting()).toBe(false);
      expect(machine.toConnected()).toBe(false);
      expect(machine.toDisconnecting()).toBe(false);
      expect(machine.toError()).toBe(false);
      expect(machine.current).toBe<SerialSessionState>('unsupported');
    });

    it('cannot be entered from idle at runtime', () => {
      const machine = new SessionStateMachine();

      expect(machine.toUnsupported()).toBe(false);
      expect(machine.current).toBe<SerialSessionState>('idle');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('complete', () => {
    it('completes the state$ stream', async () => {
      const machine = new SessionStateMachine();

      const collected = lastValueFrom(machine.state$.pipe(toArray()));

      machine.toConnecting();
      machine.complete();

      await expect(collected).resolves.toEqual<SerialSessionState[]>([
        'idle',
        'connecting',
      ]);
    });
  });
});

import {
  createSerialClientCore,
  type SerialClientCore,
} from '@gurezo/serial-client-core';
import {
  SerialSessionState,
  type SerialError,
} from '@gurezo/web-serial-rxjs';
import { type Observable, Subscription } from 'rxjs';
import { onDestroy } from 'svelte';
import { readable, writable, type Readable } from 'svelte/store';

/** v2 `SerialSession` を Svelte store に薄く写す。表示は `terminalText$`（再接続は世代でリセット）。 */
export interface UseSerialSessionReturn {
  browserSupported: Readable<boolean>;
  state: Readable<SerialSessionState>;
  isConnected: Readable<boolean>;
  receivedData: Readable<string>;
  errorMessage: Readable<string | null>;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
}

export function useSerialSession(
  initialBaudRate = 9600,
): UseSerialSessionReturn {
  const core: SerialClientCore = createSerialClientCore(initialBaudRate);

  const browserSupported = readable(core.isBrowserSupported());

  const state = readable<SerialSessionState>(SerialSessionState.Idle, (set) => {
    const sub = core.state$.subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const isConnected = readable<boolean>(false, (set) => {
    const sub = core.isConnected$.subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const receivedData = writable('');
  const terminalSub = core.terminalText$.subscribe((t) => {
    receivedData.set(t);
  });

  const errorMessage = readable<string | null>(null, (set) => {
    const subs = new Subscription();
    subs.add(
      core.errors$.subscribe((e: SerialError) => set(e.message)),
    );
    subs.add(
      core.state$.subscribe((next) => {
        if (next === SerialSessionState.Connected || next === SerialSessionState.Idle)
          set(null);
      }),
    );
    return () => subs.unsubscribe();
  });

  onDestroy(() => {
    terminalSub.unsubscribe();
    core.dispose$().subscribe({ error: () => void 0 });
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.set('');
    core.clearTerminalText();
    return core.connect$(baudRate);
  };

  const disconnect$ = (): Observable<void> => core.disconnect$();

  const send$ = (data: string | Uint8Array): Observable<void> =>
    core.send$(data);

  const clearReceivedData = (): void => {
    core.clearTerminalText();
    receivedData.set('');
  };

  return {
    browserSupported,
    state,
    isConnected,
    receivedData,
    errorMessage,
    connect$,
    disconnect$,
    send$,
    clearReceivedData,
  };
}

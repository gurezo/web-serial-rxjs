import {
  SerialSessionStatus,
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { createSerialSessionController } from '@gurezo/examples-shared';
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
  const controller = createSerialSessionController({
    initialBaudRate,
  });

  const browserSupported = readable(controller.isBrowserSupported());

  const state = readable<SerialSessionState>(
    { status: SerialSessionStatus.Idle },
    (set) => {
      const sub = controller.state$.subscribe((next) => set(next));
      return () => sub.unsubscribe();
    },
  );

  const isConnected = readable<boolean>(false, (set) => {
    const sub = controller.isConnected$.subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const receivedData = writable('');
  const terminalSub = controller.terminalText$.subscribe((t) => {
    receivedData.set(t);
  });

  const errorMessage = readable<string | null>(null, (set) => {
    const subs = new Subscription();
    subs.add(
      controller.errors$.subscribe((e: SerialError) => set(e.message)),
    );
    subs.add(
      controller.state$.subscribe((next) => {
        if (
          next.status === SerialSessionStatus.Connected ||
          next.status === SerialSessionStatus.Idle
        )
          set(null);
      }),
    );
    return () => subs.unsubscribe();
  });

  onDestroy(() => {
    terminalSub.unsubscribe();
    controller.dispose();
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.set('');
    return controller.connect$(baudRate);
  };

  const disconnect$ = (): Observable<void> => controller.disconnect$();

  const send$ = (data: string | Uint8Array): Observable<void> =>
    controller.send$(data);

  const clearReceivedData = (): void => {
    controller.resetTerminalBuffer();
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

import {
  createSerialSessionController,
  formatExampleSerialErrorDetail,
  getExampleSupportStatus,
} from '@gurezo/examples-shared';
import {
  SerialSessionStatus,
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { type Observable, Subscription } from 'rxjs';
import { onDestroy } from 'svelte';
import { derived, readable, writable, type Readable } from 'svelte/store';

/** v2 `SerialSession` を Svelte store に薄く写す。表示は `terminalText$`（再接続は世代でリセット）。 */
export interface UseSerialSessionReturn {
  browserSupported: Readable<boolean>;
  canConnect: Readable<boolean>;
  state: Readable<SerialSessionState>;
  isConnected: Readable<boolean>;
  receivedData: Readable<string>;
  errorMessage: Readable<string | null>;
  errorType: Readable<'info' | 'error' | null>;
  errorCode: Readable<string | null>;
  errorContext: Readable<string | null>;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
  clearError: () => void;
}

export function useSerialSession(
  initialBaudRate = 9600,
): UseSerialSessionReturn {
  const controller = createSerialSessionController({
    initialBaudRate,
  });

  const supportStatus = getExampleSupportStatus();
  const browserSupported = readable(supportStatus.apiSupported);
  const canConnect = readable(supportStatus.canConnect);

  const state = readable<SerialSessionState>(
    { status: SerialSessionStatus.Idle },
    (set) => {
      const sub = controller.state$.subscribe((next) => set(next));
      return () => sub.unsubscribe();
    },
  );

  const isConnected = derived(
    state,
    ($state) => $state.status === SerialSessionStatus.Connected,
  );

  const receivedData = writable('');
  const terminalSub = controller.terminalText$.subscribe((t) => {
    receivedData.set(t);
  });

  const errorMessage = writable<string | null>(null);
  const errorType = writable<'info' | 'error' | null>(null);
  const errorCode = writable<string | null>(null);
  const errorContext = writable<string | null>(null);

  const clearError = (): void => {
    errorMessage.set(null);
    errorType.set(null);
    errorCode.set(null);
    errorContext.set(null);
  };

  const errorSub = new Subscription();
  errorSub.add(
    controller.errors$.subscribe((e: SerialError) => {
      const display = formatExampleSerialErrorDetail(e);
      errorMessage.set(display.message);
      errorType.set(display.type);
      errorCode.set(display.code);
      errorContext.set(display.contextSummary);
    }),
  );
  errorSub.add(
    controller.state$.subscribe((next) => {
      if (
        next.status === SerialSessionStatus.Connected ||
        next.status === SerialSessionStatus.Idle
      ) {
        clearError();
      }
    }),
  );

  onDestroy(() => {
    terminalSub.unsubscribe();
    errorSub.unsubscribe();
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
    canConnect,
    state,
    isConnected,
    receivedData,
    errorMessage,
    errorType,
    errorCode,
    errorContext,
    connect$,
    disconnect$,
    send$,
    clearReceivedData,
    clearError,
  };
}

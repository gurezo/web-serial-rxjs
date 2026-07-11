import {
  SerialSessionStatus,
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { createSerialSessionController } from '@gurezo/examples-shared';
import { type Observable } from 'rxjs';
import { onUnmounted, ref, type Ref } from 'vue';

/** v2 `SerialSession` を薄くラップ。表示は `terminalText$`（再接続時は世代でリセット）。 */
export interface UseSerialClientReturn {
  browserSupported: Ref<boolean>;
  state: Ref<SerialSessionState>;
  isConnected: Ref<boolean>;
  receivedData: Ref<string>;
  errorMessage: Ref<string | null>;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
}

export function useSerialClient(initialBaudRate = 9600): UseSerialClientReturn {
  const controller = createSerialSessionController({
    initialBaudRate,
  });

  const browserSupported = ref(controller.isBrowserSupported());
  const state = ref<SerialSessionState>({ status: SerialSessionStatus.Idle });
  const isConnected = ref(false);
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);

  const stateSub = controller.state$.subscribe((next) => {
    state.value = next;
    if (
      next.status === SerialSessionStatus.Connected ||
      next.status === SerialSessionStatus.Idle
    ) {
      errorMessage.value = null;
    }
  });
  const isConnectedSub = controller.isConnected$.subscribe((next) => {
    isConnected.value = next;
  });
  const receiveSub = controller.terminalText$.subscribe((text) => {
    receivedData.value = text;
  });
  const errorsSub = controller.errors$.subscribe((error: SerialError) => {
    errorMessage.value = error.message;
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.value = '';
    return controller.connect$(baudRate);
  };
  const disconnect$ = (): Observable<void> => controller.disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    controller.send$(data);
  const clearReceivedData = (): void => {
    controller.resetTerminalBuffer();
    receivedData.value = '';
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    isConnectedSub.unsubscribe();
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    controller.dispose();
  });

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

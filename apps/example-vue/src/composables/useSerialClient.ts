import {
  createSerialClientCore,
  type SerialClientCore,
} from '@gurezo/serial-client-core';
import {
  SerialSessionState,
  type SerialError,
} from '@gurezo/web-serial-rxjs';
import type { Observable } from 'rxjs';
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
  const core: SerialClientCore = createSerialClientCore(initialBaudRate);

  const browserSupported = ref(core.isBrowserSupported());
  const state = ref<SerialSessionState>(SerialSessionState.Idle);
  const isConnected = ref(false);
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);

  const stateSub = core.state$.subscribe((next) => {
    state.value = next;
    if (next === SerialSessionState.Connected || next === SerialSessionState.Idle) {
      errorMessage.value = null;
    }
  });
  const isConnectedSub = core.isConnected$.subscribe((next) => {
    isConnected.value = next;
  });
  const receiveSub = core.terminalText$.subscribe((text) => {
    receivedData.value = text;
  });
  const errorsSub = core.errors$.subscribe((error: SerialError) => {
    errorMessage.value = error.message;
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.value = '';
    core.clearTerminalText();
    return core.connect$(baudRate);
  };
  const disconnect$ = (): Observable<void> => core.disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    core.send$(data);
  const clearReceivedData = (): void => {
    core.clearTerminalText();
    receivedData.value = '';
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    isConnectedSub.unsubscribe();
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    core.dispose$().subscribe({ error: () => void 0 });
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

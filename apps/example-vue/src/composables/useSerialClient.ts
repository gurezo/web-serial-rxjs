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
import { type Observable } from 'rxjs';
import { onUnmounted, ref, type Ref } from 'vue';

/** v2 `SerialSession` を薄くラップ。表示は `terminalText$`（再接続時は世代でリセット）。 */
export interface UseSerialClientReturn {
  browserSupported: Ref<boolean>;
  canConnect: Ref<boolean>;
  state: Ref<SerialSessionState>;
  isConnected: Ref<boolean>;
  receivedData: Ref<string>;
  errorMessage: Ref<string | null>;
  errorType: Ref<'info' | 'error' | null>;
  errorCode: Ref<string | null>;
  errorContext: Ref<string | null>;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
  clearError: () => void;
}

export function useSerialClient(initialBaudRate = 9600): UseSerialClientReturn {
  const controller = createSerialSessionController({
    initialBaudRate,
  });

  const supportStatus = getExampleSupportStatus();
  const browserSupported = ref(supportStatus.apiSupported);
  const canConnect = ref(supportStatus.canConnect);
  const state = ref<SerialSessionState>({ status: SerialSessionStatus.Idle });
  const isConnected = ref(false);
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);
  const errorType = ref<'info' | 'error' | null>(null);
  const errorCode = ref<string | null>(null);
  const errorContext = ref<string | null>(null);

  const clearError = () => {
    errorMessage.value = null;
    errorType.value = null;
    errorCode.value = null;
    errorContext.value = null;
  };

  const stateSub = controller.state$.subscribe((next) => {
    state.value = next;
    isConnected.value = next.status === SerialSessionStatus.Connected;
    if (
      next.status === SerialSessionStatus.Connected ||
      next.status === SerialSessionStatus.Idle
    ) {
      clearError();
    }
  });
  const receiveSub = controller.terminalText$.subscribe((text) => {
    receivedData.value = text;
  });
  const errorsSub = controller.errors$.subscribe((error: SerialError) => {
    const display = formatExampleSerialErrorDetail(error);
    errorMessage.value = display.message;
    errorType.value = display.type;
    errorCode.value = display.code;
    errorContext.value = display.contextSummary;
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
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    controller.dispose();
  });

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

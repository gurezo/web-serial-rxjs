import {
  createSerialSession,
  createTerminalBuffer,
  SerialSessionState,
  type SerialError,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  ReplaySubject,
  switchMap,
} from 'rxjs';
import { onUnmounted, ref, type Ref } from 'vue';

/** v2 `SerialSession` を薄くラップ。表示は `createTerminalBuffer(receive$).text$`（再接続は世代でリセット）。 */
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
  const sessions$ = new ReplaySubject<SerialSession>(1);
  let currentSession: SerialSession = createSerialSession({
    baudRate: initialBaudRate,
  });
  let currentBaudRate = initialBaudRate;
  sessions$.next(currentSession);

  const terminalBufferEpoch$ = new BehaviorSubject(0);
  const bumpTerminalBufferEpoch = (): void => {
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
  };

  const browserSupported = ref(currentSession.isBrowserSupported());
  const state = ref<SerialSessionState>(SerialSessionState.Idle);
  const isConnected = ref(false);
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);

  const stateSub = sessions$
    .pipe(switchMap((session) => session.state$))
    .subscribe((next) => {
      state.value = next;
      if (next === SerialSessionState.Connected || next === SerialSessionState.Idle) {
        errorMessage.value = null;
      }
    });
  const isConnectedSub = sessions$
    .pipe(switchMap((session) => session.isConnected$))
    .subscribe((next) => {
      isConnected.value = next;
    });
  const receiveSub = combineLatest([sessions$, terminalBufferEpoch$])
    .pipe(switchMap(([s]) => createTerminalBuffer(s.receive$).text$))
    .subscribe((text) => {
      receivedData.value = text;
    });
  const errorsSub = sessions$
    .pipe(switchMap((session) => session.errors$))
    .subscribe((error: SerialError) => {
      errorMessage.value = error.message;
    });

  const connect$ = (baudRate?: number): Observable<void> => {
    bumpTerminalBufferEpoch();
    receivedData.value = '';
    if (baudRate !== undefined && baudRate !== currentBaudRate) {
      currentBaudRate = baudRate;
      currentSession = createSerialSession({ baudRate });
      sessions$.next(currentSession);
    }
    return currentSession.connect$();
  };
  const disconnect$ = (): Observable<void> => currentSession.disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    currentSession.send$(data);
  const clearReceivedData = (): void => {
    bumpTerminalBufferEpoch();
    receivedData.value = '';
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    isConnectedSub.unsubscribe();
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    currentSession.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
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

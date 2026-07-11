import {
  createSerialSession,
  SerialSessionState,
  type SerialError,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  combineLatest,
  type Observable,
  ReplaySubject,
  shareReplay,
  switchMap,
} from 'rxjs';
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
  const sessions$ = new ReplaySubject<SerialSession>(1);
  const terminalBufferEpoch$ = new BehaviorSubject(0);
  let currentBaudRate = initialBaudRate;
  let currentSession = createSerialSession({ baudRate: initialBaudRate });
  sessions$.next(currentSession);

  const browserSupported = ref(currentSession.isBrowserSupported());
  const state = ref<SerialSessionState>(SerialSessionState.Idle);
  const isConnected = ref(false);
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);

  const stateSub = sessions$
    .pipe(
      switchMap((session) => session.state$),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
    .subscribe((next) => {
    state.value = next;
    if (next === SerialSessionState.Connected || next === SerialSessionState.Idle) {
      errorMessage.value = null;
    }
  });
  const isConnectedSub = sessions$
    .pipe(
      switchMap((session) => session.isConnected$),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
    .subscribe((next) => {
      isConnected.value = next;
    });
  const receiveSub = combineLatest([sessions$, terminalBufferEpoch$])
    .pipe(
      switchMap(([session]) => session.terminalText$),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
    .subscribe((text) => {
      receivedData.value = text;
    });
  const errorsSub = sessions$
    .pipe(
      switchMap((session) => session.errors$),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
    .subscribe((error: SerialError) => {
      errorMessage.value = error.message;
    });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.value = '';
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
    if (baudRate !== undefined && baudRate !== currentBaudRate) {
      const previousSession = currentSession;
      currentBaudRate = baudRate;
      currentSession = createSerialSession({ baudRate });
      sessions$.next(currentSession);
      return previousSession
        .dispose$()
        .pipe(switchMap(() => currentSession.connect$()));
    }
    return currentSession.connect$();
  };
  const disconnect$ = (): Observable<void> => currentSession.disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    currentSession.send$(data);
  const clearReceivedData = (): void => {
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
    receivedData.value = '';
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    isConnectedSub.unsubscribe();
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    currentSession.dispose$().subscribe({ error: () => void 0 });
    sessions$.complete();
    terminalBufferEpoch$.complete();
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

import {
  createSerialSession,
  type SerialError,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap } from 'rxjs';
import { onUnmounted, ref, type Ref } from 'vue';

/**
 * v2 `SerialSession` を薄くラップした Vue Composable。
 *
 * `state$` / `receive$` / `errors$` をそのままリアクティブな `Ref` に反映し、
 * BehaviorSubject 的な接続状態再合成、`text$` の手動購読、read loop 管理は
 * 一切持たない。
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/199
 * @see https://github.com/gurezo/web-serial-rxjs/issues/206
 */
export interface UseSerialClientReturn {
  browserSupported: Ref<boolean>;
  state: Ref<SerialSessionState>;
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

  const browserSupported = ref(currentSession.isBrowserSupported());
  const state = ref<SerialSessionState>('idle');
  const receivedData = ref('');
  const errorMessage = ref<string | null>(null);

  const stateSub = sessions$
    .pipe(switchMap((session) => session.state$))
    .subscribe((next) => {
      state.value = next;
      if (next === 'connected' || next === 'idle') {
        errorMessage.value = null;
      }
    });
  const receiveSub = sessions$
    .pipe(switchMap((session) => session.receive$))
    .subscribe((chunk) => {
      receivedData.value = receivedData.value + chunk;
    });
  const errorsSub = sessions$
    .pipe(switchMap((session) => session.errors$))
    .subscribe((error: SerialError) => {
      errorMessage.value = error.message;
    });

  const connect$ = (baudRate?: number): Observable<void> => {
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
    receivedData.value = '';
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    receiveSub.unsubscribe();
    errorsSub.unsubscribe();
    currentSession.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
  });

  return {
    browserSupported,
    state,
    receivedData,
    errorMessage,
    connect$,
    disconnect$,
    send$,
    clearReceivedData,
  };
}

import {
  createSerialSession,
  SerialSessionState,
  type SerialError,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import {
  Observable,
  ReplaySubject,
  switchMap,
  filter,
  map,
  scan,
} from 'rxjs';
import { onUnmounted, ref, type Ref } from 'vue';

/** v2 `SerialSession` を薄くラップ。受信は `receive$` から行単位に派生。 */
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
  const state = ref<SerialSessionState>(SerialSessionState.Idle);
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
  const receiveSub = sessions$
    .pipe(
      switchMap((session) =>
        session.receive$.pipe(
          scan(
            (acc, chunk: string) => {
              const combined = acc.buffer + chunk;
              const parts = combined.split('\n');
              return { buffer: parts.pop() ?? '', lines: parts };
            },
            { buffer: '', lines: [] as string[] },
          ),
          filter((x) => x.lines.length > 0),
          map((x) => x.lines),
        ),
      ),
    )
    .subscribe((lines) => {
      receivedData.value =
        receivedData.value + lines.map((l) => `${l}\n`).join('');
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
      receivedData.value = '';
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

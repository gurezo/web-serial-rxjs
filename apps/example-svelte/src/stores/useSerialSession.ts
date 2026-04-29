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
  Subscription,
  switchMap,
} from 'rxjs';
import { onDestroy } from 'svelte';
import { readable, type Readable } from 'svelte/store';

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
  let currentBaudRate = initialBaudRate;
  let currentSession: SerialSession = createSerialSession({
    baudRate: initialBaudRate,
  });
  const sessions$ = new ReplaySubject<SerialSession>(1);
  const terminalBufferEpoch$ = new BehaviorSubject(0);
  sessions$.next(currentSession);

  const browserSupported = readable(currentSession.isBrowserSupported());

  const state = readable<SerialSessionState>(SerialSessionState.Idle, (set) => {
    const sub = sessions$
      .pipe(switchMap((s) => s.state$))
      .subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const isConnected = readable<boolean>(false, (set) => {
    const sub = sessions$
      .pipe(switchMap((s) => s.isConnected$))
      .subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const bumpTerminalBufferEpoch = (): void => {
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
  };

  let setReceived: ((value: string) => void) | null = null;
  const receivedData = readable<string>('', (set) => {
    setReceived = set;
    const sub = combineLatest([sessions$, terminalBufferEpoch$])
      .pipe(switchMap(([s]) => s.terminalText$))
      .subscribe(set);
    return () => {
      sub.unsubscribe();
      setReceived = null;
    };
  });

  const errorMessage = readable<string | null>(null, (set) => {
    const subs = new Subscription();
    subs.add(
      sessions$
        .pipe(switchMap((s) => s.errors$))
        .subscribe((e: SerialError) => set(e.message)),
    );
    subs.add(
      sessions$
        .pipe(switchMap((s) => s.state$))
        .subscribe((next) => {
          if (next === SerialSessionState.Connected || next === SerialSessionState.Idle)
            set(null);
        }),
    );
    return () => subs.unsubscribe();
  });

  onDestroy(() => {
    currentSession.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    bumpTerminalBufferEpoch();
    setReceived?.('');
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
    setReceived?.('');
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

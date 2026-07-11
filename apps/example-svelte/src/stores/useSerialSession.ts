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
  Subscription,
  switchMap,
} from 'rxjs';
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
  const sessions$ = new ReplaySubject<SerialSession>(1);
  const terminalBufferEpoch$ = new BehaviorSubject(0);
  let currentBaudRate = initialBaudRate;
  let currentSession = createSerialSession({ baudRate: initialBaudRate });
  sessions$.next(currentSession);

  const browserSupported = readable(currentSession.isBrowserSupported());

  const state = readable<SerialSessionState>(SerialSessionState.Idle, (set) => {
    const sub = sessions$
      .pipe(
        switchMap((session) => session.state$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const isConnected = readable<boolean>(false, (set) => {
    const sub = sessions$
      .pipe(
        switchMap((session) => session.isConnected$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  const receivedData = writable('');
  const terminalSub = combineLatest([sessions$, terminalBufferEpoch$])
    .pipe(
      switchMap(([session]) => session.terminalText$),
      shareReplay({ bufferSize: 1, refCount: true }),
    )
    .subscribe((t) => {
    receivedData.set(t);
  });

  const errorMessage = readable<string | null>(null, (set) => {
    const subs = new Subscription();
    subs.add(
      sessions$
        .pipe(
          switchMap((session) => session.errors$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe((e: SerialError) => set(e.message)),
    );
    subs.add(
      sessions$
        .pipe(
          switchMap((session) => session.state$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe((next) => {
          if (
            next === SerialSessionState.Connected ||
            next === SerialSessionState.Idle
          )
            set(null);
        }),
    );
    return () => subs.unsubscribe();
  });

  onDestroy(() => {
    terminalSub.unsubscribe();
    currentSession.dispose$().subscribe({ error: () => void 0 });
    sessions$.complete();
    terminalBufferEpoch$.complete();
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    receivedData.set('');
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

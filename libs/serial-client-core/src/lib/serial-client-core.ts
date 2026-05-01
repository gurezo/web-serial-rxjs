import {
  createSerialSession,
  type SerialError,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  combineLatest,
  type Observable,
  ReplaySubject,
  shareReplay,
  switchMap,
} from 'rxjs';

export interface SerialClientCore {
  readonly state$: Observable<SerialSessionState>;
  readonly isConnected$: Observable<boolean>;
  readonly receive$: Observable<string>;
  readonly terminalText$: Observable<string>;
  readonly errors$: Observable<SerialError>;
  isBrowserSupported(): boolean;
  connect$(baudRate?: number): Observable<void>;
  disconnect$(): Observable<void>;
  send$(data: string | Uint8Array): Observable<void>;
  clearTerminalText(): void;
  dispose$(): Observable<void>;
}

export function createSerialClientCore(initialBaudRate = 9600): SerialClientCore {
  const sessions$ = new ReplaySubject<SerialSession>(1);
  const terminalBufferEpoch$ = new BehaviorSubject(0);

  let currentBaudRate = initialBaudRate;
  let currentSession = createSerialSession({ baudRate: initialBaudRate });
  sessions$.next(currentSession);

  const state$ = sessions$.pipe(
    switchMap((session) => session.state$),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const isConnected$ = sessions$.pipe(
    switchMap((session) => session.isConnected$),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const receive$ = sessions$.pipe(
    switchMap((session) => session.receive$),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const terminalText$ = combineLatest([sessions$, terminalBufferEpoch$]).pipe(
    switchMap(([session]) => session.terminalText$),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
  const errors$ = sessions$.pipe(
    switchMap((session) => session.errors$),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  const bumpTerminalBufferEpoch = (): void => {
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
  };

  const connect$ = (baudRate?: number): Observable<void> => {
    bumpTerminalBufferEpoch();
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
  const clearTerminalText = (): void => {
    bumpTerminalBufferEpoch();
  };
  const dispose$ = (): Observable<void> => {
    const disconnected$ = currentSession.disconnect$();
    sessions$.complete();
    terminalBufferEpoch$.complete();
    return disconnected$;
  };

  return {
    state$,
    isConnected$,
    receive$,
    terminalText$,
    errors$,
    isBrowserSupported: () => currentSession.isBrowserSupported(),
    connect$,
    disconnect$,
    send$,
    clearTerminalText,
    dispose$,
  };
}

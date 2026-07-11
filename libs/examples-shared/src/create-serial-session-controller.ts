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

export interface SerialSessionControllerOptions {
  initialBaudRate?: number;
}

export interface SerialSessionController {
  readonly state$: Observable<SerialSessionState>;
  readonly isConnected$: Observable<boolean>;
  readonly terminalText$: Observable<string>;
  readonly errors$: Observable<SerialError>;
  readonly receive$: Observable<string>;
  isBrowserSupported(): boolean;
  connect$(baudRate?: number): Observable<void>;
  disconnect$(): Observable<void>;
  send$(data: string | Uint8Array): Observable<void>;
  resetTerminalBuffer(): void;
  dispose(): void;
}

export function createSerialSessionController(
  options: SerialSessionControllerOptions = {},
): SerialSessionController {
  const initialBaudRate = options.initialBaudRate ?? 9600;
  const sessions$ = new ReplaySubject<SerialSession>(1);
  const terminalBufferEpoch$ = new BehaviorSubject(0);

  let currentBaudRate = initialBaudRate;
  let currentSession: SerialSession = createSerialSession({
    baudRate: currentBaudRate,
  });
  let disposed = false;

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

  const resetTerminalBuffer = (): void => {
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
  };

  const connect$ = (baudRate?: number): Observable<void> => {
    resetTerminalBuffer();
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

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    currentSession.dispose$().subscribe({ error: () => void 0 });
    sessions$.complete();
    terminalBufferEpoch$.complete();
  };

  return {
    state$,
    isConnected$,
    terminalText$,
    errors$,
    receive$,
    isBrowserSupported: () => currentSession.isBrowserSupported(),
    connect$,
    disconnect$,
    send$,
    resetTerminalBuffer,
    dispose,
  };
}

import {
  createSerialSession,
  type SerialSession,
  SerialSessionState,
  type SerialError,
} from '@gurezo/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  ReplaySubject,
  shareReplay,
  Subscription,
  switchMap,
} from 'rxjs';

/** v2 `SerialSession` を薄くラップ。表示は `terminalText$`（再接続時は世代でリセット）。 */
export interface UseSerialSessionReturn {
  browserSupported: boolean;
  state: SerialSessionState;
  isConnected: boolean;
  receivedData: string;
  errorMessage: string | null;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
}

export function useSerialSession(
  initialBaudRate = 9600,
): UseSerialSessionReturn {
  const sessionsRef = useRef<ReplaySubject<SerialSession> | null>(null);
  const terminalBufferEpochRef = useRef<BehaviorSubject<number> | null>(null);
  const currentBaudRateRef = useRef(initialBaudRate);
  const sessionRef = useRef<SerialSession | null>(null);

  // StrictMode の二重マウントでクリーンアップが ref を null に戻した後でも、
  // useEffect の再 setup から呼び出されたときに subject / session を作り直す。
  const ensureRefs = (baudRate: number) => {
    if (sessionsRef.current === null) {
      sessionsRef.current = new ReplaySubject<SerialSession>(1);
    }
    if (terminalBufferEpochRef.current === null) {
      terminalBufferEpochRef.current = new BehaviorSubject(0);
    }
    if (sessionRef.current === null) {
      sessionRef.current = createSerialSession({ baudRate });
      sessionsRef.current.next(sessionRef.current);
    }
  };

  ensureRefs(initialBaudRate);

  const [browserSupported] = useState(() =>
    (sessionRef.current as SerialSession).isBrowserSupported(),
  );
  const [state, setState] = useState<SerialSessionState>(SerialSessionState.Idle);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureRefs(currentBaudRateRef.current);
    const sessions$ = sessionsRef.current as ReplaySubject<SerialSession>;
    const terminalBufferEpoch$ = terminalBufferEpochRef.current as BehaviorSubject<number>;
    const sub = new Subscription();
    sub.add(
      sessions$
        .pipe(
          switchMap((session) => session.state$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe((next) => {
        setState(next);
        if (
          next === SerialSessionState.Connected ||
          next === SerialSessionState.Idle
        )
          setErrorMessage(null);
      }),
    );
    sub.add(
      sessions$
        .pipe(
          switchMap((session) => session.isConnected$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe((next) => setIsConnected(next)),
    );
    sub.add(
      combineLatest([sessions$, terminalBufferEpoch$])
        .pipe(
          switchMap(([session]) => session.terminalText$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe(setReceivedData),
    );
    sub.add(
      sessions$
        .pipe(
          switchMap((session) => session.errors$),
          shareReplay({ bufferSize: 1, refCount: true }),
        )
        .subscribe((e: SerialError) => setErrorMessage(e.message)),
    );
    return () => {
      sub.unsubscribe();
      if (sessionRef.current !== null) {
        sessionRef.current.disconnect$().subscribe({
          error: () => void 0,
        });
      }
      sessions$.complete();
      terminalBufferEpoch$.complete();
      sessionRef.current = null;
      sessionsRef.current = null;
      terminalBufferEpochRef.current = null;
    };
  }, []);

  const connect$ = (baudRate?: number): Observable<void> => {
    setReceivedData('');
    const terminalBufferEpoch$ = terminalBufferEpochRef.current as BehaviorSubject<number>;
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
    if (
      baudRate !== undefined &&
      baudRate !== currentBaudRateRef.current
    ) {
      currentBaudRateRef.current = baudRate;
      sessionRef.current = createSerialSession({ baudRate });
      (sessionsRef.current as ReplaySubject<SerialSession>).next(
        sessionRef.current,
      );
    }
    return (sessionRef.current as SerialSession).connect$();
  };
  const disconnect$ = (): Observable<void> =>
    (sessionRef.current as SerialSession).disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    (sessionRef.current as SerialSession).send$(data);
  const clearReceivedData = (): void => {
    const terminalBufferEpoch$ = terminalBufferEpochRef.current as BehaviorSubject<number>;
    terminalBufferEpoch$.next(terminalBufferEpoch$.value + 1);
    setReceivedData('');
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

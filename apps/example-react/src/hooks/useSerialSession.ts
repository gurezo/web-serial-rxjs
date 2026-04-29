import {
  createSerialSession,
  SerialSessionState,
  type SerialError,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';
import { BehaviorSubject, combineLatest, Observable, ReplaySubject, Subscription, switchMap } from 'rxjs';

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
  const sessionRef = useRef<SerialSession | null>(null);
  const terminalBufferEpoch$ = useRef(new BehaviorSubject(0));
  const baudRateRef = useRef<number>(initialBaudRate);
  if (sessionsRef.current === null) {
    sessionRef.current = createSerialSession({ baudRate: initialBaudRate });
    sessionsRef.current = new ReplaySubject<SerialSession>(1);
    sessionsRef.current.next(sessionRef.current);
  }

  const [browserSupported] = useState(() =>
    (sessionRef.current as SerialSession).isBrowserSupported(),
  );
  const [state, setState] = useState<SerialSessionState>(SerialSessionState.Idle);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const sessions$ = sessionsRef.current as ReplaySubject<SerialSession>;
    const sub = new Subscription();
    sub.add(
      sessions$.pipe(switchMap((s) => s.state$)).subscribe((next) => {
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
        .pipe(switchMap((s) => s.isConnected$))
        .subscribe((next) => setIsConnected(next)),
    );
    sub.add(
      combineLatest([
        sessions$,
        terminalBufferEpoch$.current,
      ])
        .pipe(switchMap(([s]) => s.terminalText$))
        .subscribe(setReceivedData),
    );
    sub.add(
      sessions$
        .pipe(switchMap((s) => s.errors$))
        .subscribe((e: SerialError) => setErrorMessage(e.message)),
    );
    return () => {
      sub.unsubscribe();
      sessionRef.current?.disconnect$().subscribe({ error: () => void 0 });
      sessions$.complete();
      sessionsRef.current = null;
      sessionRef.current = null;
    };
  }, []);

  const bumpTerminalBufferEpoch = (): void => {
    const b = terminalBufferEpoch$.current;
    b.next(b.value + 1);
  };

  const connect$ = (baudRate?: number): Observable<void> => {
    setReceivedData('');
    bumpTerminalBufferEpoch();
    if (baudRate !== undefined && baudRate !== baudRateRef.current) {
      baudRateRef.current = baudRate;
      const next = createSerialSession({ baudRate });
      sessionRef.current = next;
      sessionsRef.current?.next(next);
    }
    return (sessionRef.current as SerialSession).connect$();
  };
  const disconnect$ = (): Observable<void> =>
    (sessionRef.current as SerialSession).disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    (sessionRef.current as SerialSession).send$(data);
  const clearReceivedData = (): void => {
    bumpTerminalBufferEpoch();
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

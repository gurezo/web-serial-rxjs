import {
  createSerialSession,
  SerialSessionState,
  type SerialError,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';
import { Observable, ReplaySubject, Subscription, switchMap } from 'rxjs';

/** v2 `SerialSession` を薄くラップ。ターミナル表示向けに生受信 `receive$` を連結。 */
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
      sessions$
        .pipe(switchMap((s) => s.receive$))
        .subscribe((chunk) =>
          setReceivedData((prev) => prev + chunk),
        ),
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

  const connect$ = (baudRate?: number): Observable<void> => {
    if (baudRate !== undefined && baudRate !== baudRateRef.current) {
      baudRateRef.current = baudRate;
      const next = createSerialSession({ baudRate });
      sessionRef.current = next;
      sessionsRef.current?.next(next);
      setReceivedData('');
    }
    return (sessionRef.current as SerialSession).connect$();
  };
  const disconnect$ = (): Observable<void> =>
    (sessionRef.current as SerialSession).disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    (sessionRef.current as SerialSession).send$(data);
  const clearReceivedData = (): void => setReceivedData('');

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

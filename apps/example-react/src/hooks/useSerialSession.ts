import {
  createSerialSession,
  type SerialError,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';
import { Observable, ReplaySubject, Subscription, switchMap } from 'rxjs';

/**
 * useSerialSession フックの戻り値の型。
 *
 * v2 `SerialSession` を薄くラップし、`state$` / `receive$` / `errors$` を
 * React の state にそのまま反映する。BehaviorSubject 的な接続状態再合成、
 * `text$` の手動購読、read loop 管理は一切持たない。
 */
export interface UseSerialSessionReturn {
  browserSupported: boolean;
  state: SerialSessionState;
  receivedData: string;
  errorMessage: string | null;
  connect$: (baudRate?: number) => Observable<void>;
  disconnect$: () => Observable<void>;
  send$: (data: string | Uint8Array) => Observable<void>;
  clearReceivedData: () => void;
}

/**
 * v2 `SerialSession` を React コンポーネントから利用するためのカスタムフック。
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/199
 * @see https://github.com/gurezo/web-serial-rxjs/issues/208
 */
export function useSerialSession(
  initialBaudRate = 9600,
): UseSerialSessionReturn {
  const sessionsRef = useRef<ReplaySubject<SerialSession> | null>(null);
  const currentSessionRef = useRef<SerialSession | null>(null);
  const currentBaudRateRef = useRef<number>(initialBaudRate);

  if (sessionsRef.current === null) {
    const session = createSerialSession({ baudRate: initialBaudRate });
    const sessions$ = new ReplaySubject<SerialSession>(1);
    sessions$.next(session);
    sessionsRef.current = sessions$;
    currentSessionRef.current = session;
  }

  const [browserSupported] = useState<boolean>(() =>
    currentSessionRef.current!.isBrowserSupported(),
  );
  const [state, setState] = useState<SerialSessionState>('idle');
  const [receivedData, setReceivedData] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const sessions$ = sessionsRef.current!;
    const subscription = new Subscription();

    subscription.add(
      sessions$
        .pipe(switchMap((session) => session.state$))
        .subscribe((next) => {
          setState(next);
          if (next === 'connected' || next === 'idle') {
            setErrorMessage(null);
          }
        }),
    );
    subscription.add(
      sessions$
        .pipe(switchMap((session) => session.receive$))
        .subscribe((chunk) => {
          setReceivedData((prev) => prev + chunk);
        }),
    );
    subscription.add(
      sessions$
        .pipe(switchMap((session) => session.errors$))
        .subscribe((error: SerialError) => {
          setErrorMessage(error.message);
        }),
    );

    return () => {
      subscription.unsubscribe();
      const session = currentSessionRef.current;
      if (session) {
        session.disconnect$().subscribe({ error: () => void 0 });
      }
      sessions$.complete();
      sessionsRef.current = null;
      currentSessionRef.current = null;
    };
  }, []);

  const connect$ = (baudRate?: number): Observable<void> => {
    if (baudRate !== undefined && baudRate !== currentBaudRateRef.current) {
      currentBaudRateRef.current = baudRate;
      const next = createSerialSession({ baudRate });
      currentSessionRef.current = next;
      sessionsRef.current?.next(next);
    }
    return currentSessionRef.current!.connect$();
  };

  const disconnect$ = (): Observable<void> =>
    currentSessionRef.current!.disconnect$();

  const send$ = (data: string | Uint8Array): Observable<void> =>
    currentSessionRef.current!.send$(data);

  const clearReceivedData = (): void => {
    setReceivedData('');
  };

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

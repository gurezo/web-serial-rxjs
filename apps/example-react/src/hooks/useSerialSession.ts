import {
  SerialSessionState,
  type SerialError,
} from '@gurezo/web-serial-rxjs';
import {
  createSerialClientCore,
  type SerialClientCore,
} from '@gurezo/serial-client-core';
import { useEffect, useRef, useState } from 'react';
import { Observable, Subscription } from 'rxjs';

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
  const coreRef = useRef<SerialClientCore | null>(null);
  if (coreRef.current === null) {
    coreRef.current = createSerialClientCore(initialBaudRate);
  }

  const [browserSupported] = useState(() =>
    (coreRef.current as SerialClientCore).isBrowserSupported(),
  );
  const [state, setState] = useState<SerialSessionState>(SerialSessionState.Idle);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const core = coreRef.current as SerialClientCore;
    const sub = new Subscription();
    sub.add(
      core.state$.subscribe((next) => {
        setState(next);
        if (
          next === SerialSessionState.Connected ||
          next === SerialSessionState.Idle
        )
          setErrorMessage(null);
      }),
    );
    sub.add(
      core.isConnected$.subscribe((next) => setIsConnected(next)),
    );
    sub.add(core.terminalText$.subscribe(setReceivedData));
    sub.add(
      core.errors$.subscribe((e: SerialError) => setErrorMessage(e.message)),
    );
    return () => {
      sub.unsubscribe();
      core.dispose$().subscribe({ error: () => void 0 });
      coreRef.current = null;
    };
  }, []);

  const connect$ = (baudRate?: number): Observable<void> => {
    setReceivedData('');
    (coreRef.current as SerialClientCore).clearTerminalText();
    return (coreRef.current as SerialClientCore).connect$(baudRate);
  };
  const disconnect$ = (): Observable<void> =>
    (coreRef.current as SerialClientCore).disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    (coreRef.current as SerialClientCore).send$(data);
  const clearReceivedData = (): void => {
    (coreRef.current as SerialClientCore).clearTerminalText();
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

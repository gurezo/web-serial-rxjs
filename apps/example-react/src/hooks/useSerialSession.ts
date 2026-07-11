import {
  SerialSessionStatus,
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import {
  createSerialSessionController,
  type SerialSessionController,
} from '@gurezo/examples-shared';
import { useEffect, useRef, useState } from 'react';
import { type Observable, Subscription } from 'rxjs';

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
  const controllerRef = useRef<SerialSessionController | null>(null);

  // StrictMode の二重マウントでクリーンアップが ref を null に戻した後でも、
  // useEffect の再 setup から呼び出されたときに controller を作り直す。
  const ensureController = (baudRate: number) => {
    if (controllerRef.current === null) {
      controllerRef.current = createSerialSessionController({
        initialBaudRate: baudRate,
      });
    }
  };

  ensureController(initialBaudRate);

  const [browserSupported] = useState(() =>
    (controllerRef.current as SerialSessionController).isBrowserSupported(),
  );
  const [state, setState] = useState<SerialSessionState>({
    status: SerialSessionStatus.Idle,
  });
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    ensureController(initialBaudRate);
    const controller = controllerRef.current as SerialSessionController;
    const sub = new Subscription();
    sub.add(
      controller.state$.subscribe((next) => {
        setState(next);
        if (
          next.status === SerialSessionStatus.Connected ||
          next.status === SerialSessionStatus.Idle
        )
          setErrorMessage(null);
      }),
    );
    sub.add(controller.isConnected$.subscribe(setIsConnected));
    sub.add(controller.terminalText$.subscribe(setReceivedData));
    sub.add(
      controller.errors$.subscribe((e: SerialError) => setErrorMessage(e.message)),
    );
    return () => {
      sub.unsubscribe();
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  const connect$ = (baudRate?: number): Observable<void> => {
    setReceivedData('');
    return (controllerRef.current as SerialSessionController).connect$(baudRate);
  };
  const disconnect$ = (): Observable<void> =>
    (controllerRef.current as SerialSessionController).disconnect$();
  const send$ = (data: string | Uint8Array): Observable<void> =>
    (controllerRef.current as SerialSessionController).send$(data);
  const clearReceivedData = (): void => {
    (controllerRef.current as SerialSessionController).resetTerminalBuffer();
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

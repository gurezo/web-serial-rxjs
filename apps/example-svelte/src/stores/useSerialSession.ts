import {
  createSerialSession,
  type SerialError,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { type Observable, ReplaySubject, Subscription, switchMap } from 'rxjs';
import { onDestroy } from 'svelte';
import { readable, type Readable } from 'svelte/store';

/**
 * v2 `SerialSession` を Svelte store に薄く写すだけのヘルパー。
 * `state$` / `receive$` / `errors$` をそのまま `readable` にラップし、
 * BehaviorSubject 的な接続状態再合成や read loop 管理は持たない。
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/199
 * @see https://github.com/gurezo/web-serial-rxjs/issues/209
 */
export interface UseSerialSessionReturn {
  browserSupported: Readable<boolean>;
  state: Readable<SerialSessionState>;
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
  sessions$.next(currentSession);

  const browserSupported = readable(currentSession.isBrowserSupported());

  const state = readable<SerialSessionState>('idle', (set) => {
    const sub = sessions$
      .pipe(switchMap((s) => s.state$))
      .subscribe((next) => set(next));
    return () => sub.unsubscribe();
  });

  let receivedAcc = '';
  let setReceived: ((value: string) => void) | null = null;
  const receivedData = readable<string>('', (set) => {
    setReceived = set;
    const sub = sessions$
      .pipe(switchMap((s) => s.receive$))
      .subscribe((chunk) => {
        receivedAcc += chunk;
        set(receivedAcc);
      });
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
          if (next === 'connected' || next === 'idle') set(null);
        }),
    );
    return () => subs.unsubscribe();
  });

  onDestroy(() => {
    currentSession.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
  });

  const connect$ = (baudRate?: number): Observable<void> => {
    if (baudRate !== undefined && baudRate !== currentBaudRate) {
      currentBaudRate = baudRate;
      currentSession = createSerialSession({ baudRate });
      receivedAcc = '';
      setReceived?.('');
      sessions$.next(currentSession);
    }
    return currentSession.connect$();
  };

  const disconnect$ = (): Observable<void> => currentSession.disconnect$();

  const send$ = (data: string | Uint8Array): Observable<void> =>
    currentSession.send$(data);

  const clearReceivedData = (): void => {
    receivedAcc = '';
    setReceived?.('');
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

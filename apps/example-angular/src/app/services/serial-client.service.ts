import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap } from 'rxjs';

/** v2 SerialSession を薄くラップ。受信は組み込み `lines$`。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  private currentSession: SerialSession;
  private currentBaudRate: number;

  readonly state$: Observable<SerialSessionState>;
  /** 組み込みの行区切りストリーム（1 行ごとに 1 件）。 */
  readonly lines$: Observable<string>;
  readonly isConnected$: Observable<boolean>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.currentBaudRate = 9600;
    this.currentSession = createSerialSession({
      baudRate: this.currentBaudRate,
    });
    this.sessions$.next(this.currentSession);

    this.state$ = this.sessions$.pipe(switchMap((session) => session.state$));
    this.lines$ = this.sessions$.pipe(switchMap((session) => session.lines$));
    this.isConnected$ = this.sessions$.pipe(
      switchMap((session) => session.isConnected$),
    );
    this.errors$ = this.sessions$.pipe(switchMap((session) => session.errors$));
  }

  ngOnDestroy(): void {
    this.currentSession.disconnect$().subscribe({ error: () => void 0 });
    this.sessions$.complete();
  }

  isBrowserSupported(): boolean {
    return this.currentSession.isBrowserSupported();
  }

  connect$(baudRate?: number): Observable<void> {
    if (baudRate !== undefined && baudRate !== this.currentBaudRate) {
      this.currentBaudRate = baudRate;
      this.currentSession = createSerialSession({ baudRate });
      this.sessions$.next(this.currentSession);
    }
    return this.currentSession.connect$();
  }

  disconnect$(): Observable<void> {
    return this.currentSession.disconnect$();
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.currentSession.send$(data);
  }
}

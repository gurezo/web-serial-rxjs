import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap } from 'rxjs';

/**
 * v2 SerialSession を薄くラップした Angular Service。
 *
 * 状態 (`state$`)・受信 (`receive$`)・エラー (`errors$`) はライブラリ側の
 * ストリームをそのまま公開する。旧実装にあった `BehaviorSubject` ベースの
 * 接続状態再合成・`text$` 手動購読・read loop 管理は一切持たない。
 *
 * @see https://github.com/gurezo/web-serial-rxjs/issues/199
 * @see https://github.com/gurezo/web-serial-rxjs/issues/205
 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  private currentSession: SerialSession;
  private currentBaudRate: number;

  readonly state$: Observable<SerialSessionState>;
  readonly receive$: Observable<string>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.currentBaudRate = 9600;
    this.currentSession = createSerialSession({
      baudRate: this.currentBaudRate,
    });
    this.sessions$.next(this.currentSession);

    this.state$ = this.sessions$.pipe(switchMap((session) => session.state$));
    this.receive$ = this.sessions$.pipe(
      switchMap((session) => session.receive$),
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

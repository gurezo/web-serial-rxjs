import { Injectable, OnDestroy } from '@angular/core';
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

/** v2 SerialSession を薄くラップ。表示は `terminalText$`、`receive$` は raw。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  private readonly terminalBufferEpoch$ = new BehaviorSubject(0);

  private currentBaudRate = 9600;
  private currentSession: SerialSession = createSerialSession({
    baudRate: this.currentBaudRate,
  });

  readonly state$: Observable<SerialSessionState>;
  /** デコード済み raw チャンク。textarea には `terminalText$` を参照。 */
  readonly receive$: Observable<string>;
  /** `\r` を畳んだターミナル表示用テキスト（Issue #275 `createTerminalBuffer`）。 */
  readonly terminalText$: Observable<string>;
  readonly isConnected$: Observable<boolean>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.sessions$.next(this.currentSession);
    this.state$ = this.sessions$.pipe(
      switchMap((session) => session.state$),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.receive$ = this.sessions$.pipe(
      switchMap((session) => session.receive$),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.terminalText$ = combineLatest([
      this.sessions$,
      this.terminalBufferEpoch$,
    ]).pipe(
      switchMap(([session]) => session.terminalText$),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.isConnected$ = this.sessions$.pipe(
      switchMap((session) => session.isConnected$),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    this.errors$ = this.sessions$.pipe(
      switchMap((session) => session.errors$),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  ngOnDestroy(): void {
    this.currentSession.dispose$().subscribe({ error: () => void 0 });
    this.sessions$.complete();
    this.terminalBufferEpoch$.complete();
  }

  isBrowserSupported(): boolean {
    return this.currentSession.isBrowserSupported();
  }

  connect$(baudRate?: number): Observable<void> {
    this.bumpTerminalBufferEpoch();
    if (baudRate !== undefined && baudRate !== this.currentBaudRate) {
      const previousSession = this.currentSession;
      this.currentBaudRate = baudRate;
      this.currentSession = createSerialSession({ baudRate });
      this.sessions$.next(this.currentSession);
      return previousSession
        .dispose$()
        .pipe(switchMap(() => this.currentSession.connect$()));
    }
    return this.currentSession.connect$();
  }

  disconnect$(): Observable<void> {
    return this.currentSession.disconnect$();
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.currentSession.send$(data);
  }

  /** `terminalText$` の表示累積をリセットし、以降の受信のみ表示する（textarea クリア・再接続時）。 */
  bumpTerminalBufferEpoch(): void {
    this.terminalBufferEpoch$.next(this.terminalBufferEpoch$.value + 1);
  }
}

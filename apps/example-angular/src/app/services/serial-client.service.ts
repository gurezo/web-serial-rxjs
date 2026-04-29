import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialSession,
  createTerminalBuffer,
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  combineLatest,
  Observable,
  ReplaySubject,
  switchMap,
} from 'rxjs';

/** v2 SerialSession を薄くラップ。表示は `terminalText$`（`createTerminalBuffer`）、`receive$` は raw。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  /** 同一セッションでも表示バッファだけ切り替え（クリア・再接続）するための世代。 */
  private readonly terminalBufferEpoch$ = new BehaviorSubject(0);
  private currentSession: SerialSession;
  private currentBaudRate: number;

  readonly state$: Observable<SerialSessionState>;
  /** デコード済み raw チャンク。textarea には `terminalText$` を参照。 */
  readonly receive$: Observable<string>;
  /** `\r` を畳んだターミナル表示用テキスト（Issue #275 `createTerminalBuffer`）。 */
  readonly terminalText$: Observable<string>;
  readonly isConnected$: Observable<boolean>;
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
    this.terminalText$ = combineLatest([
      this.sessions$,
      this.terminalBufferEpoch$,
    ]).pipe(
      switchMap(([session]) => createTerminalBuffer(session.receive$).text$),
    );
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

  /** `createTerminalBuffer` の累積を捨て、以降の受信のみ表示する（textarea クリア・再接続時）。 */
  bumpTerminalBufferEpoch(): void {
    this.terminalBufferEpoch$.next(this.terminalBufferEpoch$.value + 1);
  }
}

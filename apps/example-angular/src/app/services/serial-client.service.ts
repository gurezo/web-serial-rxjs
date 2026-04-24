import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap, filter, map, scan } from 'rxjs';

/** v2 SerialSession を薄くラップ。受信は行単位の `lines$` に派生。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  private currentSession: SerialSession;
  private currentBaudRate: number;

  readonly state$: Observable<SerialSessionState>;
  /** `receive$` を `\n` で分割した行のバッチ（QUICK_START と同パターン）。 */
  readonly lines$: Observable<string[]>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.currentBaudRate = 9600;
    this.currentSession = createSerialSession({
      baudRate: this.currentBaudRate,
    });
    this.sessions$.next(this.currentSession);

    this.state$ = this.sessions$.pipe(switchMap((session) => session.state$));
    this.lines$ = this.sessions$.pipe(
      switchMap((session) =>
        session.receive$.pipe(
          scan(
            (acc, chunk: string) => {
              const combined = acc.buffer + chunk;
              const parts = combined.split('\n');
              return { buffer: parts.pop() ?? '', lines: parts };
            },
            { buffer: '', lines: [] as string[] },
          ),
          filter((x) => x.lines.length > 0),
          map((x) => x.lines),
        ),
      ),
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

import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialClientCore,
  type SerialClientCore,
} from '@gurezo/serial-client-core';
import { type SerialError, type SerialSessionState } from '@gurezo/web-serial-rxjs';
import { type Observable } from 'rxjs';

/** v2 SerialSession を薄くラップ。表示は `terminalText$`、`receive$` は raw。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly core: SerialClientCore = createSerialClientCore();

  readonly state$: Observable<SerialSessionState>;
  /** デコード済み raw チャンク。textarea には `terminalText$` を参照。 */
  readonly receive$: Observable<string>;
  /** `\r` を畳んだターミナル表示用テキスト（Issue #275 `createTerminalBuffer`）。 */
  readonly terminalText$: Observable<string>;
  readonly isConnected$: Observable<boolean>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.state$ = this.core.state$;
    this.receive$ = this.core.receive$;
    this.terminalText$ = this.core.terminalText$;
    this.isConnected$ = this.core.isConnected$;
    this.errors$ = this.core.errors$;
  }

  ngOnDestroy(): void {
    this.core.dispose$().subscribe({ error: () => void 0 });
  }

  isBrowserSupported(): boolean {
    return this.core.isBrowserSupported();
  }

  connect$(baudRate?: number): Observable<void> {
    return this.core.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.core.disconnect$();
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.core.send$(data);
  }

  /** `terminalText$` の表示累積をリセットし、以降の受信のみ表示する（textarea クリア・再接続時）。 */
  bumpTerminalBufferEpoch(): void {
    this.core.clearTerminalText();
  }
}

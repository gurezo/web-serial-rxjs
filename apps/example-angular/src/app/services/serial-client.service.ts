import { Injectable, OnDestroy } from '@angular/core';
import {
  type SerialError,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { createSerialSessionController } from '@gurezo/examples-shared';
import { type Observable } from 'rxjs';

/** v2 SerialSession を薄くラップ。表示は `terminalText$`、`receive$` は raw。 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly controller = createSerialSessionController({
    initialBaudRate: 9600,
  });

  readonly state$: Observable<SerialSessionState> = this.controller.state$;
  /** デコード済み raw チャンク。textarea には `terminalText$` を参照。 */
  readonly receive$: Observable<string> = this.controller.receive$;
  /** `\r` を畳んだターミナル表示用テキスト（Issue #275 `createTerminalBuffer`）。 */
  readonly terminalText$: Observable<string> = this.controller.terminalText$;
  readonly errors$: Observable<SerialError> = this.controller.errors$;

  ngOnDestroy(): void {
    this.controller.dispose();
  }

  isBrowserSupported(): boolean {
    return this.controller.isBrowserSupported();
  }

  connect$(baudRate?: number): Observable<void> {
    return this.controller.connect$(baudRate);
  }

  disconnect$(): Observable<void> {
    return this.controller.disconnect$();
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.controller.send$(data);
  }

  /** `terminalText$` の表示累積をリセットし、以降の受信のみ表示する（textarea クリア・再接続時）。 */
  bumpTerminalBufferEpoch(): void {
    this.controller.resetTerminalBuffer();
  }
}

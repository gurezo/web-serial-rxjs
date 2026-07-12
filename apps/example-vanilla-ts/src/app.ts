import {
  SerialSessionStatus,
  type SerialSessionStatus as SerialSessionStatusType,
} from '@gurezo/web-serial-rxjs';
import { createSerialSessionController } from '@gurezo/examples-shared';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

type StatusType = 'info' | 'success' | 'error';

const UNSUPPORTED_MSG =
  'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。';
const S = SerialSessionStatus;

const STATUS: Record<SerialSessionStatusType, [StatusType, string]> = {
  [S.Idle]: ['info', 'シリアルポートから切断しました。'],
  [S.Connecting]: ['info', '接続中です...'],
  [S.Connected]: ['success', 'シリアルポートに接続しました。'],
  [S.Disconnecting]: ['info', '切断中です...'],
  [S.Unsupported]: ['error', UNSUPPORTED_MSG],
  [S.Error]: ['error', 'エラーが発生しました。errors$ を確認してください。'],
  [S.Disposed]: ['info', 'セッションは破棄されました。'],
};

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`${id} element not found`);
  return el as T;
};
const setStatus = (el: HTMLElement, type: StatusType, msg: string): void => {
  el.textContent = msg;
  el.className = `status-message ${type}`;
};

export class App {
  private readonly controller = createSerialSessionController({
    initialBaudRate: 9600,
  });

  constructor() {
    const connectBtn = $<HTMLButtonElement>('connect-btn');
    const disconnectBtn = $<HTMLButtonElement>('disconnect-btn');
    const status = $<HTMLElement>('connection-status');
    const baudRateSelect = $<HTMLSelectElement>('baud-rate');
    const sendInput = $<HTMLInputElement>('send-input');
    const sendBtn = $<HTMLButtonElement>('send-btn');
    const receiveOutput = $<HTMLTextAreaElement>('receive-output');

    const supported = this.controller.isBrowserSupported();
    setStatus(
      $<HTMLElement>('browser-support-status'),
      supported ? 'success' : 'error',
      supported ? 'ブラウザは Web Serial API をサポートしています。' : UNSUPPORTED_MSG,
    );

    this.controller.state$.subscribe((state) => {
      const connected = state.status === S.Connected;
      const busy = state.status === S.Connecting || state.status === S.Disconnecting;
      connectBtn.disabled = !supported || connected || busy;
      baudRateSelect.disabled = connected || busy;
      disconnectBtn.disabled = !connected;
      sendInput.disabled = sendBtn.disabled = !connected;
      setStatus(status, ...STATUS[state.status]);
    });

    this.controller.terminalText$.subscribe((text) => {
      receiveOutput.value = text;
      receiveOutput.scrollTop = receiveOutput.scrollHeight;
    });

    this.controller.errors$.subscribe((error) => {
      setStatus(status, 'error', `エラー: ${error.message}`);
      console.error('Serial port error:', error);
    });

    fromEvent(connectBtn, 'click').subscribe(() => {
      const baudRate = parseInt(baudRateSelect.value, 10);
      receiveOutput.value = '';
      this.controller.connect$(baudRate).subscribe({ error: () => void 0 });
    });

    fromEvent(disconnectBtn, 'click').subscribe(() =>
      this.controller.disconnect$().subscribe({ error: () => void 0 }),
    );

    const send = () => {
      const text = sendInput.value.trim();
      if (!text) return;
      this.controller.send$(`${text}\n`).subscribe({
        next: () => (sendInput.value = ''),
        error: () => void 0,
      });
    };

    fromEvent(sendBtn, 'click').subscribe(send);
    fromEvent<KeyboardEvent>(sendInput, 'keydown')
      .pipe(filter((e) => e.key === 'Enter' && !e.shiftKey))
      .subscribe((e) => {
        e.preventDefault();
        send();
      });

    fromEvent($<HTMLButtonElement>('clear-receive-btn'), 'click').subscribe(() => {
      this.controller.resetTerminalBuffer();
      receiveOutput.value = '';
    });
  }
}

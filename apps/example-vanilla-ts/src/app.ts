import {
  createSerialSession,
  SerialSessionState,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

type StatusType = 'info' | 'success' | 'error';

const UNSUPPORTED_MSG =
  'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。';
const S = SerialSessionState;

const STATUS: Record<SerialSessionState, [StatusType, string]> = {
  [S.Idle]: ['info', 'シリアルポートから切断しました。'],
  [S.Connecting]: ['info', '接続中です...'],
  [S.Connected]: ['success', 'シリアルポートに接続しました。'],
  [S.Disconnecting]: ['info', '切断中です...'],
  [S.Unsupported]: ['error', UNSUPPORTED_MSG],
  [S.Error]: ['error', 'エラーが発生しました。errors$ を確認してください。'],
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
  private session: SerialSession;
  private baudRate: number;

  constructor() {
    const connectBtn = $<HTMLButtonElement>('connect-btn');
    const disconnectBtn = $<HTMLButtonElement>('disconnect-btn');
    const status = $<HTMLElement>('connection-status');
    const baudRateSelect = $<HTMLSelectElement>('baud-rate');
    const sendInput = $<HTMLInputElement>('send-input');
    const sendBtn = $<HTMLButtonElement>('send-btn');
    const receiveOutput = $<HTMLTextAreaElement>('receive-output');
    this.baudRate = parseInt(baudRateSelect.value, 10);
    this.session = createSerialSession({ baudRate: this.baudRate });
    const supported = this.session.isBrowserSupported();
    setStatus(
      $<HTMLElement>('browser-support-status'),
      supported ? 'success' : 'error',
      supported ? 'ブラウザは Web Serial API をサポートしています。' : UNSUPPORTED_MSG,
    );
    this.session.state$.subscribe((state) => {
      const connected = state === S.Connected;
      const busy = state === S.Connecting || state === S.Disconnecting;
      connectBtn.disabled = !supported || connected || busy;
      baudRateSelect.disabled = connected || busy;
      setStatus(status, ...STATUS[state]);
    });
    this.session.isConnected$.subscribe((isConnected) => {
      disconnectBtn.disabled = !isConnected;
      sendInput.disabled = sendBtn.disabled = !isConnected;
    });
    this.session.receive$.subscribe((chunk) => {
      receiveOutput.value += chunk;
      receiveOutput.scrollTop = receiveOutput.scrollHeight;
    });
    this.session.errors$.subscribe((error) => {
      setStatus(status, 'error', `エラー: ${error.message}`);
      console.error('Serial port error:', error);
    });
    fromEvent(connectBtn, 'click').subscribe(() => {
      const baudRate = parseInt(baudRateSelect.value, 10);
      if (baudRate !== this.baudRate) {
        this.baudRate = baudRate;
        this.session = createSerialSession({ baudRate });
      }
      receiveOutput.value = '';
      this.session.connect$().subscribe({ error: () => void 0 });
    });
    fromEvent(disconnectBtn, 'click').subscribe(() =>
      this.session.disconnect$().subscribe({ error: () => void 0 }),
    );
    const send = () => {
      const text = sendInput.value.trim();
      if (!text) return;
      this.session.send$(`${text}\n`).subscribe({
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
    fromEvent($<HTMLButtonElement>('clear-receive-btn'), 'click').subscribe(
      () => (receiveOutput.value = ''),
    );
  }
}

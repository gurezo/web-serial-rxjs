import {
  createSerialSession,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

type StatusType = 'info' | 'success' | 'error';

const UNSUPPORTED_MSG =
  'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。';
const STATUS: Record<SerialSessionState, [StatusType, string]> = {
  idle: ['info', 'シリアルポートから切断しました。'],
  connecting: ['info', '接続中です...'],
  connected: ['success', 'シリアルポートに接続しました。'],
  disconnecting: ['info', '切断中です...'],
  unsupported: ['error', UNSUPPORTED_MSG],
  error: ['error', 'エラーが発生しました。errors$ を確認してください。'],
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
      const connected = state === 'connected';
      const busy = state === 'connecting' || state === 'disconnecting';
      connectBtn.disabled = !supported || connected || busy;
      disconnectBtn.disabled = !connected;
      sendInput.disabled = sendBtn.disabled = !connected;
      baudRateSelect.disabled = connected || busy;
      setStatus(status, ...STATUS[state]);
    });
    this.session.receive$.subscribe((text) => {
      receiveOutput.value += text;
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

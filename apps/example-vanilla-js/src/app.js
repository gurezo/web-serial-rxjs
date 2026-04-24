// eslint-disable-next-line @nx/enforce-module-boundaries
import { createSerialSession } from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter, map, scan } from 'rxjs/operators';

const UNSUPPORTED_MSG =
  'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。';
const STATUS = {
  idle: ['info', 'シリアルポートから切断しました。'],
  connecting: ['info', '接続中です...'],
  connected: ['success', 'シリアルポートに接続しました。'],
  disconnecting: ['info', '切断中です...'],
  unsupported: ['error', UNSUPPORTED_MSG],
  error: ['error', 'エラーが発生しました。errors$ を確認してください。'],
};

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`${id} element not found`);
  return el;
};
const setStatus = (el, type, msg) => {
  el.textContent = msg;
  el.className = `status-message ${type}`;
};

export class App {
  constructor() {
    const connectBtn = $('connect-btn');
    const disconnectBtn = $('disconnect-btn');
    const status = $('connection-status');
    const baudRateSelect = $('baud-rate');
    const sendInput = $('send-input');
    const sendBtn = $('send-btn');
    const receiveOutput = $('receive-output');
    this.baudRate = parseInt(baudRateSelect.value, 10);
    this.session = createSerialSession({ baudRate: this.baudRate });
    const supported = this.session.isBrowserSupported();
    setStatus(
      $('browser-support-status'),
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
    this.session.receive$
      .pipe(
        scan(
          (acc, chunk) => {
            const combined = acc.buffer + chunk;
            const parts = combined.split('\n');
            return { buffer: parts.pop() ?? '', lines: parts };
          },
          { buffer: '', lines: [] },
        ),
        filter((x) => x.lines.length > 0),
        map((x) => x.lines),
      )
      .subscribe((lines) => {
        receiveOutput.value += lines.map((l) => `${l}\n`).join('');
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
    fromEvent(sendInput, 'keydown')
      .pipe(filter((e) => e.key === 'Enter' && !e.shiftKey))
      .subscribe((e) => {
        e.preventDefault();
        send();
      });
    fromEvent($('clear-receive-btn'), 'click').subscribe(
      () => (receiveOutput.value = ''),
    );
  }
}

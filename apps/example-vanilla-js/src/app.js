import {
  createSerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  combineLatest,
  fromEvent,
  ReplaySubject,
  shareReplay,
  switchMap,
} from 'rxjs';
import { filter } from 'rxjs/operators';

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
    this.sessions$ = new ReplaySubject(1);
    this.terminalBufferEpoch$ = new BehaviorSubject(0);
    this.currentBaudRate = 9600;
    this.currentSession = createSerialSession({ baudRate: this.currentBaudRate });
    this.sessions$.next(this.currentSession);

    const supported = this.currentSession.isBrowserSupported();
    setStatus(
      $('browser-support-status'),
      supported ? 'success' : 'error',
      supported ? 'ブラウザは Web Serial API をサポートしています。' : UNSUPPORTED_MSG,
    );

    this.sessions$
      .pipe(
        switchMap((session) => session.state$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((state) => {
      const connected = state === SerialSessionState.Connected;
      const busy =
        state === SerialSessionState.Connecting ||
        state === SerialSessionState.Disconnecting;
      connectBtn.disabled = !supported || connected || busy;
      baudRateSelect.disabled = connected || busy;
      setStatus(status, ...STATUS[state]);
    });

    this.sessions$
      .pipe(
        switchMap((session) => session.isConnected$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((isConnected) => {
        disconnectBtn.disabled = !isConnected;
        sendInput.disabled = sendBtn.disabled = !isConnected;
      });

    combineLatest([this.sessions$, this.terminalBufferEpoch$])
      .pipe(
        switchMap(([session]) => session.terminalText$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((text) => {
        receiveOutput.value = text;
        receiveOutput.scrollTop = receiveOutput.scrollHeight;
      });

    this.sessions$
      .pipe(
        switchMap((session) => session.errors$),
        shareReplay({ bufferSize: 1, refCount: true }),
      )
      .subscribe((error) => {
        setStatus(status, 'error', `エラー: ${error.message}`);
        console.error('Serial port error:', error);
      });

    fromEvent(connectBtn, 'click').subscribe(() => {
      const baudRate = parseInt(baudRateSelect.value, 10);
      this.terminalBufferEpoch$.next(this.terminalBufferEpoch$.value + 1);
      receiveOutput.value = '';
      if (baudRate !== this.currentBaudRate) {
        const previousSession = this.currentSession;
        this.currentBaudRate = baudRate;
        this.currentSession = createSerialSession({ baudRate });
        this.sessions$.next(this.currentSession);
        previousSession
          .dispose$()
          .pipe(switchMap(() => this.currentSession.connect$()))
          .subscribe({ error: () => void 0 });
        return;
      }
      this.currentSession.connect$().subscribe({ error: () => void 0 });
    });

    fromEvent(disconnectBtn, 'click').subscribe(() =>
      this.currentSession.disconnect$().subscribe({ error: () => void 0 }),
    );

    const send = () => {
      const text = sendInput.value.trim();
      if (!text) return;
      this.currentSession.send$(`${text}\n`).subscribe({
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

    fromEvent($('clear-receive-btn'), 'click').subscribe(() => {
      this.terminalBufferEpoch$.next(this.terminalBufferEpoch$.value + 1);
      receiveOutput.value = '';
    });
  }
}

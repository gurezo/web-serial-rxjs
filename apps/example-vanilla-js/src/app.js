import {
  createSerialSessionController,
  formatExampleSerialError,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
} from '@gurezo/examples-shared';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

const $ = (id) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`${id} element not found`);
  return el;
};
const setStatus = (el, type, msg) => {
  el.textContent = msg;
  el.className = `status-message ${type}`;
};

const createLinkItem = (link) => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = link.href;
  a.textContent = link.label;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  li.appendChild(a);
  return li;
};

const mountExampleNav = (slug) => {
  const header = document.querySelector('header');
  if (!header) return;

  const links = getExampleNavLinks(slug);
  const nav = document.createElement('nav');
  nav.className = 'example-nav';
  nav.setAttribute('aria-label', 'Example links');

  const primary = document.createElement('ul');
  primary.className = 'example-nav-primary';
  for (const link of [
    links.viewSource,
    links.documentation,
    links.backToExamples,
    links.reportIssue,
  ]) {
    primary.appendChild(createLinkItem(link));
  }

  const source = document.createElement('ul');
  source.className = 'example-nav-source';
  for (const link of [
    links.sourceParts.entry,
    links.sourceParts.serviceHookStore,
    links.sourceParts.ui,
    links.sourceParts.readme,
  ]) {
    source.appendChild(createLinkItem(link));
  }

  nav.appendChild(primary);
  nav.appendChild(source);
  header.appendChild(nav);
};

const mountRequirements = () => {
  const requirements = getExampleRequirementsCopy();
  const supportStatus = getExampleSupportStatus();

  $('requirements-title').textContent = requirements.title;
  const list = $('requirements-list');
  list.replaceChildren();
  for (const item of requirements.items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }

  setStatus(
    $('browser-support-status'),
    supportStatus.statusType,
    supportStatus.statusMessage,
  );

  return supportStatus;
};

export class App {
  constructor() {
    mountExampleNav('vanilla-js');
    const supportStatus = mountRequirements();

    const connectBtn = $('connect-btn');
    const disconnectBtn = $('disconnect-btn');
    const status = $('connection-status');
    const baudRateSelect = $('baud-rate');
    const sendInput = $('send-input');
    const sendBtn = $('send-btn');
    const receiveOutput = $('receive-output');
    this.controller = createSerialSessionController({ initialBaudRate: 9600 });

    const STATUS = {
      idle: ['info', 'シリアルポートから切断しました。'],
      connecting: ['info', '接続中です...'],
      connected: ['success', 'シリアルポートに接続しました。'],
      disconnecting: ['info', '切断中です...'],
      unsupported: ['error', supportStatus.statusMessage],
      error: ['error', 'エラーが発生しました。errors$ を確認してください。'],
      disposed: ['info', 'セッションは破棄されました。'],
    };

    this.controller.state$.subscribe((state) => {
      const connected = state.status === SerialSessionStatus.Connected;
      const busy =
        state.status === SerialSessionStatus.Connecting ||
        state.status === SerialSessionStatus.Disconnecting;
      connectBtn.disabled = !supportStatus.canConnect || connected || busy;
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
      const display = formatExampleSerialError(error);
      setStatus(
        status,
        display.type,
        display.type === 'info' ? display.message : `エラー: ${display.message}`,
      );
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
    fromEvent(sendInput, 'keydown')
      .pipe(filter((e) => e.key === 'Enter' && !e.shiftKey))
      .subscribe((e) => {
        e.preventDefault();
        send();
      });

    fromEvent($('clear-receive-btn'), 'click').subscribe(() => {
      this.controller.resetTerminalBuffer();
      receiveOutput.value = '';
    });
  }
}

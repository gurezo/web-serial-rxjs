import {
  createSerialSessionController,
  formatExamplePortInfo,
  formatExampleSerialErrorDetail,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
} from '@gurezo/examples-shared';
import {
  isConnectedSessionState,
  SerialSessionStatus,
} from '@gurezo/web-serial-rxjs';
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
    const sessionStatusEl = $('session-status');
    const sessionInProgressEl = $('session-in-progress');
    const portInfoRow = $('session-port-info-row');
    const portInfoEl = $('session-port-info');
    const errorPanel = $('session-error-panel');
    const errorEmpty = $('session-error-empty');
    const errorMessageEl = $('session-error-message');
    const errorCodeEl = $('session-error-code');
    const errorContextRow = $('session-error-context-row');
    const errorContextEl = $('session-error-context');
    const clearErrorBtn = $('clear-error-btn');
    this.controller = createSerialSessionController({ initialBaudRate: 9600 });
    this.latestError = null;
    let lastState = { status: SerialSessionStatus.Idle };

    const STATUS = {
      idle: ['info', 'シリアルポートから切断しました。'],
      connecting: ['info', '接続中です...'],
      connected: ['success', 'シリアルポートに接続しました。'],
      disconnecting: ['info', '切断中です...'],
      unsupported: ['error', supportStatus.statusMessage],
      error: ['error', 'エラーが発生しました。errors$ を確認してください。'],
      disposed: ['info', 'セッションは破棄されました。'],
    };

    const renderErrorPanel = () => {
      if (!this.latestError) {
        errorPanel.hidden = true;
        errorEmpty.hidden = false;
        clearErrorBtn.hidden = true;
        return;
      }
      errorPanel.hidden = false;
      errorEmpty.hidden = true;
      clearErrorBtn.hidden = false;
      errorMessageEl.textContent = this.latestError.message;
      errorCodeEl.textContent = this.latestError.code;
      if (this.latestError.contextSummary) {
        errorContextRow.hidden = false;
        errorContextEl.textContent = this.latestError.contextSummary;
      } else {
        errorContextRow.hidden = true;
        errorContextEl.textContent = '';
      }
    };

    const clearError = () => {
      this.latestError = null;
      renderErrorPanel();
      setStatus(status, ...STATUS[lastState.status]);
    };

    const renderSessionState = (state) => {
      const session = formatExampleSessionStatus(state);
      sessionStatusEl.textContent = session.display;
      sessionInProgressEl.textContent = session.inProgress ? 'はい' : 'いいえ';
      if (isConnectedSessionState(state)) {
        portInfoRow.hidden = false;
        portInfoEl.textContent = formatExamplePortInfo(state.portInfo).display;
      } else {
        portInfoRow.hidden = true;
        portInfoEl.textContent = '';
      }
    };

    const applyControls = (state) => {
      const controls = getExampleControlsEnabled(state, supportStatus.canConnect);
      connectBtn.disabled = !controls.connect;
      disconnectBtn.disabled = !controls.disconnect;
      sendInput.disabled = sendBtn.disabled = !controls.send;
      baudRateSelect.disabled =
        state.status === SerialSessionStatus.Connected ||
        state.status === SerialSessionStatus.Connecting ||
        state.status === SerialSessionStatus.Disconnecting;
    };

    this.controller.state$.subscribe((state) => {
      lastState = state;
      applyControls(state);
      renderSessionState(state);
      if (
        state.status === SerialSessionStatus.Connected ||
        state.status === SerialSessionStatus.Idle
      ) {
        this.latestError = null;
        renderErrorPanel();
      }
      if (!this.latestError) {
        setStatus(status, ...STATUS[state.status]);
      }
    });

    this.controller.terminalText$.subscribe((text) => {
      receiveOutput.value = text;
      receiveOutput.scrollTop = receiveOutput.scrollHeight;
    });

    this.controller.errors$.subscribe((error) => {
      const display = formatExampleSerialErrorDetail(error);
      this.latestError = display;
      renderErrorPanel();
      setStatus(
        status,
        display.type,
        display.type === 'info' ? display.message : `エラー: ${display.message}`,
      );
      console.error('Serial port error:', error);
    });

    fromEvent(clearErrorBtn, 'click').subscribe(() => clearError());

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

    renderErrorPanel();
  }
}

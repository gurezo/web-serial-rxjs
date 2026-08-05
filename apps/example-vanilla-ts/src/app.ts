import {
  appendExampleLineEnding,
  createSerialSessionController,
  DEFAULT_EXAMPLE_LINE_ENDING,
  EXAMPLE_LINE_ENDING_OPTIONS,
  formatExamplePortInfo,
  formatExampleSerialErrorDetail,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
  type ExampleLineEnding,
  type ExampleNavLink,
  type ExampleSlug,
  type ExampleSerialErrorDetail,
} from '@gurezo/examples-shared';
import {
  isConnectedSessionState,
  SerialSessionStatus,
  type SerialSessionState,
  type SerialSessionStatus as SerialSessionStatusType,
} from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter } from 'rxjs/operators';

type StatusType = 'info' | 'success' | 'error';

const S = SerialSessionStatus;

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`${id} element not found`);
  return el as T;
};
const setStatus = (el: HTMLElement, type: StatusType, msg: string): void => {
  el.textContent = msg;
  el.className = `status-message ${type}`;
};

const createLinkItem = (link: ExampleNavLink): HTMLLIElement => {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = link.href;
  a.textContent = link.label;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  li.appendChild(a);
  return li;
};

const mountExampleNav = (slug: ExampleSlug): void => {
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
    links.troubleshooting,
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

const mountRequirements = (): ReturnType<typeof getExampleSupportStatus> => {
  const requirements = getExampleRequirementsCopy();
  const supportStatus = getExampleSupportStatus();

  $<HTMLElement>('requirements-title').textContent = requirements.title;
  const list = $<HTMLUListElement>('requirements-list');
  list.replaceChildren();
  for (const item of requirements.items) {
    const li = document.createElement('li');
    li.textContent = item;
    list.appendChild(li);
  }

  setStatus(
    $<HTMLElement>('browser-support-status'),
    supportStatus.statusType,
    supportStatus.statusMessage,
  );

  return supportStatus;
};

export class App {
  private readonly controller = createSerialSessionController({
    initialBaudRate: 9600,
  });

  private latestError: ExampleSerialErrorDetail | null = null;

  constructor() {
    mountExampleNav('vanilla-ts');
    const supportStatus = mountRequirements();

    const connectBtn = $<HTMLButtonElement>('connect-btn');
    const disconnectBtn = $<HTMLButtonElement>('disconnect-btn');
    const status = $<HTMLElement>('connection-status');
    const baudRateSelect = $<HTMLSelectElement>('baud-rate');
    const lineEndingSelect = $<HTMLSelectElement>('line-ending');
    const sendInput = $<HTMLInputElement>('send-input');
    const sendBtn = $<HTMLButtonElement>('send-btn');
    const receiveOutput = $<HTMLTextAreaElement>('receive-output');
    const sessionStatusEl = $<HTMLElement>('session-status');
    const sessionInProgressEl = $<HTMLElement>('session-in-progress');
    const portInfoRow = $<HTMLElement>('session-port-info-row');
    const portInfoEl = $<HTMLElement>('session-port-info');
    const errorPanel = $<HTMLElement>('session-error-panel');
    const errorEmpty = $<HTMLElement>('session-error-empty');
    const errorMessageEl = $<HTMLElement>('session-error-message');
    const errorCodeEl = $<HTMLElement>('session-error-code');
    const errorContextRow = $<HTMLElement>('session-error-context-row');
    const errorContextEl = $<HTMLElement>('session-error-context');
    const clearErrorBtn = $<HTMLButtonElement>('clear-error-btn');

    for (const opt of EXAMPLE_LINE_ENDING_OPTIONS) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === DEFAULT_EXAMPLE_LINE_ENDING) {
        option.selected = true;
      }
      lineEndingSelect.appendChild(option);
    }

    const STATUS: Record<SerialSessionStatusType, [StatusType, string]> = {
      [S.Idle]: ['info', 'シリアルポートから切断しました。'],
      [S.Connecting]: ['info', '接続中です...'],
      [S.Connected]: ['success', 'シリアルポートに接続しました。'],
      [S.Disconnecting]: ['info', '切断中です...'],
      [S.Unsupported]: ['error', supportStatus.statusMessage],
      [S.Error]: ['error', 'エラーが発生しました。errors$ を確認してください。'],
      [S.Disposed]: ['info', 'セッションは破棄されました。'],
    };

    let lastState: SerialSessionState = { status: S.Idle };

    const renderErrorPanel = (): void => {
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

    const clearError = (): void => {
      this.latestError = null;
      renderErrorPanel();
      setStatus(status, ...STATUS[lastState.status]);
    };

    const renderSessionState = (state: SerialSessionState): void => {
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

    const applyControls = (state: SerialSessionState): void => {
      const controls = getExampleControlsEnabled(state, supportStatus.canConnect);
      connectBtn.disabled = !controls.connect;
      disconnectBtn.disabled = !controls.disconnect;
      sendInput.disabled = sendBtn.disabled = !controls.send;
      baudRateSelect.disabled =
        state.status === S.Connected ||
        state.status === S.Connecting ||
        state.status === S.Disconnecting;
    };

    this.controller.state$.subscribe((state) => {
      lastState = state;
      applyControls(state);
      renderSessionState(state);
      if (state.status === S.Connected || state.status === S.Idle) {
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
      const ending = lineEndingSelect.value as ExampleLineEnding;
      this.controller.send$(appendExampleLineEnding(text, ending)).subscribe({
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

    renderErrorPanel();
  }
}

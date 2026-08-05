import {
  createSerialSessionController,
  formatExampleSerialError,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
  type ExampleNavLink,
  type ExampleSlug,
} from '@gurezo/examples-shared';
import {
  SerialSessionStatus,
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

  constructor() {
    mountExampleNav('vanilla-ts');
    const supportStatus = mountRequirements();

    const connectBtn = $<HTMLButtonElement>('connect-btn');
    const disconnectBtn = $<HTMLButtonElement>('disconnect-btn');
    const status = $<HTMLElement>('connection-status');
    const baudRateSelect = $<HTMLSelectElement>('baud-rate');
    const sendInput = $<HTMLInputElement>('send-input');
    const sendBtn = $<HTMLButtonElement>('send-btn');
    const receiveOutput = $<HTMLTextAreaElement>('receive-output');

    const STATUS: Record<SerialSessionStatusType, [StatusType, string]> = {
      [S.Idle]: ['info', 'シリアルポートから切断しました。'],
      [S.Connecting]: ['info', '接続中です...'],
      [S.Connected]: ['success', 'シリアルポートに接続しました。'],
      [S.Disconnecting]: ['info', '切断中です...'],
      [S.Unsupported]: ['error', supportStatus.statusMessage],
      [S.Error]: ['error', 'エラーが発生しました。errors$ を確認してください。'],
      [S.Disposed]: ['info', 'セッションは破棄されました。'],
    };

    this.controller.state$.subscribe((state) => {
      const connected = state.status === S.Connected;
      const busy = state.status === S.Connecting || state.status === S.Disconnecting;
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

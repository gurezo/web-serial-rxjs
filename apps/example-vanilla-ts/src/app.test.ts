import { BehaviorSubject, Subject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { App } from './app.js';

interface MockSession {
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  state$: BehaviorSubject<{ status: string }>;
  receive$: Subject<string>;
  terminalText$: Subject<string>;
  errors$: Subject<{ message: string }>;
}

const createMockSession = (): MockSession => {
  const state$ = new BehaviorSubject<{ status: string }>({ status: 'idle' });
  const receive$ = new Subject<string>();
  const errors$ = new Subject<{ message: string }>();
  return {
    connect$: vi.fn(() => of(undefined)),
    disconnect$: vi.fn(() => of(undefined)),
    dispose$: vi.fn(() => of(undefined)),
    send$: vi.fn(() => of(undefined)),
    state$,
    receive$,
    terminalText$: receive$,
    errors$,
  };
};

let mockSessions: MockSession[] = [];

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual = await vi.importActual<typeof import('@gurezo/web-serial-rxjs')>(
    '@gurezo/web-serial-rxjs',
  );
  return {
    ...actual,
    isWebSerialSupported: vi.fn(() => true),
    createSerialSession: vi.fn(() => {
      const mock = createMockSession();
      mockSessions.push(mock);
      return mock;
    }),
  };
});

describe('App', () => {
  let app: App | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = [];
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    container = document.createElement('div');
    container.innerHTML = `
      <h2 id="requirements-title"></h2>
      <ul id="requirements-list"></ul>
      <div id="browser-support-status"></div>
      <button id="connect-btn"></button>
      <button id="disconnect-btn"></button>
      <div id="connection-status"></div>
      <dd id="session-status"></dd>
      <dd id="session-in-progress"></dd>
      <div id="session-port-info-row" hidden>
        <dd id="session-port-info"></dd>
      </div>
      <dl id="session-error-panel" hidden>
        <dd id="session-error-message"></dd>
        <dd id="session-error-code"></dd>
        <div id="session-error-context-row" hidden>
          <dd id="session-error-context"></dd>
        </div>
      </dl>
      <p id="session-error-empty"></p>
      <button id="clear-error-btn" hidden></button>
      <select id="baud-rate">
        <option value="9600">9600</option>
        <option value="115200" selected>115200</option>
      </select>
      <select id="line-ending"></select>
      <input id="send-input" />
      <button id="send-btn"></button>
      <textarea id="receive-output"></textarea>
      <button id="clear-receive-btn"></button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    app = null;
    container = null;
  });

  it('should create an App instance', () => {
    app = new App();
    expect(app).toBeInstanceOf(App);
  });

  it('should create serial session on init', () => {
    app = new App();
    expect(webSerialRxjs.createSerialSession).toHaveBeenCalledWith({
      baudRate: 9600,
    });
  });

  it('should render requirements and browser support status', () => {
    app = new App();
    expect(document.getElementById('requirements-title')?.textContent).toBe(
      '利用条件',
    );
    expect(
      document.getElementById('requirements-list')?.textContent,
    ).toContain('HTTPS');
    const el = document.getElementById('browser-support-status');
    expect(el?.textContent).toContain('Web Serial API');
    expect(el?.textContent).toContain('セキュアコンテキスト');
    expect(el?.className).toContain('success');
  });

  it('should render DOM elements required by the app', () => {
    app = new App();
    expect(document.getElementById('connect-btn')).not.toBeNull();
    expect(document.getElementById('disconnect-btn')).not.toBeNull();
    expect(document.getElementById('send-input')).not.toBeNull();
    expect(document.getElementById('receive-output')).not.toBeNull();
  });

  it('should dispose previous session when baud rate changes on connect', () => {
    app = new App();
    const first = mockSessions[0];
    const connectBtn = document.getElementById('connect-btn') as HTMLButtonElement;
    connectBtn.click();

    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(first.connect$).not.toHaveBeenCalled();
    expect(mockSessions).toHaveLength(2);
    expect(mockSessions[1].connect$).toHaveBeenCalledTimes(1);
    expect(webSerialRxjs.createSerialSession).toHaveBeenLastCalledWith({
      baudRate: 115200,
    });
  });

  it('should render session status panel', () => {
    app = new App();
    expect(document.getElementById('session-status')?.textContent).toContain(
      'idle',
    );
    expect(
      document.getElementById('session-error-empty')?.hidden,
    ).toBe(false);
  });
});

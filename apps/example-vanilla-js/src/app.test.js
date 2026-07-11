import { BehaviorSubject, Subject, distinctUntilChanged, map, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { App } from './app.js';

const createMockSession = () => {
  const state$ = new BehaviorSubject({ status: 'idle' });
  const receive$ = new Subject();
  const errors$ = new Subject();
  const isConnected$ = state$.pipe(
    map((s) => s.status === 'connected'),
    distinctUntilChanged(),
  );
  return {
    isBrowserSupported: vi.fn(() => true),
    connect$: vi.fn(() => of(undefined)),
    disconnect$: vi.fn(() => of(undefined)),
    dispose$: vi.fn(() => of(undefined)),
    send$: vi.fn(() => of(undefined)),
    state$,
    receive$,
    terminalText$: receive$,
    errors$,
    isConnected$,
  };
};

let mockSessions = [];

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual = await vi.importActual('@gurezo/web-serial-rxjs');
  return {
    ...actual,
    createSerialSession: vi.fn(() => {
      const mock = createMockSession();
      mockSessions.push(mock);
      return mock;
    }),
  };
});

describe('App', () => {
  let app;
  let container;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = [];
    container = document.createElement('div');
    container.innerHTML = `
      <div id="browser-support-status"></div>
      <button id="connect-btn"></button>
      <button id="disconnect-btn"></button>
      <div id="connection-status"></div>
      <select id="baud-rate">
        <option value="9600">9600</option>
        <option value="115200" selected>115200</option>
      </select>
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

  it('should render browser support status based on session.isBrowserSupported', () => {
    app = new App();
    const el = document.getElementById('browser-support-status');
    expect(el.textContent).toContain('Web Serial API');
    expect(el.className).toContain('success');
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
    const connectBtn = document.getElementById('connect-btn');
    connectBtn.click();

    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(first.connect$).not.toHaveBeenCalled();
    expect(mockSessions).toHaveLength(2);
    expect(mockSessions[1].connect$).toHaveBeenCalledTimes(1);
    expect(webSerialRxjs.createSerialSession).toHaveBeenLastCalledWith({
      baudRate: 115200,
    });
  });
});

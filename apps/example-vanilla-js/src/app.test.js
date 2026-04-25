import { BehaviorSubject, Subject, distinctUntilChanged, map, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './app.js';

vi.mock('@gurezo/web-serial-rxjs', async (importOriginal) => {
  const actual = await importOriginal();
  const state$ = new BehaviorSubject(actual.SerialSessionState.Idle);
  const receive$ = new Subject();
  const lines$ = new Subject();
  const errors$ = new Subject();
  const isConnected$ = state$.pipe(
    map((s) => s === actual.SerialSessionState.Connected),
    distinctUntilChanged(),
  );
  const mockSession = {
    isBrowserSupported: vi.fn(() => true),
    connect$: vi.fn(() => of(undefined)),
    disconnect$: vi.fn(() => of(undefined)),
    send$: vi.fn(() => of(undefined)),
    state$,
    receive$,
    lines$,
    errors$,
    isConnected$,
  };
  return {
    ...actual,
    createSerialSession: vi.fn(() => mockSession),
  };
});

describe('App', () => {
  let app;
  let container;

  beforeEach(() => {
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

  it('should create a SerialSession via createSerialSession on init', async () => {
    const { createSerialSession } = await import('@gurezo/web-serial-rxjs');
    app = new App();
    expect(createSerialSession).toHaveBeenCalled();
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
});

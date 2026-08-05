import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { mount } from '@vue/test-utils';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error - Vue SFC file, types are defined in vue-shims.d.ts
import App from './App.vue';

const SS = webSerialRxjs.SerialSessionStatus;

interface MockSession {
  session: SerialSession;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  linesSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
}

const createMockSession = (): MockSession => {
  const stateSubject = new BehaviorSubject<SerialSessionState>({ status: SS.Idle });
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const connect$ = vi.fn(() => {
    stateSubject.next({ status: SS.Connecting });
    stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    return of(undefined);
  });
  const disconnect$ = vi.fn(() => {
    stateSubject.next({ status: SS.Disconnecting });
    stateSubject.next({ status: SS.Idle });
    return of(undefined);
  });
  const dispose$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));

  const session: SerialSession = {
    connect$,
    disconnect$,
    dispose$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable()).text$,
    lines$: linesSubject.asObservable(),
  };

  return {
    session,
    stateSubject,
    receiveSubject,
    linesSubject,
    errorsSubject,
    connect$,
    disconnect$,
    dispose$,
    send$,
  };
};

let mockSessions: MockSession[] = [];

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual =
    await vi.importActual<typeof import('@gurezo/web-serial-rxjs')>(
      '@gurezo/web-serial-rxjs',
    );
  return {
    ...actual,
    isWebSerialSupported: vi.fn(() => true),
    createSerialSession: vi.fn(() => {
      const mock = createMockSession();
      mockSessions.push(mock);
      return mock.session;
    }),
  };
});

const latestMock = (): MockSession => {
  const mock = mockSessions.at(-1);
  if (!mock) {
    throw new Error('createSerialSession was not called');
  }
  return mock;
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = [];
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the app header', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('Web Serial RxJS - Vue Example');
    expect(wrapper.text()).toContain(
      'Vue Composition API を使用した Web Serial API のサンプル',
    );
  });

  it('should display requirements and browser support status', () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain('利用条件');
    expect(wrapper.text()).toContain('HTTPS');
    expect(wrapper.text()).toContain(
      'ブラウザは Web Serial API をサポートしており、セキュアコンテキストで実行中です。',
    );
  });

  it('should render connect and disconnect buttons (no port picker)', () => {
    const wrapper = mount(App);
    const text = wrapper.text();
    expect(text).toContain('接続');
    expect(text).toContain('切断');
    expect(text).not.toContain('ポートを選択');
  });

  it('should have baud rate selector defaulting to 9600', () => {
    const wrapper = mount(App);
    const baudRateSelect = wrapper.find('#baud-rate');
    expect(baudRateSelect.exists()).toBe(true);
    expect((baudRateSelect.element as HTMLSelectElement).value).toBe('9600');
  });

  it('should change baud rate value', async () => {
    const wrapper = mount(App);
    const baudRateSelect = wrapper.find('#baud-rate');

    await baudRateSelect.setValue('115200');
    expect((baudRateSelect.element as HTMLSelectElement).value).toBe('115200');
  });

  it('should show connected status after clicking connect', async () => {
    const wrapper = mount(App);

    const connectButton = wrapper.findAll('.btn-primary')[0];
    await connectButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('シリアルポートに接続しました。');
  });

  it('should show disconnected status after clicking disconnect', async () => {
    const wrapper = mount(App);

    const connectButton = wrapper.findAll('.btn-primary')[0];
    await connectButton.trigger('click');
    await wrapper.vm.$nextTick();

    const disconnectButton = wrapper.find('.btn-secondary');
    await disconnectButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('シリアルポートに接続していません。');
  });

  it('should send data through the session and clear the input', async () => {
    const wrapper = mount(App);

    const connectButton = wrapper.findAll('.btn-primary')[0];
    await connectButton.trigger('click');
    await wrapper.vm.$nextTick();

    const sendInput = wrapper.find('#send-input');
    const sendButton = wrapper.findAll('.btn-primary')[1];

    await sendInput.setValue('test message');
    await sendButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(latestMock().send$).toHaveBeenCalledWith('test message\n');
    expect((sendInput.element as HTMLInputElement).value).toBe('');
  });

  it('should disable the clear button when there is no received data', () => {
    const wrapper = mount(App);

    const clearButton = wrapper.find('.btn-secondary');
    expect(clearButton.attributes('disabled')).toBeDefined();
  });

  it('should display errorMessage when errors$ emits', async () => {
    const wrapper = mount(App);
    const mock = latestMock();

    mock.errorsSubject.next(
      new webSerialRxjs.SerialError(
        webSerialRxjs.SerialErrorCode.WRITE_FAILED,
        'write failed',
      ),
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.text()).toContain('エラー: write failed');
    expect(wrapper.find('[data-testid="session-error-code"]').text()).toBe(
      'WRITE_FAILED',
    );
  });

  it('should show session status and port info when connected', async () => {
    const wrapper = mount(App);

    expect(wrapper.find('[data-testid="session-status"]').text()).toContain(
      'idle',
    );

    const connectButton = wrapper.findAll('.btn-primary')[0];
    await connectButton.trigger('click');
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-testid="session-status"]').text()).toContain(
      'connected',
    );
    expect(wrapper.find('[data-testid="session-port-info"]').exists()).toBe(
      true,
    );
  });
});

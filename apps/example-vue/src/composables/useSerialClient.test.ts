import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { mount } from '@vue/test-utils';
import {
  BehaviorSubject,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

const SS = webSerialRxjs.SerialSessionStatus;

interface MockCore {
  session: SerialSession;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  isConnectedSubject: BehaviorSubject<boolean>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockCore = (supported = true): MockCore => {
  const stateSubject = new BehaviorSubject<SerialSessionState>({ status: SS.Idle });
  const receiveSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const isConnectedSubject = new BehaviorSubject(false);
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const dispose$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));
  const isBrowserSupported = vi.fn(() => supported);

  const session: SerialSession = {
    isBrowserSupported,
    connect$,
    disconnect$,
    dispose$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable()).text$,
    isConnected$: isConnectedSubject.asObservable(),
  };

  return {
    session,
    stateSubject,
    receiveSubject,
    errorsSubject,
    isConnectedSubject,
    connect$,
    disconnect$,
    dispose$,
    send$,
    isBrowserSupported,
  };
};

let mockCores: MockCore[] = [];
let nextSupported = true;

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual =
    await vi.importActual<typeof import('@gurezo/web-serial-rxjs')>(
      '@gurezo/web-serial-rxjs',
    );
  return {
    ...actual,
    createSerialSession: vi.fn(() => {
      const mock = createMockCore(nextSupported);
      mockCores.push(mock);
      return mock.session;
    }),
  };
});

const latestMock = (): MockCore => {
  const mock = mockCores.at(-1);
  if (!mock) {
    throw new Error('createSerialSession was not called');
  }
  return mock;
};

const TestComponent = {
  setup() {
    const api = useSerialClient(9600);
    return { api };
  },
  template: '<div />',
} as const;

const mountHarness = () => {
  const wrapper = mount(TestComponent);
  return {
    wrapper,
    api: (wrapper.vm as unknown as { api: ReturnType<typeof useSerialClient> })
      .api,
  };
};

describe('useSerialClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCores = [];
    nextSupported = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create session with the initial baud rate', () => {
    mountHarness();
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledWith({ baudRate: 9600 });
  });

  it('should initialize with default refs', () => {
    const { api } = mountHarness();
    expect(api.browserSupported.value).toBe(true);
    expect(api.state.value).toEqual({ status: SS.Idle });
    expect(api.isConnected.value).toBe(false);
    expect(api.receivedData.value).toBe('');
    expect(api.errorMessage.value).toBe(null);
  });

  it('browserSupported reflects isBrowserSupported when unsupported', () => {
    nextSupported = false;
    const { api } = mountHarness();
    expect(api.browserSupported.value).toBe(false);
  });

  it('should forward session state transitions to the state ref', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.stateSubject.next({ status: SS.Connecting });
    expect(api.state.value).toEqual({ status: SS.Connecting });

    mock.stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    expect(api.state.value).toEqual({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
  });

  it('should clear errorMessage when returning to idle or connected', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.errorsSubject.next({ message: 'boom' } as SerialError);
    expect(api.errorMessage.value).toBe('boom');

    mock.stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    expect(api.errorMessage.value).toBe(null);
  });

  it('should connect through the session', () => {
    const { api } = mountHarness();
    api.connect$().subscribe();
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
  });

  it('should recreate session when baud rate changes', () => {
    const { api } = mountHarness();
    const first = mockCores[0];
    api.connect$(115200).subscribe();

    expect(first.connect$).not.toHaveBeenCalled();
    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(latestMock().connect$).toHaveBeenCalledWith();
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });
  });

  it('should reset terminal text state before connect$', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.receiveSubject.next('stale-data');
    expect(api.receivedData.value).toBe('stale-data');

    api.connect$().subscribe();

    expect(api.receivedData.value).toBe('');
  });

  it('should disconnect through the session', () => {
    const { api } = mountHarness();
    api.disconnect$().subscribe();
    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
  });

  it('should send payloads through the session', () => {
    const { api } = mountHarness();
    api.send$('hello').subscribe();
    expect(latestMock().send$).toHaveBeenCalledWith('hello');
  });

  it('should map terminalText$ updates to receivedData', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.receiveSubject.next('chunk-1');
    mock.receiveSubject.next('chunk-2');

    expect(api.receivedData.value).toBe('chunk-1chunk-2');
  });

  it('should set errorMessage from errors$ emissions', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.errorsSubject.next({ message: 'write failed' } as SerialError);
    expect(api.errorMessage.value).toBe('write failed');
  });

  it('should propagate connect$ errors to subscribers', () => {
    const { api } = mountHarness();
    const mock = latestMock();
    const boom = new Error('connect failed');
    mock.connect$.mockReturnValueOnce(throwError(() => boom));

    const errorHandler = vi.fn();
    api.connect$().subscribe({ error: errorHandler });

    expect(errorHandler).toHaveBeenCalledWith(boom);
  });

  it('should clear received data', () => {
    const { api } = mountHarness();
    const mock = latestMock();
    mock.receiveSubject.next('chunk-1');

    expect(api.receivedData.value).toBe('chunk-1');
    api.clearReceivedData();
    expect(api.receivedData.value).toBe('');
  });

  it('should dispose session on unmount', () => {
    const { wrapper } = mountHarness();
    const mock = latestMock();

    wrapper.unmount();

    expect(mock.dispose$).toHaveBeenCalledTimes(1);
  });
});

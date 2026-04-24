import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { mount } from '@vue/test-utils';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

interface MockSession {
  session: SerialSession;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockSession = (): MockSession => {
  const stateSubject = new BehaviorSubject<SerialSessionState>('idle');
  const receiveSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));
  const isBrowserSupported = vi.fn(() => true);

  const session: SerialSession = {
    isBrowserSupported,
    connect$,
    disconnect$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
  };

  return {
    session,
    stateSubject,
    receiveSubject,
    errorsSubject,
    connect$,
    disconnect$,
    send$,
    isBrowserSupported,
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

// Test harness that mounts the composable inside a component so
// `onUnmounted` works as in real usage.
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
    mockSessions = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a session with the initial baud rate', () => {
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
    expect(api.state.value).toBe('idle');
    expect(api.receivedData.value).toBe('');
    expect(api.errorMessage.value).toBe(null);
  });

  it('should forward session state transitions to the state ref', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.stateSubject.next('connecting');
    expect(api.state.value).toBe('connecting');

    mock.stateSubject.next('connected');
    expect(api.state.value).toBe('connected');
  });

  it('should clear errorMessage when returning to idle or connected', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.errorsSubject.next({ message: 'boom' } as SerialError);
    expect(api.errorMessage.value).toBe('boom');

    mock.stateSubject.next('connected');
    expect(api.errorMessage.value).toBe(null);
  });

  it('should connect through the session', () => {
    const { api } = mountHarness();
    api.connect$().subscribe();
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
  });

  it('should recreate the session when baud rate changes', () => {
    const { api } = mountHarness();
    api.connect$(115200).subscribe();

    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
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

  it('should append incoming receive$ chunks to receivedData', () => {
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

  it('should disconnect the session on unmount', () => {
    const { wrapper } = mountHarness();
    const mock = latestMock();

    wrapper.unmount();

    expect(mock.disconnect$).toHaveBeenCalledTimes(1);
  });
});

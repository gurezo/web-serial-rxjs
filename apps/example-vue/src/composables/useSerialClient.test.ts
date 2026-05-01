import type {
  SerialError,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as serialClientCore from '@gurezo/serial-client-core';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { mount } from '@vue/test-utils';
import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialClient } from './useSerialClient';

const SS = webSerialRxjs.SerialSessionState;

interface MockCore {
  core: serialClientCore.SerialClientCore;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  clearTerminalText: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockCore = (supported = true): MockCore => {
  const stateSubject = new BehaviorSubject<SerialSessionState>(SS.Idle);
  const receiveSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const isConnected$ = stateSubject.pipe(
    map((s) => s === SS.Connected),
    distinctUntilChanged(),
  );
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));
  const clearTerminalText = vi.fn();
  const dispose$ = vi.fn(() => of(undefined));
  const isBrowserSupported = vi.fn(() => supported);

  const core: serialClientCore.SerialClientCore = {
    isBrowserSupported,
    connect$,
    disconnect$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable()).text$,
    isConnected$,
    clearTerminalText,
    dispose$,
  };

  return {
    core,
    stateSubject,
    receiveSubject,
    errorsSubject,
    connect$,
    disconnect$,
    send$,
    clearTerminalText,
    dispose$,
    isBrowserSupported,
  };
};

let mockCores: MockCore[] = [];
let nextSupported = true;

vi.mock('@gurezo/serial-client-core', async () => {
  const actual =
    await vi.importActual<typeof import('@gurezo/serial-client-core')>(
      '@gurezo/serial-client-core',
    );
  return {
    ...actual,
    createSerialClientCore: vi.fn(() => {
      const mock = createMockCore(nextSupported);
      mockCores.push(mock);
      return mock.core;
    }),
  };
});

const latestMock = (): MockCore => {
  const mock = mockCores.at(-1);
  if (!mock) {
    throw new Error('createSerialClientCore was not called');
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

  it('should create core with the initial baud rate', () => {
    mountHarness();
    expect(
      vi.mocked(serialClientCore.createSerialClientCore),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(serialClientCore.createSerialClientCore),
    ).toHaveBeenCalledWith(9600);
  });

  it('should initialize with default refs', () => {
    const { api } = mountHarness();
    expect(api.browserSupported.value).toBe(true);
    expect(api.state.value).toBe(SS.Idle);
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

    mock.stateSubject.next(SS.Connecting);
    expect(api.state.value).toBe(SS.Connecting);

    mock.stateSubject.next(SS.Connected);
    expect(api.state.value).toBe(SS.Connected);
  });

  it('should clear errorMessage when returning to idle or connected', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.errorsSubject.next({ message: 'boom' } as SerialError);
    expect(api.errorMessage.value).toBe('boom');

    mock.stateSubject.next(SS.Connected);
    expect(api.errorMessage.value).toBe(null);
  });

  it('should connect through the core', () => {
    const { api } = mountHarness();
    api.connect$().subscribe();
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
  });

  it('should pass baud rate to core connect$', () => {
    const { api } = mountHarness();
    api.connect$(115200).subscribe();

    expect(latestMock().connect$).toHaveBeenCalledWith(115200);
    expect(
      vi.mocked(serialClientCore.createSerialClientCore),
    ).toHaveBeenCalledTimes(1);
  });

  it('should reset terminal text state before connect$', () => {
    const { api } = mountHarness();
    const mock = latestMock();

    mock.receiveSubject.next('stale-data');
    expect(api.receivedData.value).toBe('stale-data');

    api.connect$().subscribe();

    expect(mock.clearTerminalText).toHaveBeenCalledTimes(1);
    expect(api.receivedData.value).toBe('');
  });

  it('should disconnect through the core', () => {
    const { api } = mountHarness();
    api.disconnect$().subscribe();
    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
  });

  it('should send payloads through the core', () => {
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
    expect(mock.clearTerminalText).toHaveBeenCalled();
    expect(api.receivedData.value).toBe('');
  });

  it('should dispose core on unmount', () => {
    const { wrapper } = mountHarness();
    const mock = latestMock();

    wrapper.unmount();

    expect(mock.dispose$).toHaveBeenCalledTimes(1);
  });
});

import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { firstValueFrom, map, of, Subject, throwError, BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSerialClientCore } from './serial-client-core';

const SS = webSerialRxjs.SerialSessionState;

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

const createMockSession = (supported = true): MockSession => {
  const stateSubject = new BehaviorSubject<SerialSessionState>(SS.Idle);
  const receiveSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const isConnected$ = stateSubject.pipe(map((s) => s === SS.Connected));
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));
  const isBrowserSupported = vi.fn(() => supported);
  const portInfoSubject = new BehaviorSubject<SerialPortInfo | null>(null);

  const session: SerialSession = {
    isBrowserSupported,
    connect$,
    disconnect$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable()).text$,
    receiveReplay$: receiveSubject.asObservable(),
    lines$: receiveSubject.asObservable(),
    isConnected$,
    portInfo$: portInfoSubject.asObservable(),
    getPortInfo: () => portInfoSubject.getValue(),
    getCurrentPort: () => null,
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
let nextSupported = true;

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual =
    await vi.importActual<typeof import('@gurezo/web-serial-rxjs')>(
      '@gurezo/web-serial-rxjs',
    );
  return {
    ...actual,
    createSerialSession: vi.fn(() => {
      const mock = createMockSession(nextSupported);
      mockSessions.push(mock);
      return mock.session;
    }),
  };
});

const latestMock = (): MockSession => {
  const mock = mockSessions.at(-1);
  if (!mock) throw new Error('createSerialSession was not called');
  return mock;
};

describe('createSerialClientCore', () => {
  beforeEach(() => {
    mockSessions = [];
    nextSupported = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with an idle session and browser support', async () => {
    const core = createSerialClientCore();
    expect(core.isBrowserSupported()).toBe(true);
    await expect(firstValueFrom(core.state$)).resolves.toBe(SS.Idle);
    await expect(firstValueFrom(core.isConnected$)).resolves.toBe(false);
  });

  it('forwards receive$ and terminalText$ from the current session', async () => {
    const core = createSerialClientCore();
    const receivePending = firstValueFrom(core.receive$);
    const terminalValues: string[] = [];
    const sub = core.terminalText$.subscribe((value) => terminalValues.push(value));
    latestMock().receiveSubject.next('A\r');
    latestMock().receiveSubject.next('B');
    await expect(receivePending).resolves.toBe('A\r');
    expect(terminalValues.at(-1)).toBe('B');
    sub.unsubscribe();
  });

  it('delegates connect$, disconnect$, and send$ to active session', async () => {
    const core = createSerialClientCore();
    await firstValueFrom(core.connect$());
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);

    await firstValueFrom(core.send$('ping'));
    expect(latestMock().send$).toHaveBeenCalledWith('ping');

    await firstValueFrom(core.disconnect$());
    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
  });

  it('recreates session when baud rate changes on connect$', async () => {
    const core = createSerialClientCore(9600);
    expect(mockSessions).toHaveLength(1);
    await firstValueFrom(core.connect$(115200));
    expect(mockSessions).toHaveLength(2);
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });
  });

  it('resets terminal fold when clearTerminalText is called', () => {
    const core = createSerialClientCore();
    const values: string[] = [];
    const sub = core.terminalText$.subscribe((value) => values.push(value));
    latestMock().receiveSubject.next('left');
    core.clearTerminalText();
    latestMock().receiveSubject.next('new');
    expect(values.at(-1)).toBe('new');
    sub.unsubscribe();
  });

  it('forwards errors$ and keeps state stream transition behavior', async () => {
    const core = createSerialClientCore();
    const pending = firstValueFrom(core.errors$);
    const error = new webSerialRxjs.SerialError(
      webSerialRxjs.SerialErrorCode.WRITE_FAILED,
      'boom',
    );
    latestMock().errorsSubject.next(error);
    await expect(pending).resolves.toBe(error);
  });

  it('propagates connect errors to caller', async () => {
    const core = createSerialClientCore();
    const err = new Error('no port');
    latestMock().connect$.mockReturnValueOnce(throwError(() => err));
    await expect(firstValueFrom(core.connect$())).rejects.toBe(err);
  });

  it('dispose$ disconnects and completes resources', async () => {
    const core = createSerialClientCore();
    await firstValueFrom(core.dispose$());
    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
  });
});

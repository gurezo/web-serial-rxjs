import { TestBed } from '@angular/core/testing';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  firstValueFrom,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialClientService } from './serial-client.service';

const SS = webSerialRxjs.SerialSessionState;

interface MockCore {
  session: webSerialRxjs.SerialSession;
  stateSubject: BehaviorSubject<webSerialRxjs.SerialSessionState>;
  receiveSubject: Subject<string>;
  errorsSubject: Subject<webSerialRxjs.SerialError>;
  isConnectedSubject: BehaviorSubject<boolean>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockCore = (): MockCore => {
  const stateSubject = new BehaviorSubject<webSerialRxjs.SerialSessionState>(
    SS.Idle,
  );
  const receiveSubject = new Subject<string>();
  const errorsSubject = new Subject<webSerialRxjs.SerialError>();
  const isConnectedSubject = new BehaviorSubject(false);
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const dispose$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));
  const isBrowserSupported = vi.fn(() => true);

  const session: webSerialRxjs.SerialSession = {
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

let mockSessions: MockCore[] = [];

vi.mock('@gurezo/web-serial-rxjs', async () => {
  const actual = await vi.importActual<typeof import('@gurezo/web-serial-rxjs')>(
    '@gurezo/web-serial-rxjs',
  );
  return {
    ...actual,
    createSerialSession: vi.fn(() => {
      const mock = createMockCore();
      mockSessions.push(mock);
      return mock.session;
    }),
  };
});

const latestMock = (): MockCore => {
  const mock = mockSessions.at(-1);
  if (!mock) {
    throw new Error('createSerialSession was not called');
  }
  return mock;
};

describe('SerialClientService', () => {
  let service: SerialClientService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessions = [];
    TestBed.configureTestingModule({});
    service = TestBed.inject(SerialClientService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create session on construction', () => {
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledTimes(1);
    expect(service).toBeTruthy();
  });

  it('should expose browser support via the session', () => {
    expect(service.isBrowserSupported()).toBe(true);
    expect(latestMock().isBrowserSupported).toHaveBeenCalled();
  });

  it('should emit the initial idle state on state$', async () => {
    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SS.Idle);
  });

  it('should forward session state transitions', async () => {
    const mock = latestMock();
    mock.stateSubject.next(SS.Connecting);
    mock.stateSubject.next(SS.Connected);

    const state = await firstValueFrom(service.state$);
    expect(state).toBe(SS.Connected);
  });

  it('should connect through the session', async () => {
    await firstValueFrom(service.connect$());
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
  });

  it('should recreate session when baud rate changes', async () => {
    const first = mockSessions[0];
    await firstValueFrom(service.connect$(115200));
    expect(first.connect$).not.toHaveBeenCalled();
    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(latestMock().connect$).toHaveBeenCalledWith();
    expect(vi.mocked(webSerialRxjs.createSerialSession)).toHaveBeenLastCalledWith({
      baudRate: 115200,
    });
  });

  it('should disconnect through the session', async () => {
    await firstValueFrom(service.disconnect$());
    expect(latestMock().disconnect$).toHaveBeenCalledTimes(1);
  });

  it('should send payloads through the session', async () => {
    await firstValueFrom(service.send$('hello'));
    expect(latestMock().send$).toHaveBeenCalledWith('hello');
  });

  it('should propagate connect errors', async () => {
    const mock = latestMock();
    const boom = new Error('connect failed');
    mock.connect$.mockReturnValueOnce(throwError(() => boom));

    await expect(firstValueFrom(service.connect$())).rejects.toBe(boom);
  });

  it('should emit each chunk on receive$', async () => {
    const mock = latestMock();
    const pending = firstValueFrom(service.receive$);
    mock.receiveSubject.next('chunk-1');
    await expect(pending).resolves.toBe('chunk-1');
  });

  it('should fold carriage returns in terminalText$', () => {
    const mock = latestMock();
    const values: string[] = [];
    const sub = service.terminalText$.subscribe((t) => values.push(t));
    mock.receiveSubject.next('A\r');
    mock.receiveSubject.next('B');
    expect(values.at(-1)).toBe('B');
    sub.unsubscribe();
  });

  it('bumpTerminalBufferEpoch resets terminalText$ emission chain', () => {
    const values: string[] = [];
    const sub = service.terminalText$.subscribe((t) => values.push(t));
    latestMock().receiveSubject.next('before-clear');
    service.bumpTerminalBufferEpoch();
    latestMock().receiveSubject.next('after-clear');
    expect(values.at(-1)).toBe('after-clear');
    sub.unsubscribe();
  });

  it('should forward errors$ emissions', async () => {
    const mock = latestMock();
    const pending = firstValueFrom(service.errors$);
    const error = new webSerialRxjs.SerialError(
      webSerialRxjs.SerialErrorCode.WRITE_FAILED,
      'boom',
    );
    mock.errorsSubject.next(error);
    await expect(pending).resolves.toBe(error);
  });

  it('should dispose session on destroy', () => {
    service.ngOnDestroy();
    expect(latestMock().dispose$).toHaveBeenCalledTimes(1);
  });
});

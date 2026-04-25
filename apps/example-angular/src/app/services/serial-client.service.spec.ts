import { TestBed } from '@angular/core/testing';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  distinctUntilChanged,
  firstValueFrom,
  map,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SerialClientService } from './serial-client.service';

const SS = webSerialRxjs.SerialSessionState;

interface MockSession {
  session: SerialSession;
  stateSubject: BehaviorSubject<webSerialRxjs.SerialSessionState>;
  receiveSubject: Subject<string>;
  linesSubject: Subject<string>;
  errorsSubject: Subject<webSerialRxjs.SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockSession = (): MockSession => {
  const stateSubject = new BehaviorSubject<webSerialRxjs.SerialSessionState>(
    SS.Idle,
  );
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const errorsSubject = new Subject<webSerialRxjs.SerialError>();
  const isConnected$ = stateSubject.pipe(
    map((s) => s === SS.Connected),
    distinctUntilChanged(),
  );
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
    lines$: linesSubject.asObservable(),
    isConnected$,
  };

  return {
    session,
    stateSubject,
    receiveSubject,
    linesSubject,
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

  it('should create a session on construction', () => {
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledTimes(1);
    expect(vi.mocked(webSerialRxjs.createSerialSession)).toHaveBeenCalledWith({
      baudRate: 9600,
    });
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

  it('should recreate the session when baud rate changes', async () => {
    await firstValueFrom(service.connect$(115200));

    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });
    expect(latestMock().connect$).toHaveBeenCalledTimes(1);
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

  it('should emit each line on lines$', async () => {
    const mock = latestMock();
    const pending = firstValueFrom(service.lines$);
    mock.linesSubject.next('chunk-1');
    await expect(pending).resolves.toBe('chunk-1');
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
});

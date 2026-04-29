import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { act, renderHook } from '@testing-library/react';
import { BehaviorSubject, distinctUntilChanged, map, of, Subject, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialSession } from './useSerialSession';

const SS = webSerialRxjs.SerialSessionState;

interface MockSession {
  session: SerialSession;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  linesSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
  isBrowserSupported: ReturnType<typeof vi.fn>;
}

const createMockSession = (
  supported = true,
): MockSession => {
  const stateSubject = new BehaviorSubject<SerialSessionState>(SS.Idle);
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const isConnected$ = stateSubject.pipe(
    map((s) => s === SS.Connected),
    distinctUntilChanged(),
  );
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
    receiveReplay$: receiveSubject.asObservable(),
    lines$: linesSubject.asObservable(),
    isConnected$,
    portInfo$: portInfoSubject.asObservable(),
    getPortInfo: () => portInfoSubject.getValue(),
    getCurrentPort: () => null,
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

describe('useSerialSession', () => {
  beforeEach(() => {
    mockSessions = [];
    nextSupported = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('初期状態は idle、receivedData は空、errorMessage は null', () => {
    const { result } = renderHook(() => useSerialSession());
    expect(result.current.state).toBe(SS.Idle);
    expect(result.current.isConnected).toBe(false);
    expect(result.current.receivedData).toBe('');
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.browserSupported).toBe(true);
  });

  it('browserSupported は session.isBrowserSupported() の結果を反映する', () => {
    nextSupported = false;
    const { result } = renderHook(() => useSerialSession());
    expect(result.current.browserSupported).toBe(false);
  });

  it('state$ の変化が state に反映される', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() => latestMock().stateSubject.next(SS.Connecting));
    expect(result.current.state).toBe(SS.Connecting);
    act(() => latestMock().stateSubject.next(SS.Connected));
    expect(result.current.state).toBe(SS.Connected);
  });

  it('receive$ のチャンクは createTerminalBuffer 経由で receivedData に反映される', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() => {
      latestMock().receiveSubject.next('foo');
      latestMock().receiveSubject.next('bar');
    });
    expect(result.current.receivedData).toBe('foobar');
  });

  it('errors$ の値が errorMessage に反映される', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() =>
      latestMock().errorsSubject.next({ message: 'boom' } as SerialError),
    );
    expect(result.current.errorMessage).toBe('boom');
  });

  it('state$ が connected / idle になると errorMessage がクリアされる', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() =>
      latestMock().errorsSubject.next({ message: 'boom' } as SerialError),
    );
    expect(result.current.errorMessage).toBe('boom');
    act(() => latestMock().stateSubject.next(SS.Connected));
    expect(result.current.errorMessage).toBeNull();
  });

  it('clearReceivedData で receivedData が空になる', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() => latestMock().receiveSubject.next('data'));
    expect(result.current.receivedData).toBe('data');
    act(() => result.current.clearReceivedData());
    expect(result.current.receivedData).toBe('');
  });

  it('connect$ / disconnect$ / send$ は session の対応メソッドへ委譲する', () => {
    const { result } = renderHook(() => useSerialSession());

    act(() => {
      result.current.connect$().subscribe();
    });
    expect(latestMock().connect$).toHaveBeenCalled();

    act(() => {
      result.current.send$('ping').subscribe();
    });
    expect(latestMock().send$).toHaveBeenCalledWith('ping');

    act(() => {
      result.current.disconnect$().subscribe();
    });
    expect(latestMock().disconnect$).toHaveBeenCalled();
  });

  it('connect$(baudRate) で baudRate が変わると新しい session を生成する', () => {
    const { result } = renderHook(() => useSerialSession(9600));
    expect(mockSessions).toHaveLength(1);

    act(() => {
      result.current.connect$(115200).subscribe();
    });
    expect(mockSessions).toHaveLength(2);

    act(() => latestMock().stateSubject.next(SS.Connecting));
    expect(result.current.state).toBe(SS.Connecting);
  });

  it('connect$ が失敗すると subscriber にエラーが渡る', () => {
    const { result } = renderHook(() => useSerialSession());
    const err = new Error('no port');
    latestMock().connect$.mockReturnValueOnce(throwError(() => err));

    const onError = vi.fn();
    act(() => {
      result.current.connect$().subscribe({ error: onError });
    });
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('unmount 時に session の disconnect$ を呼び、購読を解除する', () => {
    const { unmount } = renderHook(() => useSerialSession());
    const mock = latestMock();
    unmount();
    expect(mock.disconnect$).toHaveBeenCalled();
  });
});

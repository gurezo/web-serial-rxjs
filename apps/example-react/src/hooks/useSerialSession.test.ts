import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { act, renderHook } from '@testing-library/react';
import { createElement, StrictMode, type ReactNode } from 'react';
import {
  BehaviorSubject,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialSession } from './useSerialSession';

const SS = webSerialRxjs.SerialSessionState;

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
  const stateSubject = new BehaviorSubject<SerialSessionState>(SS.Idle);
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
  if (!mock) throw new Error('createSerialSession was not called');
  return mock;
};

describe('useSerialSession', () => {
  beforeEach(() => {
    mockCores = [];
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

  it('createSerialSession に初期ボーレートを渡す', () => {
    renderHook(() => useSerialSession(9600));
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledWith({ baudRate: 9600 });
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

  it('terminalText$ の更新が receivedData に反映される', () => {
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

  it('connect$(baudRate) で新しいボーレートの session を作成する', () => {
    const { result } = renderHook(() => useSerialSession(9600));
    expect(mockCores).toHaveLength(1);
    const first = mockCores[0];

    act(() => {
      result.current.connect$(115200).subscribe();
    });
    expect(first.connect$).not.toHaveBeenCalled();
    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(latestMock().connect$).toHaveBeenCalledWith();
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });

    act(() => latestMock().stateSubject.next(SS.Connecting));
    expect(result.current.state).toBe(SS.Connecting);
  });

  it('connect$ 実行時に terminalText の表示状態をリセットする', () => {
    const { result } = renderHook(() => useSerialSession());
    act(() => latestMock().receiveSubject.next('stale-data'));
    expect(result.current.receivedData).toBe('stale-data');

    act(() => {
      result.current.connect$().subscribe();
    });

    expect(result.current.receivedData).toBe('');
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

  it('unmount 時に dispose$ を呼ぶ', () => {
    const { unmount } = renderHook(() => useSerialSession());
    const mock = latestMock();
    unmount();
    expect(mock.dispose$).toHaveBeenCalled();
  });

  it('StrictMode の二重マウントでも例外なくセッションを購読できる (issue #328)', () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StrictMode, null, children);

    // StrictMode 配下では effect が「setup → cleanup → setup」と二重実行される。
    // renderHook 自体が throw しないこと（pipe を null 参照しないこと）を確認する。
    const { result } = renderHook(() => useSerialSession(), { wrapper });

    // StrictMode の再 setup で active な subscription は最後の mock セッション側に
    // 切り替わるため、その state$ を更新したらフックの state に反映される。
    act(() => latestMock().stateSubject.next(SS.Connecting));
    expect(result.current.state).toBe(SS.Connecting);
  });
});

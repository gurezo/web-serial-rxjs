import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  of,
  Subject,
  throwError,
} from 'rxjs';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSerialSession } from './useSerialSession';

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

vi.mock('svelte', async () => {
  const actual = await vi.importActual<typeof import('svelte')>('svelte');
  return {
    ...actual,
    onDestroy: vi.fn((fn: () => void) => {
      (globalThis as unknown as { __svelteCleanup?: () => void }).__svelteCleanup =
        fn;
    }),
  };
});

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
    (globalThis as unknown as { __svelteCleanup?: () => void }).__svelteCleanup =
      undefined;
  });

  afterEach(() => {
    const cleanup = (
      globalThis as unknown as { __svelteCleanup?: () => void }
    ).__svelteCleanup;
    cleanup?.();
    (globalThis as unknown as { __svelteCleanup?: () => void }).__svelteCleanup =
      undefined;
    vi.clearAllMocks();
  });

  it('初期状態は idle、receivedData は空、errorMessage は null、browserSupported は true', () => {
    const s = useSerialSession();
    expect(get(s.state)).toEqual({ status: SS.Idle });
    expect(get(s.isConnected)).toBe(false);
    expect(get(s.receivedData)).toBe('');
    expect(get(s.errorMessage)).toBeNull();
    expect(get(s.browserSupported)).toBe(true);
  });

  it('createSerialSession に初期ボーレートを渡す', () => {
    useSerialSession(9600);
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledWith({ baudRate: 9600 });
  });

  it('browserSupported は session.isBrowserSupported() の結果を反映する', () => {
    nextSupported = false;
    const s = useSerialSession();
    expect(get(s.browserSupported)).toBe(false);
  });

  it('state$ の変化が state に反映される', () => {
    const s = useSerialSession();
    const unsub = s.state.subscribe(() => void 0);
    latestMock().stateSubject.next({ status: SS.Connecting });
    expect(get(s.state)).toEqual({ status: SS.Connecting });
    latestMock().stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    expect(get(s.state)).toEqual({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    unsub();
  });

  it('terminalText$ の更新が receivedData に反映される', () => {
    const s = useSerialSession();
    const unsub = s.receivedData.subscribe(() => void 0);
    latestMock().receiveSubject.next('foo');
    latestMock().receiveSubject.next('bar');
    expect(get(s.receivedData)).toBe('foobar');
    unsub();
  });

  it('errors$ の値が errorMessage に反映される', () => {
    const s = useSerialSession();
    const unsub = s.errorMessage.subscribe(() => void 0);
    latestMock().errorsSubject.next({ message: 'boom' } as SerialError);
    expect(get(s.errorMessage)).toBe('boom');
    unsub();
  });

  it('state$ が connected / idle になると errorMessage がクリアされる', () => {
    const s = useSerialSession();
    const unsub = s.errorMessage.subscribe(() => void 0);
    latestMock().errorsSubject.next({ message: 'boom' } as SerialError);
    expect(get(s.errorMessage)).toBe('boom');
    latestMock().stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } });
    expect(get(s.errorMessage)).toBeNull();
    unsub();
  });

  it('clearReceivedData で receivedData が空になる', () => {
    const s = useSerialSession();
    const unsub = s.receivedData.subscribe(() => void 0);
    latestMock().receiveSubject.next('data');
    expect(get(s.receivedData)).toBe('data');
    s.clearReceivedData();
    expect(get(s.receivedData)).toBe('');
    unsub();
  });

  it('connect$ / disconnect$ / send$ は session の対応メソッドへ委譲する', () => {
    const s = useSerialSession();

    s.connect$().subscribe();
    expect(latestMock().connect$).toHaveBeenCalled();

    s.send$('ping').subscribe();
    expect(latestMock().send$).toHaveBeenCalledWith('ping');

    s.disconnect$().subscribe();
    expect(latestMock().disconnect$).toHaveBeenCalled();
  });

  it('connect$(baudRate) は新しい session を作成する', () => {
    const s = useSerialSession(9600);
    expect(mockCores).toHaveLength(1);
    const first = mockCores[0];

    const unsub = s.state.subscribe(() => void 0);
    s.connect$(115200).subscribe();
    expect(first.connect$).not.toHaveBeenCalled();
    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(latestMock().connect$).toHaveBeenCalledWith();
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });

    latestMock().stateSubject.next({ status: SS.Connecting });
    expect(get(s.state)).toEqual({ status: SS.Connecting });
    unsub();
  });

  it('connect$ が失敗すると subscriber にエラーが渡る', () => {
    const s = useSerialSession();
    const err = new Error('no port');
    latestMock().connect$.mockReturnValueOnce(throwError(() => err));

    const onError = vi.fn();
    s.connect$().subscribe({ error: onError });
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('onDestroy で session.dispose$ が呼ばれる', () => {
    useSerialSession();
    const mock = latestMock();
    const cleanup = (
      globalThis as unknown as { __svelteCleanup?: () => void }
    ).__svelteCleanup;
    cleanup?.();
    expect(mock.dispose$).toHaveBeenCalled();
  });
});

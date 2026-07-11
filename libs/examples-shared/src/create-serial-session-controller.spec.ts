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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSerialSessionController } from './create-serial-session-controller';

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
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable())
      .text$,
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

describe('createSerialSessionController', () => {
  beforeEach(() => {
    mockCores = [];
    nextSupported = true;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('createSerialSession に初期ボーレートを渡す', () => {
    createSerialSessionController({ initialBaudRate: 9600 });
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenCalledWith({ baudRate: 9600 });
  });

  it('isBrowserSupported は session の結果を返す', () => {
    nextSupported = false;
    const controller = createSerialSessionController();
    expect(controller.isBrowserSupported()).toBe(false);
  });

  it('state$ / terminalText$ / errors$ を配信する', () => {
    const controller = createSerialSessionController();
    const mock = latestMock();
    const states: SerialSessionState[] = [];
    const texts: string[] = [];
    const errors: SerialError[] = [];

    const stateSub = controller.state$.subscribe((v) => states.push(v));
    const textSub = controller.terminalText$.subscribe((v) => texts.push(v));
    const errorSub = controller.errors$.subscribe((v) => errors.push(v));

    mock.stateSubject.next({ status: SS.Connecting });
    mock.receiveSubject.next('hello');
    mock.errorsSubject.next({ message: 'boom' } as SerialError);

    expect(states.at(-1)).toEqual({ status: SS.Connecting });
    expect(texts.at(-1)).toBe('hello');
    expect(errors.at(-1)?.message).toBe('boom');

    stateSub.unsubscribe();
    textSub.unsubscribe();
    errorSub.unsubscribe();
  });

  it('connect$ / disconnect$ / send$ は session の対応メソッドへ委譲する', () => {
    const controller = createSerialSessionController();
    const mock = latestMock();

    controller.connect$().subscribe();
    expect(mock.connect$).toHaveBeenCalled();

    controller.send$('ping').subscribe();
    expect(mock.send$).toHaveBeenCalledWith('ping');

    controller.disconnect$().subscribe();
    expect(mock.disconnect$).toHaveBeenCalled();
  });

  it('connect$(baudRate) で新しいボーレートの session を作成する', () => {
    const controller = createSerialSessionController({ initialBaudRate: 9600 });
    const first = mockCores[0];

    controller.connect$(115200).subscribe();

    expect(first.dispose$).toHaveBeenCalledTimes(1);
    expect(latestMock().connect$).toHaveBeenCalledWith();
    expect(
      vi.mocked(webSerialRxjs.createSerialSession),
    ).toHaveBeenLastCalledWith({ baudRate: 115200 });
  });

  it('connect$(baudRate) 後は新 session の terminalText$ のみ反映する', () => {
    const controller = createSerialSessionController({ initialBaudRate: 9600 });
    const first = mockCores[0];
    const texts: string[] = [];
    const textSub = controller.terminalText$.subscribe((v) => texts.push(v));

    first.receiveSubject.next('old');
    expect(texts.at(-1)).toBe('old');

    controller.connect$(115200).subscribe();
    latestMock().receiveSubject.next('new');
    expect(texts.at(-1)).toBe('new');

    textSub.unsubscribe();
  });

  it('resetTerminalBuffer は購読中でも安全に呼び出せる', () => {
    const controller = createSerialSessionController();
    const mock = latestMock();
    const texts: string[] = [];
    const textSub = controller.terminalText$.subscribe((v) => texts.push(v));

    mock.receiveSubject.next('data');
    expect(() => controller.resetTerminalBuffer()).not.toThrow();
    mock.receiveSubject.next('more');
    expect(texts.at(-1)).toBe('more');

    textSub.unsubscribe();
  });

  it('connect$ が失敗すると subscriber にエラーが渡る', () => {
    const controller = createSerialSessionController();
    const err = new Error('no port');
    latestMock().connect$.mockReturnValueOnce(throwError(() => err));

    const onError = vi.fn();
    controller.connect$().subscribe({ error: onError });
    expect(onError).toHaveBeenCalledWith(err);
  });

  it('dispose で dispose$ を呼ぶ', () => {
    const controller = createSerialSessionController();
    const mock = latestMock();

    controller.dispose();
    expect(mock.dispose$).toHaveBeenCalled();
  });
});

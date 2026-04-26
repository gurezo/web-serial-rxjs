import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, distinctUntilChanged, map, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

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

const createMockSession = (): MockSession => {
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
  const isBrowserSupported = vi.fn(() => true);
  const portInfoSubject = new BehaviorSubject<SerialPortInfo | null>(null);

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
  if (!mock) throw new Error('createSerialSession was not called');
  return mock;
};

describe('App', () => {
  beforeEach(() => {
    mockSessions = [];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('ヘッダとサブタイトルを表示する', () => {
    render(<App />);
    expect(
      screen.getByText('Web Serial RxJS - React Example'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'React カスタムフックを使用した Web Serial API のサンプル',
      ),
    ).toBeInTheDocument();
  });

  it('ブラウザサポート状況を表示する', () => {
    render(<App />);
    expect(
      screen.getByText('ブラウザは Web Serial API をサポートしています。'),
    ).toBeInTheDocument();
  });

  it('接続・切断ボタンが存在する', () => {
    render(<App />);
    expect(screen.getByText('接続')).toBeInTheDocument();
    expect(screen.getByText('切断')).toBeInTheDocument();
  });

  it('ボーレートのデフォルト値は 9600', () => {
    render(<App />);
    const baudRateSelect = screen.getByLabelText('ボーレート');
    expect(baudRateSelect).toHaveValue('9600');
  });

  it('ボーレートを変更できる', async () => {
    const user = userEvent.setup();
    render(<App />);
    const baudRateSelect = screen.getByLabelText('ボーレート');
    await user.selectOptions(baudRateSelect, '115200');
    expect(baudRateSelect).toHaveValue('115200');
  });

  it('state$ が SerialSessionState.Connected なら成功ステータスを表示する', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('接続'));
    act(() => latestMock().stateSubject.next(SS.Connected));

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });
    expect(latestMock().connect$).toHaveBeenCalled();
  });

  it('切断ボタンで disconnect$ が呼ばれ idle 表示になる', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('接続'));
    act(() => latestMock().stateSubject.next(SS.Connected));
    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText('切断'));
    act(() => latestMock().stateSubject.next(SS.Idle));

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続していません。'),
      ).toBeInTheDocument();
    });
    expect(latestMock().disconnect$).toHaveBeenCalled();
  });

  it('送信ボタンで send$ が呼ばれ、入力欄がクリアされる', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('接続'));
    act(() => latestMock().stateSubject.next(SS.Connected));
    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });

    const sendInput = screen.getByPlaceholderText('送信するテキストを入力...');
    await user.type(sendInput, 'hello');
    await user.click(screen.getByText('送信'));

    await waitFor(() => expect(sendInput).toHaveValue(''));
    expect(latestMock().send$).toHaveBeenCalledWith('hello\n');
  });

  it('行区切り受信が受信データ欄に蓄積される', async () => {
    render(<App />);

    act(() => {
      latestMock().linesSubject.next('foo');
      latestMock().linesSubject.next('bar');
    });

    await waitFor(() => {
      const textarea = screen.getByLabelText(
        '受信データ',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('foo\nbar\n');
    });
  });

  it('errors$ 発火時にエラーメッセージを表示する', async () => {
    render(<App />);

    const err = { message: 'write failed' } as SerialError;
    act(() => latestMock().errorsSubject.next(err));

    await waitFor(() => {
      expect(screen.getByText('エラー: write failed')).toBeInTheDocument();
    });
  });

  it('クリアボタンで受信データが空になる', async () => {
    const user = userEvent.setup();
    render(<App />);

    act(() => latestMock().linesSubject.next('data'));
    await waitFor(() => {
      const textarea = screen.getByLabelText(
        '受信データ',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('data\n');
    });

    await user.click(screen.getByText('クリア'));
    const textarea = screen.getByLabelText(
      '受信データ',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });
});

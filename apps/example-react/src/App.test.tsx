import type {
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import * as webSerialRxjs from '@gurezo/web-serial-rxjs';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

const SS = webSerialRxjs.SerialSessionStatus;

interface MockSession {
  session: SerialSession;
  stateSubject: BehaviorSubject<SerialSessionState>;
  receiveSubject: Subject<string>;
  linesSubject: Subject<string>;
  errorsSubject: Subject<SerialError>;
  connect$: ReturnType<typeof vi.fn>;
  disconnect$: ReturnType<typeof vi.fn>;
  dispose$: ReturnType<typeof vi.fn>;
  send$: ReturnType<typeof vi.fn>;
}

const createMockSession = (): MockSession => {
  const stateSubject = new BehaviorSubject<SerialSessionState>({ status: SS.Idle });
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const errorsSubject = new Subject<SerialError>();
  const connect$ = vi.fn(() => of(undefined));
  const disconnect$ = vi.fn(() => of(undefined));
  const dispose$ = vi.fn(() => of(undefined));
  const send$ = vi.fn(() => of(undefined));

  const session: SerialSession = {
    connect$,
    disconnect$,
    dispose$,
    send$,
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    terminalText$: webSerialRxjs.createTerminalBuffer(receiveSubject.asObservable()).text$,
    lines$: linesSubject.asObservable(),
  };

  return {
    session,
    stateSubject,
    receiveSubject,
    linesSubject,
    errorsSubject,
    connect$,
    disconnect$,
    dispose$,
    send$,
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
    isWebSerialSupported: vi.fn(() => true),
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
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
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

  it('利用条件とブラウザサポート状況を表示する', () => {
    render(<App />);
    expect(screen.getByText('利用条件')).toBeInTheDocument();
    expect(
      screen.getByText(/HTTPS または localhost/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'ブラウザは Web Serial API をサポートしており、セキュアコンテキストで実行中です。',
      ),
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

  it('state$ が SerialSessionStatus.Connected なら成功ステータスを表示する', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByText('接続'));
    act(() => latestMock().stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } }));

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
    act(() => latestMock().stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } }));
    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByText('切断'));
    act(() => latestMock().stateSubject.next({ status: SS.Idle }));

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
    act(() => latestMock().stateSubject.next({ status: SS.Connected, portInfo: { usbVendorId: 0, usbProductId: 0 } }));
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

  it('receive$ のチャンクが受信データ欄に蓄積される', async () => {
    render(<App />);

    act(() => {
      latestMock().receiveSubject.next('foo');
      latestMock().receiveSubject.next('bar');
    });

    await waitFor(() => {
      const textarea = screen.getByLabelText(
        '受信データ',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('foobar');
    });
  });

  it('errors$ 発火時にエラーメッセージを表示する', async () => {
    render(<App />);

    const err = new webSerialRxjs.SerialError(
      webSerialRxjs.SerialErrorCode.WRITE_FAILED,
      'write failed',
    );
    act(() => latestMock().errorsSubject.next(err));

    await waitFor(() => {
      expect(screen.getByText('エラー: write failed')).toBeInTheDocument();
      expect(screen.getByTestId('session-error-message')).toHaveTextContent(
        'write failed',
      );
      expect(screen.getByTestId('session-error-code')).toHaveTextContent(
        'WRITE_FAILED',
      );
    });
  });

  it('セッション状態パネルに status と VID/PID を表示する', async () => {
    render(<App />);

    expect(screen.getByTestId('session-status')).toHaveTextContent(
      'idle（アイドル）',
    );
    expect(screen.getByTestId('session-error-empty')).toBeInTheDocument();

    act(() =>
      latestMock().stateSubject.next({
        status: SS.Connected,
        portInfo: { usbVendorId: 0x2341, usbProductId: 0x0043 },
      }),
    );

    await waitFor(() => {
      expect(screen.getByTestId('session-status')).toHaveTextContent(
        'connected（接続済み）',
      );
      expect(screen.getByTestId('session-port-info')).toHaveTextContent(
        'Vendor ID: 0x2341 / Product ID: 0x0043',
      );
    });
  });

  it('エラークリアボタンで最新エラー表示を消せる', async () => {
    const user = userEvent.setup();
    render(<App />);

    act(() =>
      latestMock().errorsSubject.next(
        new webSerialRxjs.SerialError(
          webSerialRxjs.SerialErrorCode.WRITE_FAILED,
          'write failed',
        ),
      ),
    );
    await waitFor(() => {
      expect(screen.getByTestId('session-error-code')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('clear-error'));
    expect(screen.getByTestId('session-error-empty')).toBeInTheDocument();
  });

  it('クリアボタンで受信データが空になる', async () => {
    const user = userEvent.setup();
    render(<App />);

    act(() => latestMock().receiveSubject.next('data'));
    await waitFor(() => {
      const textarea = screen.getByLabelText(
        '受信データ',
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe('data');
    });

    await user.click(screen.getByText('クリア'));
    const textarea = screen.getByLabelText(
      '受信データ',
    ) as HTMLTextAreaElement;
    expect(textarea.value).toBe('');
  });
});

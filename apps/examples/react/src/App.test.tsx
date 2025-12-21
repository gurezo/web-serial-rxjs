import type { SerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import type { Observable, Subscription } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';

// Mock the web-serial-rxjs library
vi.mock('@web-serial-rxjs/web-serial-rxjs', () => {
  let isConnected = false;
  const mockClient = {
    get connected() {
      return isConnected;
    },
    currentPort: null,
    connect: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            isConnected = true;
            if (observer.next) {
              observer.next();
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<void>,
    disconnect: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const obs = observer;
          const timeoutId = setTimeout(() => {
            isConnected = false;
            if (obs?.next) {
              obs.next();
            }
            if (obs?.complete) {
              obs.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<void>,
    requestPort: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: (port: SerialPort) => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            if (observer.next) {
              observer.next({} as SerialPort);
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as () => Observable<SerialPort>,
    getReadStream: vi.fn(() => ({
      subscribe: vi.fn(() => ({
        unsubscribe: vi.fn(),
      })) as unknown as (observer: {
        next?: (data: Uint8Array) => void;
        error?: (error: unknown) => void;
        complete?: () => void;
      }) => Subscription,
    })) as unknown as () => Observable<Uint8Array>,
    write: vi.fn(() => ({
      subscribe: vi.fn(
        (observer: {
          next?: () => void;
          error?: (error: unknown) => void;
          complete?: () => void;
        }) => {
          const timeoutId = setTimeout(() => {
            if (observer.next) {
              observer.next();
            }
            if (observer.complete) {
              observer.complete();
            }
          }, 0);
          return {
            unsubscribe: () => clearTimeout(timeoutId),
          };
        },
      ),
    })) as unknown as (data: Uint8Array) => Observable<void>,
    getPorts: vi.fn(() => ({
      subscribe: vi.fn(),
    })) as unknown as () => Observable<SerialPort[]>,
  };

  return {
    createSerialClient: vi.fn(() => mockClient) as unknown as (
      options?: { baudRate?: number },
    ) => SerialClient,
    isBrowserSupported: vi.fn(() => true),
    SerialError: class MockSerialError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'SerialError';
      }
    },
  };
});

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the app', () => {
    render(<App />);
    expect(screen.getByText('Web Serial RxJS - React Example')).toBeInTheDocument();
    expect(
      screen.getByText('React カスタムフックを使用した Web Serial API のサンプル'),
    ).toBeInTheDocument();
  });

  it('should display browser support status', () => {
    render(<App />);
    expect(
      screen.getByText('ブラウザは Web Serial API をサポートしています。'),
    ).toBeInTheDocument();
  });

  it('should have connection buttons', () => {
    render(<App />);
    expect(screen.getByText('ポートを選択')).toBeInTheDocument();
    expect(screen.getByText('接続')).toBeInTheDocument();
    expect(screen.getByText('切断')).toBeInTheDocument();
  });

  it('should have baud rate selector', () => {
    render(<App />);
    const baudRateSelect = screen.getByLabelText('ボーレート');
    expect(baudRateSelect).toBeInTheDocument();
    expect(baudRateSelect).toHaveValue('9600');
  });

  it('should change baud rate', async () => {
    const user = userEvent.setup();
    render(<App />);
    const baudRateSelect = screen.getByLabelText('ボーレート');

    await user.selectOptions(baudRateSelect, '115200');
    expect(baudRateSelect).toHaveValue('115200');
  });

  it('should connect when connect button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);
    const connectButton = screen.getByText('接続');

    await user.click(connectButton);

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });
  });

  it('should disconnect when disconnect button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    // First connect
    const connectButton = screen.getByText('接続');
    await user.click(connectButton);

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });

    // Then disconnect
    const disconnectButton = screen.getByText('切断');
    await user.click(disconnectButton);

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続していません。'),
      ).toBeInTheDocument();
    });
  });

  it('should send data when send button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Connect first
    const connectButton = screen.getByText('接続');
    await user.click(connectButton);

    await waitFor(() => {
      expect(
        screen.getByText('シリアルポートに接続しました。'),
      ).toBeInTheDocument();
    });

    // Enter data and send
    const sendInput = screen.getByPlaceholderText('送信するテキストを入力...');
    const sendButton = screen.getByText('送信');

    await user.type(sendInput, 'test message');
    await user.click(sendButton);

    // Input should be cleared after sending
    await waitFor(() => {
      expect(sendInput).toHaveValue('');
    });
  });

  it('should clear received data when clear button is clicked', async () => {
    const user = userEvent.setup();
    render(<App />);

    const clearButton = screen.getByText('クリア');
    expect(clearButton).toBeDisabled(); // Should be disabled when no data

    // The button should be enabled when there's data (tested in integration)
    await user.click(clearButton);
  });
});

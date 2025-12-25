import {
  createSerialClient,
  isBrowserSupported,
  SerialClient,
  SerialError,
} from '@gurezo/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';
import type { Subscription } from 'rxjs';

/**
 * SerialClient の接続状態を表す型
 */
export interface SerialConnectionState {
  /** 接続中かどうか */
  connected: boolean;
  /** 接続中かどうか */
  connecting: boolean;
  /** 切断中かどうか */
  disconnecting: boolean;
  /** エラーが発生したかどうか */
  error: string | null;
}

/**
 * useSerialClient フックの戻り値の型
 */
export interface UseSerialClientReturn {
  /** ブラウザサポート状態 */
  browserSupported: boolean;
  /** 接続状態 */
  connectionState: SerialConnectionState;
  /** 受信したデータ */
  receivedData: string;
  /** 接続を開始する関数 */
  connect: (baudRate?: number) => Promise<void>;
  /** 切断する関数 */
  disconnect: () => Promise<void>;
  /** ポートをリクエストする関数 */
  requestPort: () => Promise<void>;
  /** データを送信する関数 */
  send: (data: string) => Promise<void>;
  /** 受信データをクリアする関数 */
  clearReceivedData: () => void;
}

/**
 * Web Serial API を使用するためのカスタムフック
 *
 * @param initialBaudRate - 初期ボーレート（デフォルト: 9600）
 * @returns SerialClient の操作と状態を提供するオブジェクト
 */
export function useSerialClient(initialBaudRate = 9600): UseSerialClientReturn {
  const [browserSupported, setBrowserSupported] = useState(false);
  const [connectionState, setConnectionState] = useState<SerialConnectionState>(
    {
      connected: false,
      connecting: false,
      disconnecting: false,
      error: null,
    },
  );
  const [receivedData, setReceivedData] = useState('');

  const clientRef = useRef<SerialClient | null>(null);
  const readSubscriptionRef = useRef<Subscription | null>(null);
  const baudRateRef = useRef(initialBaudRate);

  // ブラウザサポートをチェック
  useEffect(() => {
    const supported = isBrowserSupported();
    setBrowserSupported(supported);
  }, []);

  // クリーンアップ: コンポーネントのアンマウント時に接続を切断
  useEffect(() => {
    return () => {
      if (readSubscriptionRef.current) {
        readSubscriptionRef.current.unsubscribe();
        readSubscriptionRef.current = null;
      }
      if (clientRef.current?.connected) {
        clientRef.current.disconnect().subscribe();
      }
    };
  }, []);

  /**
   * 読み取りを開始
   */
  const startReading = () => {
    if (!clientRef.current || !clientRef.current.connected) {
      return;
    }

    // 既存の購読を停止
    if (readSubscriptionRef.current) {
      readSubscriptionRef.current.unsubscribe();
      readSubscriptionRef.current = null;
    }

    const readStream$ = clientRef.current.getReadStream();

    readSubscriptionRef.current = readStream$.subscribe({
      next: (data: Uint8Array) => {
        // Uint8Array をテキストに変換（UTF-8 デコード）
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(data, { stream: true });

        // 受信データを追加
        setReceivedData((prev) => prev + text);
      },
      error: (error: unknown) => {
        let message = '読み取りエラーが発生しました。';
        if (error instanceof SerialError) {
          message = `エラー: ${error.message}`;
        } else if (error instanceof Error) {
          message = `エラー: ${error.message}`;
        }
        setConnectionState((prev) => ({
          ...prev,
          error: message,
        }));
        // 読み取りエラー時は切断
        disconnect();
      },
    });
  };

  /**
   * 読み取りを停止
   */
  const stopReading = () => {
    if (readSubscriptionRef.current) {
      readSubscriptionRef.current.unsubscribe();
      readSubscriptionRef.current = null;
    }
  };

  /**
   * 接続を開始
   */
  const connect = async (baudRate?: number): Promise<void> => {
    if (baudRate) {
      baudRateRef.current = baudRate;
    }

    if (!clientRef.current) {
      clientRef.current = createSerialClient({
        baudRate: baudRateRef.current,
      });
    }

    setConnectionState({
      connected: false,
      connecting: true,
      disconnecting: false,
      error: null,
    });

    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.current.connect().subscribe({
        next: () => {
          setConnectionState({
            connected: true,
            connecting: false,
            disconnecting: false,
            error: null,
          });
          startReading();
          resolve();
        },
        error: (error: unknown) => {
          let message = '接続エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          setConnectionState({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          });
          reject(error);
        },
      });
    });
  };

  /**
   * 切断
   */
  const disconnect = async (): Promise<void> => {
    if (!clientRef.current || !clientRef.current.connected) {
      return;
    }

    stopReading();

    setConnectionState((prev) => ({
      ...prev,
      disconnecting: true,
    }));

    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        resolve();
        return;
      }

      clientRef.current.disconnect().subscribe({
        next: () => {
          setConnectionState({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: null,
          });
          resolve();
        },
        error: (error: unknown) => {
          let message = '切断エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          setConnectionState((prev) => ({
            ...prev,
            disconnecting: false,
            error: message,
          }));
          // エラーが発生しても UI は切断状態にする
          setConnectionState({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          });
          reject(error);
        },
      });
    });
  };

  /**
   * ポートをリクエスト
   */
  const requestPort = async (): Promise<void> => {
    if (!clientRef.current) {
      clientRef.current = createSerialClient({
        baudRate: baudRateRef.current,
      });
    }

    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.current.requestPort().subscribe({
        next: () => {
          setConnectionState((prev) => ({
            ...prev,
            error: null,
          }));
          resolve();
        },
        error: (error: unknown) => {
          let message = 'ポート選択エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          setConnectionState((prev) => ({
            ...prev,
            error: message,
          }));
          reject(error);
        },
      });
    });
  };

  /**
   * データを送信
   */
  const send = async (data: string): Promise<void> => {
    if (!clientRef.current || !clientRef.current.connected) {
      throw new Error(
        '接続されていません。先にシリアルポートに接続してください。',
      );
    }

    const text = data.trim();
    if (!text) {
      return;
    }

    // テキストを Uint8Array に変換（UTF-8 エンコード）
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(text + '\n'); // 改行を追加

    return new Promise((resolve, reject) => {
      if (!clientRef.current) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.current.write(encodedData).subscribe({
        next: () => {
          resolve();
        },
        error: (error: unknown) => {
          let message = '送信エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          setConnectionState((prev) => ({
            ...prev,
            error: message,
          }));
          reject(error);
        },
      });
    });
  };

  /**
   * 受信データをクリア
   */
  const clearReceivedData = () => {
    setReceivedData('');
  };

  return {
    browserSupported,
    connectionState,
    receivedData,
    connect,
    disconnect,
    requestPort,
    send,
    clearReceivedData,
  };
}

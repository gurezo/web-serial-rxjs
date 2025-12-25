import {
  createSerialClient,
  isBrowserSupported,
  SerialClient,
  SerialError,
} from '@web-serial-rxjs';
import type { Subscription } from 'rxjs';
import { onDestroy } from 'svelte';
import { writable, type Writable } from 'svelte/store';

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
 * useSerialClient Store の戻り値の型
 */
export interface UseSerialClientReturn {
  /** ブラウザサポート状態 */
  browserSupported: Writable<boolean>;
  /** 接続状態 */
  connectionState: Writable<SerialConnectionState>;
  /** 受信したデータ */
  receivedData: Writable<string>;
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
 * Web Serial API を使用するための Svelte Store
 *
 * @param initialBaudRate - 初期ボーレート（デフォルト: 9600）
 * @returns SerialClient の操作と状態を提供するオブジェクト
 */
export function useSerialClient(initialBaudRate = 9600): UseSerialClientReturn {
  const browserSupported = writable(false);
  const connectionState = writable<SerialConnectionState>({
    connected: false,
    connecting: false,
    disconnecting: false,
    error: null,
  });
  const receivedData = writable('');

  let client: SerialClient | null = null;
  let readSubscription: Subscription | null = null;
  let baudRate = initialBaudRate;

  // ブラウザサポートをチェック
  browserSupported.set(isBrowserSupported());

  // クリーンアップ: コンポーネントのアンマウント時に接続を切断
  onDestroy(() => {
    if (readSubscription) {
      readSubscription.unsubscribe();
      readSubscription = null;
    }
    if (client?.connected) {
      client.disconnect().subscribe();
    }
  });

  /**
   * 読み取りを開始
   */
  const startReading = () => {
    if (!client || !client.connected) {
      return;
    }

    // 既存の購読を停止
    if (readSubscription) {
      readSubscription.unsubscribe();
      readSubscription = null;
    }

    const readStream$ = client.getReadStream();

    readSubscription = readStream$.subscribe({
      next: (data: Uint8Array) => {
        // Uint8Array をテキストに変換（UTF-8 デコード）
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(data, { stream: true });

        // 受信データを追加
        receivedData.update((prev) => prev + text);
      },
      error: (error: unknown) => {
        let message = '読み取りエラーが発生しました。';
        if (error instanceof SerialError) {
          message = `エラー: ${error.message}`;
        } else if (error instanceof Error) {
          message = `エラー: ${error.message}`;
        }
        connectionState.update((prev) => ({
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
    if (readSubscription) {
      readSubscription.unsubscribe();
      readSubscription = null;
    }
  };

  /**
   * 接続を開始
   */
  const connect = async (newBaudRate?: number): Promise<void> => {
    if (newBaudRate) {
      baudRate = newBaudRate;
    }

    if (!client) {
      client = createSerialClient({
        baudRate: baudRate,
      });
    }

    connectionState.set({
      connected: false,
      connecting: true,
      disconnecting: false,
      error: null,
    });

    return new Promise((resolve, reject) => {
      if (!client) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      client.connect().subscribe({
        next: () => {
          connectionState.set({
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
          connectionState.set({
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
    if (!client || !client.connected) {
      return;
    }

    stopReading();

    connectionState.update((prev) => ({
      ...prev,
      disconnecting: true,
    }));

    return new Promise((resolve, reject) => {
      if (!client) {
        resolve();
        return;
      }

      client.disconnect().subscribe({
        next: () => {
          connectionState.set({
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
          // エラーが発生しても UI は切断状態にする
          connectionState.set({
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
    if (!client) {
      client = createSerialClient({
        baudRate: baudRate,
      });
    }

    return new Promise((resolve, reject) => {
      if (!client) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      client.requestPort().subscribe({
        next: () => {
          connectionState.update((prev) => ({
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
          connectionState.update((prev) => ({
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
    if (!client || !client.connected) {
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
      if (!client) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      client.write(encodedData).subscribe({
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
          connectionState.update((prev) => ({
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
    receivedData.set('');
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

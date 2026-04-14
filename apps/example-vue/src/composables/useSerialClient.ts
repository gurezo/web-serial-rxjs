import {
  createSerialClient,
  isBrowserSupported,
  SerialClient,
  SerialError,
} from '@gurezo/web-serial-rxjs';
import type { Subscription } from 'rxjs';
import { onMounted, onUnmounted, ref, type Ref } from 'vue';

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
 * useSerialClient Composable の戻り値の型
 */
export interface UseSerialClientReturn {
  /** ブラウザサポート状態 */
  browserSupported: Ref<boolean>;
  /** 接続状態 */
  connectionState: Ref<SerialConnectionState>;
  /** 受信したデータ */
  receivedData: Ref<string>;
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
 * Web Serial API を使用するためのComposable関数
 *
 * @param initialBaudRate - 初期ボーレート（デフォルト: 9600）
 * @returns SerialClient の操作と状態を提供するオブジェクト
 */
export function useSerialClient(initialBaudRate = 9600): UseSerialClientReturn {
  const browserSupported = ref(false);
  const connectionState = ref<SerialConnectionState>({
    connected: false,
    connecting: false,
    disconnecting: false,
    error: null,
  });
  const receivedData = ref('');

  const clientRef: Ref<SerialClient | null> = ref(null);
  const readSubscriptionRef: Ref<Subscription | null> = ref(null);
  const stateSubscriptionRef: Ref<Subscription | null> = ref(null);
  const baudRateRef = ref(initialBaudRate);

  // ブラウザサポートをチェック
  onMounted(() => {
    const supported = isBrowserSupported();
    browserSupported.value = supported;
  });

  // クリーンアップ: コンポーネントのアンマウント時に接続を切断
  onUnmounted(() => {
    if (readSubscriptionRef.value) {
      readSubscriptionRef.value.unsubscribe();
      readSubscriptionRef.value = null;
    }
    if (stateSubscriptionRef.value) {
      stateSubscriptionRef.value.unsubscribe();
      stateSubscriptionRef.value = null;
    }
    if (clientRef.value?.connected) {
      clientRef.value.disconnect().subscribe();
    }
  });

  /**
   * 読み取りを開始
   */
  const startReading = () => {
    if (!clientRef.value || !clientRef.value.connected) {
      return;
    }

    // 既存の購読を停止
    if (readSubscriptionRef.value) {
      readSubscriptionRef.value.unsubscribe();
      readSubscriptionRef.value = null;
    }

    const readStream$ = clientRef.value.text$;

    readSubscriptionRef.value = readStream$.subscribe({
      next: (text: string) => {
        // 受信データを追加
        receivedData.value = receivedData.value + text;
      },
      error: (error: unknown) => {
        let message = '読み取りエラーが発生しました。';
        if (error instanceof SerialError) {
          message = `エラー: ${error.message}`;
        } else if (error instanceof Error) {
          message = `エラー: ${error.message}`;
        }
        connectionState.value = {
          ...connectionState.value,
          error: message,
        };
        // 読み取りエラー時は切断
        disconnect();
      },
    });
  };

  /**
   * 読み取りを停止
   */
  const stopReading = () => {
    if (readSubscriptionRef.value) {
      readSubscriptionRef.value.unsubscribe();
      readSubscriptionRef.value = null;
    }
  };

  const subscribeState = () => {
    if (!clientRef.value) {
      return;
    }
    if (stateSubscriptionRef.value) {
      stateSubscriptionRef.value.unsubscribe();
    }
    stateSubscriptionRef.value = clientRef.value.state$.subscribe((state) => {
      if (state.kind === 'error') {
        connectionState.value = {
          connected: false,
          connecting: false,
          disconnecting: false,
          error: `エラー: ${state.error.message}`,
        };
        return;
      }

      connectionState.value = {
        ...connectionState.value,
        connected: state.kind === 'connected',
        connecting: state.kind === 'connecting',
        disconnecting: state.kind === 'disconnecting',
        error:
          state.kind === 'unsupported' && !state.support.supported
            ? state.support.reason
            : null,
      };
    });
  };

  /**
   * 接続を開始
   */
  const connect = async (baudRate?: number): Promise<void> => {
    if (baudRate) {
      baudRateRef.value = baudRate;
    }

    if (!clientRef.value) {
      clientRef.value = createSerialClient({
        baudRate: baudRateRef.value,
      });
      subscribeState();
    }

    return new Promise((resolve, reject) => {
      if (!clientRef.value) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.value.connect().subscribe({
        next: () => {
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
          connectionState.value = {
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          };
          reject(error);
        },
      });
    });
  };

  /**
   * 切断
   */
  const disconnect = async (): Promise<void> => {
    if (!clientRef.value || !clientRef.value.connected) {
      return;
    }

    stopReading();

    return new Promise((resolve, reject) => {
      if (!clientRef.value) {
        resolve();
        return;
      }

      clientRef.value.disconnect().subscribe({
        next: () => {
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
          connectionState.value = {
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          };
          reject(error);
        },
      });
    });
  };

  /**
   * ポートをリクエスト
   */
  const requestPort = async (): Promise<void> => {
    if (!clientRef.value) {
      clientRef.value = createSerialClient({
        baudRate: baudRateRef.value,
      });
    }

    return new Promise((resolve, reject) => {
      if (!clientRef.value) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.value.requestPort().subscribe({
        next: () => {
          connectionState.value = {
            ...connectionState.value,
            error: null,
          };
          resolve();
        },
        error: (error: unknown) => {
          let message = 'ポート選択エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          connectionState.value = {
            ...connectionState.value,
            error: message,
          };
          reject(error);
        },
      });
    });
  };

  /**
   * データを送信
   */
  const send = async (data: string): Promise<void> => {
    if (!clientRef.value || !clientRef.value.connected) {
      throw new Error(
        '接続されていません。先にシリアルポートに接続してください。',
      );
    }

    const text = data.trim();
    if (!text) {
      return;
    }

    // テキストを Uint8Array に変換（UTF-8 エンコード）
    const payload = `${text}\n`;

    return new Promise((resolve, reject) => {
      if (!clientRef.value) {
        reject(new Error('SerialClient が初期化されていません'));
        return;
      }

      clientRef.value.send$(payload).subscribe({
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
          connectionState.value = {
            ...connectionState.value,
            error: message,
          };
          reject(error);
        },
      });
    });
  };

  /**
   * 受信データをクリア
   */
  const clearReceivedData = () => {
    receivedData.value = '';
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

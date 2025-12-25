import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialClient,
  isBrowserSupported,
  SerialClient,
  SerialError,
} from '@gurezo/web-serial-rxjs';
import {
  BehaviorSubject,
  firstValueFrom,
  Observable,
  Subscription,
} from 'rxjs';

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
 * Web Serial API を使用するための Angular Service
 */
@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private client: SerialClient | null = null;
  private readSubscription: Subscription | null = null;
  private baudRate = 9600;

  private readonly browserSupported$ = new BehaviorSubject<boolean>(false);
  private readonly connectionState$ =
    new BehaviorSubject<SerialConnectionState>({
      connected: false,
      connecting: false,
      disconnecting: false,
      error: null,
    });
  private readonly receivedData$ = new BehaviorSubject<string>('');

  /**
   * ブラウザサポート状態のObservable
   */
  get browserSupported(): Observable<boolean> {
    return this.browserSupported$.asObservable();
  }

  /**
   * 接続状態のObservable
   */
  get connectionState(): Observable<SerialConnectionState> {
    return this.connectionState$.asObservable();
  }

  /**
   * 受信データのObservable
   */
  get receivedData(): Observable<string> {
    return this.receivedData$.asObservable();
  }

  constructor() {
    // ブラウザサポートをチェック
    const supported = isBrowserSupported();
    this.browserSupported$.next(supported);
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  /**
   * クリーンアップ処理
   */
  private cleanup(): void {
    if (this.readSubscription) {
      this.readSubscription.unsubscribe();
      this.readSubscription = null;
    }
    if (this.client?.connected) {
      this.client.disconnect().subscribe();
    }
  }

  /**
   * 読み取りを開始
   */
  private startReading(): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    // 既存の購読を停止
    if (this.readSubscription) {
      this.readSubscription.unsubscribe();
      this.readSubscription = null;
    }

    const readStream$ = this.client.getReadStream();

    this.readSubscription = readStream$.subscribe({
      next: (data: Uint8Array) => {
        // Uint8Array をテキストに変換（UTF-8 デコード）
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(data, { stream: true });

        // 受信データを追加
        this.receivedData$.next(this.receivedData$.value + text);
      },
      error: (error: unknown) => {
        let message = '読み取りエラーが発生しました。';
        if (error instanceof SerialError) {
          message = `エラー: ${error.message}`;
        } else if (error instanceof Error) {
          message = `エラー: ${error.message}`;
        }
        this.connectionState$.next({
          ...this.connectionState$.value,
          error: message,
        });
        // 読み取りエラー時は切断
        this.disconnect();
      },
    });
  }

  /**
   * 読み取りを停止
   */
  private stopReading(): void {
    if (this.readSubscription) {
      this.readSubscription.unsubscribe();
      this.readSubscription = null;
    }
  }

  /**
   * 接続を開始
   */
  connect(baudRate?: number): Observable<void> {
    if (baudRate) {
      this.baudRate = baudRate;
    }

    if (!this.client) {
      this.client = createSerialClient({
        baudRate: this.baudRate,
      });
    }

    this.connectionState$.next({
      connected: false,
      connecting: true,
      disconnecting: false,
      error: null,
    });

    return new Observable<void>((observer) => {
      if (!this.client) {
        observer.error(new Error('SerialClient が初期化されていません'));
        return;
      }

      const subscription = this.client.connect().subscribe({
        next: () => {
          this.connectionState$.next({
            connected: true,
            connecting: false,
            disconnecting: false,
            error: null,
          });
          this.startReading();
          observer.next();
          observer.complete();
        },
        error: (error: unknown) => {
          let message = '接続エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          this.connectionState$.next({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          });
          observer.error(error);
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * 切断
   */
  disconnect(): Observable<void> {
    if (!this.client || !this.client.connected) {
      return new Observable<void>((observer) => {
        observer.next();
        observer.complete();
      });
    }

    this.stopReading();

    this.connectionState$.next({
      ...this.connectionState$.value,
      disconnecting: true,
    });

    return new Observable<void>((observer) => {
      if (!this.client) {
        observer.next();
        observer.complete();
        return;
      }

      const subscription = this.client.disconnect().subscribe({
        next: () => {
          this.connectionState$.next({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: null,
          });
          observer.next();
          observer.complete();
        },
        error: (error: unknown) => {
          let message = '切断エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          // エラーが発生しても UI は切断状態にする
          this.connectionState$.next({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: message,
          });
          observer.error(error);
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * ポートをリクエスト
   */
  requestPort(): Observable<void> {
    if (!this.client) {
      this.client = createSerialClient({
        baudRate: this.baudRate,
      });
    }

    return new Observable<void>((observer) => {
      if (!this.client) {
        observer.error(new Error('SerialClient が初期化されていません'));
        return;
      }

      const subscription = this.client.requestPort().subscribe({
        next: () => {
          this.connectionState$.next({
            ...this.connectionState$.value,
            error: null,
          });
          observer.next();
          observer.complete();
        },
        error: (error: unknown) => {
          let message = 'ポート選択エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          this.connectionState$.next({
            ...this.connectionState$.value,
            error: message,
          });
          observer.error(error);
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * データを送信
   */
  send(data: string): Observable<void> {
    if (!this.client || !this.client.connected) {
      return new Observable<void>((observer) => {
        observer.error(
          new Error(
            '接続されていません。先にシリアルポートに接続してください。',
          ),
        );
      });
    }

    const text = data.trim();
    if (!text) {
      return new Observable<void>((observer) => {
        observer.next();
        observer.complete();
      });
    }

    // テキストを Uint8Array に変換（UTF-8 エンコード）
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(text + '\n'); // 改行を追加

    return new Observable<void>((observer) => {
      if (!this.client) {
        observer.error(new Error('SerialClient が初期化されていません'));
        return;
      }

      const subscription = this.client.write(encodedData).subscribe({
        next: () => {
          observer.next();
          observer.complete();
        },
        error: (error: unknown) => {
          let message = '送信エラーが発生しました。';
          if (error instanceof SerialError) {
            message = `エラー: ${error.message}`;
          } else if (error instanceof Error) {
            message = `エラー: ${error.message}`;
          }
          this.connectionState$.next({
            ...this.connectionState$.value,
            error: message,
          });
          observer.error(error);
        },
      });

      return () => {
        subscription.unsubscribe();
      };
    });
  }

  /**
   * 受信データをクリア
   */
  clearReceivedData(): void {
    this.receivedData$.next('');
  }

  /**
   * Promise版の接続メソッド（コンポーネントでの使用を簡単にするため）
   */
  async connectAsync(baudRate?: number): Promise<void> {
    return firstValueFrom(this.connect(baudRate));
  }

  /**
   * Promise版の切断メソッド（コンポーネントでの使用を簡単にするため）
   */
  async disconnectAsync(): Promise<void> {
    return firstValueFrom(this.disconnect());
  }

  /**
   * Promise版のポートリクエストメソッド（コンポーネントでの使用を簡単にするため）
   */
  async requestPortAsync(): Promise<void> {
    return firstValueFrom(this.requestPort());
  }

  /**
   * Promise版の送信メソッド（コンポーネントでの使用を簡単にするため）
   */
  async sendAsync(data: string): Promise<void> {
    return firstValueFrom(this.send(data));
  }
}

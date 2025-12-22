import { Component, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SerialClientService } from './services/serial-client.service';
import { Observable, combineLatest, map } from 'rxjs';

@Component({
  imports: [CommonModule, FormsModule, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  baudRate = 9600;
  sendInput = '';

  browserSupported$: Observable<boolean>;
  connectionState$: Observable<import('./services/serial-client.service').SerialConnectionState>;
  receivedData$: Observable<string>;
  status$: Observable<{ type: string; message: string }>;

  constructor(private serialService: SerialClientService) {
    this.browserSupported$ = this.serialService.browserSupported;
    this.connectionState$ = this.serialService.connectionState;
    this.receivedData$ = this.serialService.receivedData;

    // ステータスメッセージを計算
    this.status$ = this.connectionState$.pipe(
      map((state) => {
        if (state.error) {
          return { type: 'error', message: state.error };
        }
        if (state.connecting) {
          return { type: 'info', message: '接続中...' };
        }
        if (state.disconnecting) {
          return { type: 'info', message: '切断中...' };
        }
        if (state.connected) {
          return { type: 'success', message: 'シリアルポートに接続しました。' };
        }
        return { type: 'info', message: 'シリアルポートに接続していません。' };
      }),
    );
  }

  ngOnDestroy(): void {
    // Service のクリーンアップは Service 自体で行われる
  }

  /**
   * 接続ボタンのハンドラ
   */
  async handleConnect(): Promise<void> {
    try {
      await this.serialService.connectAsync(this.baudRate);
    } catch (error) {
      // エラーは SerialClientService 内で処理される
      console.error('接続エラー:', error);
    }
  }

  /**
   * 切断ボタンのハンドラ
   */
  async handleDisconnect(): Promise<void> {
    try {
      await this.serialService.disconnectAsync();
    } catch (error) {
      // エラーは SerialClientService 内で処理される
      console.error('切断エラー:', error);
    }
  }

  /**
   * ポートリクエストボタンのハンドラ
   */
  async handleRequestPort(): Promise<void> {
    try {
      await this.serialService.requestPortAsync();
    } catch (error) {
      // エラーは SerialClientService 内で処理される
      console.error('ポート選択エラー:', error);
    }
  }

  /**
   * 送信ボタンのハンドラ
   */
  async handleSend(): Promise<void> {
    if (!this.sendInput.trim()) {
      return;
    }

    try {
      await this.serialService.sendAsync(this.sendInput);
      this.sendInput = ''; // 送信成功後に入力欄をクリア
    } catch (error) {
      console.error('送信エラー:', error);
    }
  }

  /**
   * Enter キーで送信
   */
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  /**
   * 受信データをクリア
   */
  clearReceivedData(): void {
    this.serialService.clearReceivedData();
  }
}

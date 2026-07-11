import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { SerialClientService } from './services/serial-client.service';

type StatusType = 'info' | 'success' | 'error';

@Component({
  imports: [CommonModule, FormsModule, RouterModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  baudRate = 9600;
  sendInput = '';

  private readonly serialService = inject(SerialClientService);
  private readonly destroyRef = inject(DestroyRef);

  readonly browserSupported = this.serialService.isBrowserSupported();
  readonly state = signal<SerialSessionState>({
    status: SerialSessionStatus.Idle,
  });
  readonly isConnected = signal(false);
  readonly receivedData = signal('');
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.serialService.state$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((state) => {
        this.state.set(state);
        if (
          state.status === SerialSessionStatus.Connected ||
          state.status === SerialSessionStatus.Idle
        ) {
          this.errorMessage.set(null);
        }
      });

    this.serialService.isConnected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((v) => this.isConnected.set(v));

    this.serialService.terminalText$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((text) => this.receivedData.set(text));

    this.serialService.errors$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((error) => {
        this.errorMessage.set(error.message);
      });
  }

  readonly connecting = computed(
    () => this.state().status === SerialSessionStatus.Connecting,
  );

  readonly disconnecting = computed(
    () => this.state().status === SerialSessionStatus.Disconnecting,
  );

  readonly hasReceivedData = computed(() => this.receivedData().length > 0);

  readonly status = computed((): { type: StatusType; message: string } => {
    const error = this.errorMessage();
    if (error) {
      return { type: 'error', message: `エラー: ${error}` };
    }
    switch (this.state().status) {
      case SerialSessionStatus.Connecting:
        return { type: 'info', message: '接続中...' };
      case SerialSessionStatus.Disconnecting:
        return { type: 'info', message: '切断中...' };
      case SerialSessionStatus.Connected:
        return { type: 'success', message: 'シリアルポートに接続しました。' };
      case SerialSessionStatus.Unsupported:
        return {
          type: 'error',
          message:
            'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。',
        };
      case SerialSessionStatus.Error:
        return { type: 'error', message: 'エラーが発生しました。' };
      default:
        return { type: 'info', message: 'シリアルポートに接続していません。' };
    }
  });

  handleConnect(): void {
    this.resetTerminalView();
    this.errorMessage.set(null);
    this.serialService.connect$(this.baudRate).subscribe({
      error: (error: unknown) => {
        console.error('接続エラー:', error);
      },
    });
  }

  handleDisconnect(): void {
    this.serialService.disconnect$().subscribe({
      error: (error: unknown) => {
        console.error('切断エラー:', error);
      },
    });
  }

  handleSend(): void {
    const text = this.sendInput.trim();
    if (!text) {
      return;
    }
    this.serialService.send$(`${text}\n`).subscribe({
      next: () => {
        this.sendInput = '';
      },
      error: (error: unknown) => {
        console.error('送信エラー:', error);
      },
    });
  }

  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.handleSend();
    }
  }

  clearReceivedData(): void {
    this.resetTerminalView();
  }

  private resetTerminalView(): void {
    this.serialService.bumpTerminalBufferEpoch();
    this.receivedData.set('');
  }
}

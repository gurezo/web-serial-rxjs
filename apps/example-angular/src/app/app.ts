import { CommonModule } from '@angular/common';
import { Component, computed, inject, linkedSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  formatExampleSerialError,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
  type ExampleErrorDisplay,
} from '@gurezo/examples-shared';
import {
  SerialSessionStatus,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { map } from 'rxjs';
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
  readonly navLinks = getExampleNavLinks('angular');
  readonly requirements = getExampleRequirementsCopy();
  readonly supportStatus = getExampleSupportStatus();
  readonly externalLinkRel = 'noopener noreferrer';

  private readonly serialService = inject(SerialClientService);

  readonly canConnect = this.supportStatus.canConnect;
  readonly state = toSignal(this.serialService.state$, {
    initialValue: {
      status: SerialSessionStatus.Idle,
    } satisfies SerialSessionState,
  });
  readonly isConnected = computed(
    () => this.state().status === SerialSessionStatus.Connected,
  );
  private readonly terminalText = toSignal(this.serialService.terminalText$, {
    initialValue: '',
  });
  readonly receivedData = linkedSignal({
    source: () => this.terminalText(),
    computation: (text) => text,
  });
  private readonly lastErrorDisplay = toSignal(
    this.serialService.errors$.pipe(
      map((error): ExampleErrorDisplay => formatExampleSerialError(error)),
    ),
    { initialValue: null as ExampleErrorDisplay | null },
  );

  readonly errorDisplay = computed(() => {
    const status = this.state().status;
    if (
      status === SerialSessionStatus.Connected ||
      status === SerialSessionStatus.Idle ||
      status === SerialSessionStatus.Connecting
    ) {
      return null;
    }
    return this.lastErrorDisplay();
  });

  readonly connecting = computed(
    () => this.state().status === SerialSessionStatus.Connecting,
  );

  readonly disconnecting = computed(
    () => this.state().status === SerialSessionStatus.Disconnecting,
  );

  readonly hasReceivedData = computed(() => this.receivedData().length > 0);

  readonly status = computed((): { type: StatusType; message: string } => {
    const error = this.errorDisplay();
    if (error) {
      return {
        type: error.type,
        message:
          error.type === 'info' ? error.message : `エラー: ${error.message}`,
      };
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
          message: this.supportStatus.statusMessage,
        };
      case SerialSessionStatus.Error:
        return { type: 'error', message: 'エラーが発生しました。' };
      default:
        return { type: 'info', message: 'シリアルポートに接続していません。' };
    }
  });

  handleConnect(): void {
    this.resetTerminalView();
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

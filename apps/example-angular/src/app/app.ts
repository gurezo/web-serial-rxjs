import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  linkedSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  appendExampleLineEnding,
  DEFAULT_EXAMPLE_LINE_ENDING,
  EXAMPLE_LINE_ENDING_OPTIONS,
  formatExamplePortInfo,
  formatExampleSerialErrorDetail,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
  type ExampleLineEnding,
  type ExampleSerialErrorDetail,
} from '@gurezo/examples-shared';
import {
  isConnectedSessionState,
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
  lineEnding: ExampleLineEnding = DEFAULT_EXAMPLE_LINE_ENDING;
  readonly lineEndingOptions = EXAMPLE_LINE_ENDING_OPTIONS;
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
  private readonly lastErrorFromStream = toSignal(
    this.serialService.errors$.pipe(
      map(
        (error): ExampleSerialErrorDetail | null =>
          formatExampleSerialErrorDetail(error),
      ),
    ),
    { initialValue: null as ExampleSerialErrorDetail | null },
  );

  readonly errorDetail = linkedSignal({
    source: (): ExampleSerialErrorDetail | null => this.lastErrorFromStream(),
    computation: (detail: ExampleSerialErrorDetail | null) => detail,
  });

  readonly sessionStatus = computed(() =>
    formatExampleSessionStatus(this.state()),
  );
  readonly controls = computed(() =>
    getExampleControlsEnabled(this.state(), this.canConnect),
  );
  readonly portInfoDisplay = computed(() => {
    const current = this.state();
    return isConnectedSessionState(current)
      ? formatExamplePortInfo(current.portInfo)
      : null;
  });

  readonly hasReceivedData = computed(() => this.receivedData().length > 0);

  readonly status = computed((): { type: StatusType; message: string } => {
    const error = this.errorDetail();
    if (error) {
      return {
        type: error.type,
        message:
          error.type === 'info' ? error.message : `エラー: ${error.message}`,
      };
    }
    const session = this.sessionStatus();
    if (session.inProgress) {
      return {
        type: 'info',
        message: session.status === 'connecting' ? '接続中...' : '切断中...',
      };
    }
    switch (this.state().status) {
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

  constructor() {
    effect(() => {
      const status = this.state().status;
      if (
        status === SerialSessionStatus.Connected ||
        status === SerialSessionStatus.Idle
      ) {
        this.errorDetail.set(null);
      }
    });
  }

  clearError(): void {
    this.errorDetail.set(null);
  }

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
    this.serialService
      .send$(appendExampleLineEnding(text, this.lineEnding))
      .subscribe({
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

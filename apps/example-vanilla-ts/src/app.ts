// Static imports are correct for application code.
// Test files use vi.mock which causes false positives for lazy-load detection.
import {
  createSerialClient,
  isBrowserSupported,
  SerialClient,
  SerialError,
} from '@gurezo/web-serial-rxjs';
import type { Subscription } from 'rxjs';
import { fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * Main application class for the vanilla TypeScript example
 */
export class App {
  private client: SerialClient | null = null;
  private readSubscription: Subscription | null = null;

  // Browser support
  private browserSupportStatus!: HTMLElement;

  // Connection
  private connectBtn!: HTMLButtonElement;
  private disconnectBtn!: HTMLButtonElement;
  private requestPortBtn!: HTMLButtonElement;
  private connectionStatus!: HTMLElement;

  // Configuration
  private baudRateSelect!: HTMLSelectElement;

  // Send data
  private sendInput!: HTMLInputElement;
  private sendBtn!: HTMLButtonElement;

  // Receive data
  private receiveOutput!: HTMLTextAreaElement;
  private clearReceiveBtn!: HTMLButtonElement;

  constructor() {
    // Initialize UI elements
    this.initializeElements();
    // Check browser support
    this.checkBrowserSupport();
    // Setup event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize DOM elements
   */
  private initializeElements(): void {
    // Browser support
    const browserSupportStatus = document.getElementById(
      'browser-support-status',
    );
    if (!browserSupportStatus) {
      throw new Error('browser-support-status element not found');
    }
    this.browserSupportStatus = browserSupportStatus;

    // Connection
    const connectBtn = document.getElementById('connect-btn');
    if (!connectBtn || !(connectBtn instanceof HTMLButtonElement)) {
      throw new Error('connect-btn element not found');
    }
    this.connectBtn = connectBtn;

    const disconnectBtn = document.getElementById('disconnect-btn');
    if (!disconnectBtn || !(disconnectBtn instanceof HTMLButtonElement)) {
      throw new Error('disconnect-btn element not found');
    }
    this.disconnectBtn = disconnectBtn;

    const requestPortBtn = document.getElementById('request-port-btn');
    if (!requestPortBtn || !(requestPortBtn instanceof HTMLButtonElement)) {
      throw new Error('request-port-btn element not found');
    }
    this.requestPortBtn = requestPortBtn;

    const connectionStatus = document.getElementById('connection-status');
    if (!connectionStatus) {
      throw new Error('connection-status element not found');
    }
    this.connectionStatus = connectionStatus;

    // Configuration
    const baudRateSelect = document.getElementById('baud-rate');
    if (!baudRateSelect || !(baudRateSelect instanceof HTMLSelectElement)) {
      throw new Error('baud-rate element not found');
    }
    this.baudRateSelect = baudRateSelect;

    // Send data
    const sendInput = document.getElementById('send-input');
    if (!sendInput || !(sendInput instanceof HTMLInputElement)) {
      throw new Error('send-input element not found');
    }
    this.sendInput = sendInput;

    const sendBtn = document.getElementById('send-btn');
    if (!sendBtn || !(sendBtn instanceof HTMLButtonElement)) {
      throw new Error('send-btn element not found');
    }
    this.sendBtn = sendBtn;

    // Receive data
    const receiveOutput = document.getElementById('receive-output');
    if (!receiveOutput || !(receiveOutput instanceof HTMLTextAreaElement)) {
      throw new Error('receive-output element not found');
    }
    this.receiveOutput = receiveOutput;

    const clearReceiveBtn = document.getElementById('clear-receive-btn');
    if (!clearReceiveBtn || !(clearReceiveBtn instanceof HTMLButtonElement)) {
      throw new Error('clear-receive-btn element not found');
    }
    this.clearReceiveBtn = clearReceiveBtn;
  }

  /**
   * Check browser support
   */
  private checkBrowserSupport(): void {
    const supported = isBrowserSupported();

    if (supported) {
      this.showStatus(
        this.browserSupportStatus,
        'success',
        'ブラウザは Web Serial API をサポートしています。',
      );
      // Enable connection button if browser is supported
      this.connectBtn.disabled = false;
      this.requestPortBtn.disabled = false;
    } else {
      this.showStatus(
        this.browserSupportStatus,
        'error',
        'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。',
      );
    }
  }

  /**
   * Setup event handlers using RxJS
   */
  private setupEventHandlers(): void {
    // Connect button
    fromEvent(this.connectBtn, 'click').subscribe(() => {
      this.handleConnect();
    });

    // Disconnect button
    fromEvent(this.disconnectBtn, 'click').subscribe(() => {
      this.handleDisconnect();
    });

    // Request port button
    fromEvent(this.requestPortBtn, 'click').subscribe(() => {
      this.handleRequestPort();
    });

    // Send button
    fromEvent(this.sendBtn, 'click').subscribe(() => {
      this.handleSend();
    });

    // Send on Enter key
    fromEvent<KeyboardEvent>(this.sendInput, 'keydown')
      .pipe(
        filter((event) => event.key === 'Enter' && !event.shiftKey),
        map((event) => {
          event.preventDefault();
          return event;
        }),
      )
      .subscribe(() => {
        this.handleSend();
      });

    // Clear receive output
    fromEvent(this.clearReceiveBtn, 'click').subscribe(() => {
      this.receiveOutput.value = '';
    });
  }

  /**
   * Handle connect action
   */
  private handleConnect(): void {
    if (!this.client) {
      const baudRate = parseInt(this.baudRateSelect.value, 10);
      this.client = createSerialClient({ baudRate });
    }

    this.updateConnectionUI(false);

    this.client.connect().subscribe({
      next: () => {
        this.updateConnectionUI(true);
        this.showStatus(
          this.connectionStatus,
          'success',
          'シリアルポートに接続しました。',
        );
        this.startReading();
      },
      error: (error: unknown) => {
        this.updateConnectionUI(false);
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Handle disconnect action
   */
  private handleDisconnect(): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    this.stopReading();

    this.client.disconnect().subscribe({
      next: () => {
        this.updateConnectionUI(false);
        this.showStatus(
          this.connectionStatus,
          'info',
          'シリアルポートから切断しました。',
        );
      },
      error: (error: unknown) => {
        this.handleError(error, this.connectionStatus);
        // Even if there's an error, update UI to reflect disconnected state
        this.updateConnectionUI(false);
      },
    });
  }

  /**
   * Handle request port action
   */
  private handleRequestPort(): void {
    if (!this.client) {
      const baudRate = parseInt(this.baudRateSelect.value, 10);
      this.client = createSerialClient({ baudRate });
    }

    this.client.requestPort().subscribe({
      next: (port) => {
        const portInfo = port.getInfo?.();
        const vendorId = portInfo?.usbVendorId || 'N/A';
        this.showStatus(
          this.connectionStatus,
          'success',
          `ポートが選択されました: ${vendorId}`,
        );
      },
      error: (error: unknown) => {
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Handle send data action
   */
  private handleSend(): void {
    if (!this.client || !this.client.connected) {
      this.showStatus(
        this.connectionStatus,
        'warning',
        '接続されていません。先にシリアルポートに接続してください。',
      );
      return;
    }

    const text = this.sendInput.value.trim();
    if (!text) {
      return;
    }

    // Convert text to Uint8Array (UTF-8 encoding)
    const encoder = new TextEncoder();
    const data = encoder.encode(text + '\n'); // Add newline

    this.client.write(data).subscribe({
      next: () => {
        // Clear input after successful send
        this.sendInput.value = '';
      },
      error: (error: unknown) => {
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Start reading from serial port
   */
  private startReading(): void {
    if (!this.client || !this.client.connected) {
      return;
    }

    // Stop any existing read subscription
    this.stopReading();

    const readStream$ = this.client.getReadStream();

    this.readSubscription = readStream$.subscribe({
      next: (data: Uint8Array) => {
        // Convert Uint8Array to text (UTF-8 decoding)
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(data, { stream: true });

        // Append to receive output
        this.receiveOutput.value += text;

        // Auto-scroll to bottom
        this.receiveOutput.scrollTop = this.receiveOutput.scrollHeight;
      },
      error: (error: unknown) => {
        this.handleError(error, this.connectionStatus);
        // Disconnect on read error
        this.handleDisconnect();
      },
    });
  }

  /**
   * Stop reading from serial port
   */
  private stopReading(): void {
    if (this.readSubscription) {
      this.readSubscription.unsubscribe();
      this.readSubscription = null;
    }
  }

  /**
   * Update connection UI state
   */
  private updateConnectionUI(connected: boolean): void {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;
    this.sendInput.disabled = !connected;
    this.sendBtn.disabled = !connected;
    this.baudRateSelect.disabled = connected;
  }

  /**
   * Show status message
   */
  private showStatus(
    element: HTMLElement,
    type: 'info' | 'success' | 'error' | 'warning',
    message: string,
  ): void {
    element.textContent = message;
    element.className = `status-message ${type}`;
  }

  /**
   * Handle errors
   */
  private handleError(error: unknown, statusElement: HTMLElement): void {
    let message = 'エラーが発生しました。';

    if (error instanceof SerialError) {
      message = `エラー: ${error.message}`;
    } else if (error instanceof Error) {
      message = `エラー: ${error.message}`;
    } else {
      message = `エラー: ${String(error)}`;
    }

    this.showStatus(statusElement, 'error', message);
    console.error('Serial port error:', error);
  }
}

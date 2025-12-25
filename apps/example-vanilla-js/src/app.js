// Static imports are correct for application code.
// Test files use vi.mock which causes false positives for lazy-load detection.
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  createSerialClient,
  isBrowserSupported,
  SerialError,
} from '@gurezo/web-serial-rxjs';
import { fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';

/**
 * Main application class for the vanilla JavaScript example
 */
export class App {
  constructor() {
    this.client = null;
    this.readSubscription = null;

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
  initializeElements() {
    // Browser support
    this.browserSupportStatus = document.getElementById(
      'browser-support-status',
    );

    // Connection
    this.connectBtn = document.getElementById('connect-btn');
    this.disconnectBtn = document.getElementById('disconnect-btn');
    this.requestPortBtn = document.getElementById('request-port-btn');
    this.connectionStatus = document.getElementById('connection-status');

    // Configuration
    this.baudRateSelect = document.getElementById('baud-rate');

    // Send data
    this.sendInput = document.getElementById('send-input');
    this.sendBtn = document.getElementById('send-btn');

    // Receive data
    this.receiveOutput = document.getElementById('receive-output');
    this.clearReceiveBtn = document.getElementById('clear-receive-btn');
  }

  /**
   * Check browser support
   */
  checkBrowserSupport() {
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
  setupEventHandlers() {
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
    fromEvent(this.sendInput, 'keydown')
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
  handleConnect() {
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
      error: (error) => {
        this.updateConnectionUI(false);
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Handle disconnect action
   */
  handleDisconnect() {
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
      error: (error) => {
        this.handleError(error, this.connectionStatus);
        // Even if there's an error, update UI to reflect disconnected state
        this.updateConnectionUI(false);
      },
    });
  }

  /**
   * Handle request port action
   */
  handleRequestPort() {
    if (!this.client) {
      const baudRate = parseInt(this.baudRateSelect.value, 10);
      this.client = createSerialClient({ baudRate });
    }

    this.client.requestPort().subscribe({
      next: (port) => {
        this.showStatus(
          this.connectionStatus,
          'success',
          `ポートが選択されました: ${port.getInfo?.()?.usbVendorId || 'N/A'}`,
        );
      },
      error: (error) => {
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Handle send data action
   */
  handleSend() {
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
      error: (error) => {
        this.handleError(error, this.connectionStatus);
      },
    });
  }

  /**
   * Start reading from serial port
   */
  startReading() {
    if (!this.client || !this.client.connected) {
      return;
    }

    // Stop any existing read subscription
    this.stopReading();

    const readStream$ = this.client.getReadStream();

    this.readSubscription = readStream$.subscribe({
      next: (data) => {
        // Convert Uint8Array to text (UTF-8 decoding)
        const decoder = new TextDecoder('utf-8', { fatal: false });
        const text = decoder.decode(data, { stream: true });

        // Append to receive output
        this.receiveOutput.value += text;

        // Auto-scroll to bottom
        this.receiveOutput.scrollTop = this.receiveOutput.scrollHeight;
      },
      error: (error) => {
        this.handleError(error, this.connectionStatus);
        // Disconnect on read error
        this.handleDisconnect();
      },
    });
  }

  /**
   * Stop reading from serial port
   */
  stopReading() {
    if (this.readSubscription) {
      this.readSubscription.unsubscribe();
      this.readSubscription = null;
    }
  }

  /**
   * Update connection UI state
   */
  updateConnectionUI(connected) {
    this.connectBtn.disabled = connected;
    this.disconnectBtn.disabled = !connected;
    this.sendInput.disabled = !connected;
    this.sendBtn.disabled = !connected;
    this.baudRateSelect.disabled = connected;
  }

  /**
   * Show status message
   */
  showStatus(element, type, message) {
    element.textContent = message;
    element.className = `status-message ${type}`;
  }

  /**
   * Handle errors
   */
  handleError(error, statusElement) {
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

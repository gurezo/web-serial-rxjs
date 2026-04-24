<script lang="ts">
  import type { SerialSessionState } from '@gurezo/web-serial-rxjs';
  import { useSerialSession } from './stores/useSerialSession';

  let baudRate = 9600;
  let sendInput = '';

  const {
    browserSupported,
    state,
    receivedData,
    errorMessage,
    connect$,
    disconnect$,
    send$,
    clearReceivedData,
  } = useSerialSession(baudRate);

  type StatusType = 'info' | 'success' | 'error';

  const statusFor = (
    current: SerialSessionState,
    error: string | null,
  ): { type: StatusType; message: string } => {
    if (error) {
      return { type: 'error', message: `エラー: ${error}` };
    }
    switch (current) {
      case 'connecting':
        return { type: 'info', message: '接続中...' };
      case 'disconnecting':
        return { type: 'info', message: '切断中...' };
      case 'connected':
        return { type: 'success', message: 'シリアルポートに接続しました。' };
      case 'unsupported':
        return {
          type: 'error',
          message:
            'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。',
        };
      case 'error':
        return { type: 'error', message: 'エラーが発生しました。' };
      default:
        return { type: 'info', message: 'シリアルポートに接続していません。' };
    }
  };

  $: status = statusFor($state, $errorMessage);
  $: connected = $state === 'connected';
  $: connecting = $state === 'connecting';
  $: disconnecting = $state === 'disconnecting';

  const handleConnect = () => {
    connect$(baudRate).subscribe({
      error: (error: unknown) => console.error('接続エラー:', error),
    });
  };

  const handleDisconnect = () => {
    disconnect$().subscribe({
      error: (error: unknown) => console.error('切断エラー:', error),
    });
  };

  const handleSend = () => {
    const text = sendInput.trim();
    if (!text) {
      return;
    }
    send$(`${text}\n`).subscribe({
      next: () => {
        sendInput = '';
      },
      error: (error: unknown) => console.error('送信エラー:', error),
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
</script>

<div class="container">
  <header>
    <h1>Web Serial RxJS - Svelte Example</h1>
    <p class="subtitle">
      Svelte Store を使用した Web Serial API のサンプル
    </p>
  </header>

  <main>
    <!-- ブラウザサポート -->
    <section class="section">
      <h2>ブラウザサポート</h2>
      <div class="status-message {$browserSupported ? 'success' : 'error'}">
        {$browserSupported
          ? 'ブラウザは Web Serial API をサポートしています。'
          : 'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。'}
      </div>
    </section>

    <!-- 接続設定 -->
    <section class="section">
      <h2>接続設定</h2>
      <div class="form-group">
        <label for="baud-rate">ボーレート</label>
        <select
          id="baud-rate"
          class="form-control"
          bind:value={baudRate}
          disabled={connected}
        >
          <option value={9600}>9600</option>
          <option value={19200}>19200</option>
          <option value={38400}>38400</option>
          <option value={57600}>57600</option>
          <option value={115200}>115200</option>
        </select>
      </div>
      <div class="button-group">
        <button
          class="btn btn-primary"
          on:click={handleConnect}
          disabled={!$browserSupported || connected || connecting}
        >
          接続
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleDisconnect}
          disabled={!connected || disconnecting}
        >
          切断
        </button>
      </div>
      <div class="status-message {status.type}">
        {status.message}
      </div>
    </section>

    <!-- データ送信 -->
    <section class="section">
      <h2>データ送信</h2>
      <div class="form-group">
        <label for="send-input">送信データ</label>
        <div class="input-group">
          <input
            id="send-input"
            type="text"
            class="form-control"
            bind:value={sendInput}
            on:keydown={handleKeyDown}
            disabled={!connected}
            placeholder="送信するテキストを入力..."
          />
          <button
            class="btn btn-primary"
            on:click={handleSend}
            disabled={!connected || !sendInput.trim()}
          >
            送信
          </button>
        </div>
      </div>
    </section>

    <!-- データ受信 -->
    <section class="section">
      <h2>データ受信</h2>
      <div class="form-group">
        <label for="receive-output">受信データ</label>
        <textarea
          id="receive-output"
          class="form-control receive-output"
          value={$receivedData}
          readonly
          placeholder="受信したデータがここに表示されます..."
        />
      </div>
      <div class="button-group">
        <button
          class="btn btn-secondary"
          on:click={clearReceivedData}
          disabled={!$receivedData}
        >
          クリア
        </button>
      </div>
    </section>
  </main>
</div>

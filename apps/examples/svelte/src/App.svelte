<script lang="ts">
  import { onMount } from 'svelte';
  import { useSerialClient } from './stores/useSerialClient';

  let baudRate = 9600;
  let sendInput = '';

  const {
    browserSupported,
    connectionState,
    receivedData,
    connect,
    disconnect,
    requestPort,
    send,
    clearReceivedData,
  } = useSerialClient(baudRate);

  // Store の値をリアクティブに取得
  let browserSupportedValue = false;
  let connectionStateValue: {
    connected: boolean;
    connecting: boolean;
    disconnecting: boolean;
    error: string | null;
  } = {
    connected: false,
    connecting: false,
    disconnecting: false,
    error: null,
  };
  let receivedDataValue = '';

  // Store の値を購読
  onMount(() => {
    const unsubscribeBrowser = browserSupported.subscribe((value) => {
      browserSupportedValue = value;
    });
    const unsubscribeConnection = connectionState.subscribe((value) => {
      connectionStateValue = value;
    });
    const unsubscribeReceived = receivedData.subscribe((value) => {
      receivedDataValue = value;
    });

    return () => {
      unsubscribeBrowser();
      unsubscribeConnection();
      unsubscribeReceived();
    };
  });

  /**
   * 接続ボタンのハンドラ
   */
  const handleConnect = async () => {
    try {
      await connect(baudRate);
    } catch (error) {
      // エラーは useSerialClient 内で処理される
      console.error('接続エラー:', error);
    }
  };

  /**
   * 切断ボタンのハンドラ
   */
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      // エラーは useSerialClient 内で処理される
      console.error('切断エラー:', error);
    }
  };

  /**
   * ポートリクエストボタンのハンドラ
   */
  const handleRequestPort = async () => {
    try {
      await requestPort();
    } catch (error) {
      // エラーは useSerialClient 内で処理される
      console.error('ポート選択エラー:', error);
    }
  };

  /**
   * 送信ボタンのハンドラ
   */
  const handleSend = async () => {
    if (!sendInput.trim()) {
      return;
    }

    try {
      await send(sendInput);
      sendInput = ''; // 送信成功後に入力欄をクリア
    } catch (error) {
      console.error('送信エラー:', error);
    }
  };

  /**
   * Enter キーで送信
   */
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * ステータスメッセージを取得
   */
  $: status = (() => {
    if (connectionStateValue.error) {
      return { type: 'error', message: connectionStateValue.error };
    }
    if (connectionStateValue.connecting) {
      return { type: 'info', message: '接続中...' };
    }
    if (connectionStateValue.disconnecting) {
      return { type: 'info', message: '切断中...' };
    }
    if (connectionStateValue.connected) {
      return { type: 'success', message: 'シリアルポートに接続しました。' };
    }
    return { type: 'info', message: 'シリアルポートに接続していません。' };
  })();
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
      <div
        class="status-message {browserSupportedValue ? 'success' : 'error'}"
      >
        {browserSupportedValue
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
          disabled={connectionStateValue.connected}
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
          class="btn btn-outline"
          on:click={handleRequestPort}
          disabled={
            !browserSupportedValue ||
            connectionStateValue.connected ||
            connectionStateValue.connecting
          }
        >
          ポートを選択
        </button>
        <button
          class="btn btn-primary"
          on:click={handleConnect}
          disabled={
            !browserSupportedValue ||
            connectionStateValue.connected ||
            connectionStateValue.connecting
          }
        >
          接続
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleDisconnect}
          disabled={
            !connectionStateValue.connected ||
            connectionStateValue.disconnecting
          }
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
            disabled={!connectionStateValue.connected}
            placeholder="送信するテキストを入力..."
          />
          <button
            class="btn btn-primary"
            on:click={handleSend}
            disabled={!connectionStateValue.connected || !sendInput.trim()}
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
          value={receivedDataValue}
          readonly
          placeholder="受信したデータがここに表示されます..."
        />
      </div>
      <div class="button-group">
        <button
          class="btn btn-secondary"
          on:click={clearReceivedData}
          disabled={!receivedDataValue}
        >
          クリア
        </button>
      </div>
    </section>
  </main>
</div>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSerialClient } from '../composables/useSerialClient';

/**
 * メインアプリケーションコンポーネント
 */
const baudRate = ref(9600);
const sendInput = ref('');

const {
  browserSupported,
  connectionState,
  receivedData,
  connect,
  disconnect,
  requestPort,
  send,
  clearReceivedData,
} = useSerialClient(baudRate.value);

/**
 * 接続ボタンのハンドラ
 */
const handleConnect = async () => {
  try {
    await connect(baudRate.value);
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
  if (!sendInput.value.trim()) {
    return;
  }

  try {
    await send(sendInput.value);
    sendInput.value = ''; // 送信成功後に入力欄をクリア
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
const status = computed(() => {
  if (connectionState.value.error) {
    return { type: 'error', message: connectionState.value.error };
  }
  if (connectionState.value.connecting) {
    return { type: 'info', message: '接続中...' };
  }
  if (connectionState.value.disconnecting) {
    return { type: 'info', message: '切断中...' };
  }
  if (connectionState.value.connected) {
    return { type: 'success', message: 'シリアルポートに接続しました。' };
  }
  return { type: 'info', message: 'シリアルポートに接続していません。' };
});
</script>

<template>
  <div class="container">
    <header>
      <h1>Web Serial RxJS - Vue Example</h1>
      <p class="subtitle">
        Vue Composition API を使用した Web Serial API のサンプル
      </p>
    </header>

    <main>
      <!-- ブラウザサポート -->
      <section class="section">
        <h2>ブラウザサポート</h2>
        <div
          :class="[
            'status-message',
            browserSupported ? 'success' : 'error',
          ]"
        >
          {{
            browserSupported
              ? 'ブラウザは Web Serial API をサポートしています。'
              : 'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。'
          }}
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
            :value="baudRate"
            @change="(e) => (baudRate = Number((e.target as HTMLSelectElement).value))"
            :disabled="connectionState.connected"
          >
            <option :value="9600">9600</option>
            <option :value="19200">19200</option>
            <option :value="38400">38400</option>
            <option :value="57600">57600</option>
            <option :value="115200">115200</option>
          </select>
        </div>
        <div class="button-group">
          <button
            class="btn btn-outline"
            @click="handleRequestPort"
            :disabled="
              !browserSupported ||
              connectionState.connected ||
              connectionState.connecting
            "
          >
            ポートを選択
          </button>
          <button
            class="btn btn-primary"
            @click="handleConnect"
            :disabled="
              !browserSupported ||
              connectionState.connected ||
              connectionState.connecting
            "
          >
            接続
          </button>
          <button
            class="btn btn-secondary"
            @click="handleDisconnect"
            :disabled="
              !connectionState.connected || connectionState.disconnecting
            "
          >
            切断
          </button>
        </div>
        <div :class="['status-message', status.type]">
          {{ status.message }}
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
              v-model="sendInput"
              @keydown="handleKeyDown"
              :disabled="!connectionState.connected"
              placeholder="送信するテキストを入力..."
            />
            <button
              class="btn btn-primary"
              @click="handleSend"
              :disabled="!connectionState.connected || !sendInput.trim()"
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
            :value="receivedData"
            readonly
            placeholder="受信したデータがここに表示されます..."
          />
        </div>
        <div class="button-group">
          <button
            class="btn btn-secondary"
            @click="clearReceivedData"
            :disabled="!receivedData"
          >
            クリア
          </button>
        </div>
      </section>
    </main>
  </div>
</template>

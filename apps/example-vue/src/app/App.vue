<script setup lang="ts">
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { computed, ref } from 'vue';
import { useSerialClient } from '../composables/useSerialClient';

type StatusType = 'info' | 'success' | 'error';

const baudRate = ref(9600);
const sendInput = ref('');

const {
  browserSupported,
  state,
  isConnected,
  receivedData,
  errorMessage,
  connect$,
  disconnect$,
  send$,
  clearReceivedData,
} = useSerialClient(baudRate.value);

const connecting = computed(
  () => state.value.status === SerialSessionStatus.Connecting,
);
const disconnecting = computed(
  () => state.value.status === SerialSessionStatus.Disconnecting,
);

const status = computed<{ type: StatusType; message: string }>(() => {
  if (errorMessage.value) {
    return { type: 'error', message: `エラー: ${errorMessage.value}` };
  }
  switch (state.value.status) {
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

const handleConnect = () => {
  clearReceivedData();
  connect$(baudRate.value).subscribe({
    error: (error: unknown) => {
      console.error('接続エラー:', error);
    },
  });
};

const handleDisconnect = () => {
  disconnect$().subscribe({
    error: (error: unknown) => {
      console.error('切断エラー:', error);
    },
  });
};

const handleSend = () => {
  const text = sendInput.value.trim();
  if (!text) {
    return;
  }
  send$(`${text}\n`).subscribe({
    next: () => {
      sendInput.value = '';
    },
    error: (error: unknown) => {
      console.error('送信エラー:', error);
    },
  });
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
};
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
            :disabled="isConnected"
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
            class="btn btn-primary"
            @click="handleConnect"
            :disabled="!browserSupported || isConnected || connecting"
          >
            接続
          </button>
          <button
            class="btn btn-secondary"
            @click="handleDisconnect"
            :disabled="!isConnected || disconnecting"
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
              :disabled="!isConnected"
              placeholder="送信するテキストを入力..."
            />
            <button
              class="btn btn-primary"
              @click="handleSend"
              :disabled="!isConnected || !sendInput.trim()"
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

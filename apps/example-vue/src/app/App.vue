<script setup lang="ts">
import {
  appendExampleLineEnding,
  DEFAULT_EXAMPLE_LINE_ENDING,
  EXAMPLE_LINE_ENDING_OPTIONS,
  formatExamplePortInfo,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
  type ExampleLineEnding,
} from '@gurezo/examples-shared';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';
import { computed, ref } from 'vue';
import { useSerialClient } from '../composables/useSerialClient';

type StatusType = 'info' | 'success' | 'error';

const navLinks = getExampleNavLinks('vue');
const requirements = getExampleRequirementsCopy();
const supportStatus = getExampleSupportStatus();
const externalLinkRel = 'noopener noreferrer';
const lineEndingOptions = EXAMPLE_LINE_ENDING_OPTIONS;

const baudRate = ref(9600);
const sendInput = ref('');
const lineEnding = ref<ExampleLineEnding>(DEFAULT_EXAMPLE_LINE_ENDING);

const {
  canConnect,
  state,
  isConnected,
  receivedData,
  errorMessage,
  errorType,
  errorCode,
  errorContext,
  connect$,
  disconnect$,
  send$,
  clearReceivedData,
  clearError,
} = useSerialClient(baudRate.value);

const sessionStatus = computed(() => formatExampleSessionStatus(state.value));
const controls = computed(() =>
  getExampleControlsEnabled(state.value, canConnect.value),
);
const portInfoDisplay = computed(() =>
  isConnectedSessionState(state.value)
    ? formatExamplePortInfo(state.value.portInfo)
    : null,
);

const status = computed<{ type: StatusType; message: string }>(() => {
  if (errorMessage.value) {
    return {
      type: errorType.value === 'info' ? 'info' : 'error',
      message:
        errorType.value === 'info'
          ? errorMessage.value
          : `エラー: ${errorMessage.value}`,
    };
  }
  if (sessionStatus.value.inProgress) {
    return {
      type: 'info',
      message:
        sessionStatus.value.status === 'connecting' ? '接続中...' : '切断中...',
    };
  }
  if (isConnected.value) {
    return { type: 'success', message: 'シリアルポートに接続しました。' };
  }
  if (state.value.status === 'unsupported') {
    return {
      type: 'error',
      message: supportStatus.statusMessage,
    };
  }
  if (state.value.status === 'error') {
    return { type: 'error', message: 'エラーが発生しました。' };
  }
  return { type: 'info', message: 'シリアルポートに接続していません。' };
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
  send$(appendExampleLineEnding(text, lineEnding.value)).subscribe({
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
      <nav class="example-nav" aria-label="Example links">
        <ul class="example-nav-primary">
          <li>
            <a
              :href="navLinks.viewSource.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.viewSource.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.documentation.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.documentation.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.troubleshooting.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.troubleshooting.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.backToExamples.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.backToExamples.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.reportIssue.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.reportIssue.label }}</a
            >
          </li>
        </ul>
        <ul class="example-nav-source">
          <li>
            <a
              :href="navLinks.sourceParts.entry.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.sourceParts.entry.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.sourceParts.serviceHookStore.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.sourceParts.serviceHookStore.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.sourceParts.ui.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.sourceParts.ui.label }}</a
            >
          </li>
          <li>
            <a
              :href="navLinks.sourceParts.readme.href"
              target="_blank"
              :rel="externalLinkRel"
              >{{ navLinks.sourceParts.readme.label }}</a
            >
          </li>
        </ul>
      </nav>
    </header>

    <main>
      <!-- 利用条件・ブラウザサポート -->
      <section class="section">
        <h2>{{ requirements.title }}</h2>
        <ul class="requirements-list">
          <li v-for="item in requirements.items" :key="item">{{ item }}</li>
        </ul>
        <h3 class="subsection-title">ブラウザサポート</h3>
        <div :class="['status-message', supportStatus.statusType]">
          {{ supportStatus.statusMessage }}
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
            :disabled="!controls.connect"
          >
            接続
          </button>
          <button
            class="btn btn-secondary"
            @click="handleDisconnect"
            :disabled="!controls.disconnect"
          >
            切断
          </button>
        </div>
        <div :class="['status-message', status.type]">
          {{ status.message }}
        </div>
        <h3 class="subsection-title">セッション状態</h3>
        <dl class="session-state-list">
          <div>
            <dt>status</dt>
            <dd data-testid="session-status">{{ sessionStatus.display }}</dd>
          </div>
          <div>
            <dt>進行中</dt>
            <dd data-testid="session-in-progress">
              {{ sessionStatus.inProgress ? 'はい' : 'いいえ' }}
            </dd>
          </div>
          <div v-if="portInfoDisplay">
            <dt>ポート情報</dt>
            <dd data-testid="session-port-info">{{ portInfoDisplay.display }}</dd>
          </div>
        </dl>
        <h3 class="subsection-title">最新エラー</h3>
        <template v-if="errorMessage">
          <dl class="session-state-list">
            <div>
              <dt>message</dt>
              <dd data-testid="session-error-message">{{ errorMessage }}</dd>
            </div>
            <div>
              <dt>code</dt>
              <dd data-testid="session-error-code">{{ errorCode }}</dd>
            </div>
            <div v-if="errorContext">
              <dt>context</dt>
              <dd data-testid="session-error-context">{{ errorContext }}</dd>
            </div>
          </dl>
          <div class="button-group">
            <button
              type="button"
              class="btn btn-outline"
              data-testid="clear-error"
              @click="clearError"
            >
              エラークリア
            </button>
          </div>
        </template>
        <p v-else class="session-empty" data-testid="session-error-empty">
          エラーはありません。
        </p>
      </section>

      <!-- データ送信 -->
      <section class="section">
        <h2>データ送信</h2>
        <div class="form-group">
          <label for="line-ending">改行コード</label>
          <select
            id="line-ending"
            class="form-control"
            v-model="lineEnding"
          >
            <option
              v-for="opt in lineEndingOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="form-group">
          <label for="send-input">送信データ</label>
          <div class="input-group">
            <input
              id="send-input"
              type="text"
              class="form-control"
              v-model="sendInput"
              @keydown="handleKeyDown"
              :disabled="!controls.send"
              placeholder="送信するテキストを入力..."
            />
            <button
              class="btn btn-primary"
              @click="handleSend"
              :disabled="!controls.send || !sendInput.trim()"
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

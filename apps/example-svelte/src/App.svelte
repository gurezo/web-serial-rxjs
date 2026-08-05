<script lang="ts">
  import {
    formatExamplePortInfo,
    formatExampleSessionStatus,
    getExampleControlsEnabled,
    getExampleNavLinks,
    getExampleRequirementsCopy,
    getExampleSupportStatus,
  } from '@gurezo/examples-shared';
  import {
    isConnectedSessionState,
    type SerialSessionState,
  } from '@gurezo/web-serial-rxjs';
  import { useSerialSession } from './stores/useSerialSession';

  const navLinks = getExampleNavLinks('svelte');
  const requirements = getExampleRequirementsCopy();
  const supportStatus = getExampleSupportStatus();
  const externalLinkRel = 'noopener noreferrer';

  let baudRate = 9600;
  let sendInput = '';

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
  } = useSerialSession(baudRate);

  type StatusType = 'info' | 'success' | 'error';

  const statusFor = (
    current: SerialSessionState,
    error: string | null,
    tone: 'info' | 'error' | null,
  ): { type: StatusType; message: string } => {
    if (error) {
      return {
        type: tone === 'info' ? 'info' : 'error',
        message: tone === 'info' ? error : `エラー: ${error}`,
      };
    }
    const session = formatExampleSessionStatus(current);
    if (session.inProgress) {
      return {
        type: 'info',
        message: session.status === 'connecting' ? '接続中...' : '切断中...',
      };
    }
    if (isConnectedSessionState(current)) {
      return { type: 'success', message: 'シリアルポートに接続しました。' };
    }
    if (current.status === 'unsupported') {
      return {
        type: 'error',
        message: supportStatus.statusMessage,
      };
    }
    if (current.status === 'error') {
      return { type: 'error', message: 'エラーが発生しました。' };
    }
    return { type: 'info', message: 'シリアルポートに接続していません。' };
  };

  $: status = statusFor($state, $errorMessage, $errorType);
  $: sessionStatus = formatExampleSessionStatus($state);
  $: controls = getExampleControlsEnabled($state, $canConnect);
  $: portInfoDisplay = isConnectedSessionState($state)
    ? formatExamplePortInfo($state.portInfo)
    : null;

  const handleConnect = () => {
    clearReceivedData();
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
    <nav class="example-nav" aria-label="Example links">
      <ul class="example-nav-primary">
        <li>
          <a
            href={navLinks.viewSource.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.viewSource.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.documentation.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.documentation.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.backToExamples.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.backToExamples.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.reportIssue.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.reportIssue.label}</a
          >
        </li>
      </ul>
      <ul class="example-nav-source">
        <li>
          <a
            href={navLinks.sourceParts.entry.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.sourceParts.entry.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.sourceParts.serviceHookStore.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.sourceParts.serviceHookStore.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.sourceParts.ui.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.sourceParts.ui.label}</a
          >
        </li>
        <li>
          <a
            href={navLinks.sourceParts.readme.href}
            target="_blank"
            rel={externalLinkRel}
            >{navLinks.sourceParts.readme.label}</a
          >
        </li>
      </ul>
    </nav>
  </header>

  <main>
    <!-- 利用条件・ブラウザサポート -->
    <section class="section">
      <h2>{requirements.title}</h2>
      <ul class="requirements-list">
        {#each requirements.items as item}
          <li>{item}</li>
        {/each}
      </ul>
      <h3 class="subsection-title">ブラウザサポート</h3>
      <div class="status-message {supportStatus.statusType}">
        {supportStatus.statusMessage}
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
          disabled={$isConnected}
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
          disabled={!controls.connect}
        >
          接続
        </button>
        <button
          class="btn btn-secondary"
          on:click={handleDisconnect}
          disabled={!controls.disconnect}
        >
          切断
        </button>
      </div>
      <div class="status-message {status.type}">
        {status.message}
      </div>
      <h3 class="subsection-title">セッション状態</h3>
      <dl class="session-state-list">
        <div>
          <dt>status</dt>
          <dd data-testid="session-status">{sessionStatus.display}</dd>
        </div>
        <div>
          <dt>進行中</dt>
          <dd data-testid="session-in-progress"
            >{sessionStatus.inProgress ? 'はい' : 'いいえ'}</dd
          >
        </div>
        {#if portInfoDisplay}
          <div>
            <dt>ポート情報</dt>
            <dd data-testid="session-port-info">{portInfoDisplay.display}</dd>
          </div>
        {/if}
      </dl>
      <h3 class="subsection-title">最新エラー</h3>
      {#if $errorMessage}
        <dl class="session-state-list">
          <div>
            <dt>message</dt>
            <dd data-testid="session-error-message">{$errorMessage}</dd>
          </div>
          <div>
            <dt>code</dt>
            <dd data-testid="session-error-code">{$errorCode}</dd>
          </div>
          {#if $errorContext}
            <div>
              <dt>context</dt>
              <dd data-testid="session-error-context">{$errorContext}</dd>
            </div>
          {/if}
        </dl>
        <div class="button-group">
          <button
            type="button"
            class="btn btn-outline"
            data-testid="clear-error"
            on:click={clearError}
          >
            エラークリア
          </button>
        </div>
      {:else}
        <p class="session-empty" data-testid="session-error-empty">
          エラーはありません。
        </p>
      {/if}
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
            disabled={!controls.send}
            placeholder="送信するテキストを入力..."
          />
          <button
            class="btn btn-primary"
            on:click={handleSend}
            disabled={!controls.send || !sendInput.trim()}
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

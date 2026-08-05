import {
  formatExamplePortInfo,
  formatExampleSessionStatus,
  getExampleControlsEnabled,
  getExampleNavLinks,
  getExampleRequirementsCopy,
  getExampleSupportStatus,
} from '@gurezo/examples-shared';
import { isConnectedSessionState } from '@gurezo/web-serial-rxjs';
import { useMemo, useState } from 'react';
import { useSerialSession } from './hooks/useSerialSession';

type StatusType = 'info' | 'success' | 'error';

const navLinks = getExampleNavLinks('react');
const requirements = getExampleRequirementsCopy();
const externalLinkProps = {
  target: '_blank',
  rel: 'noopener noreferrer',
} as const;

export function App() {
  const [baudRate, setBaudRate] = useState(9600);
  const [sendInput, setSendInput] = useState('');
  const supportStatus = useMemo(() => getExampleSupportStatus(), []);
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

  const sessionStatus = formatExampleSessionStatus(state);
  const controls = getExampleControlsEnabled(state, canConnect);
  const portInfoDisplay = isConnectedSessionState(state)
    ? formatExamplePortInfo(state.portInfo)
    : null;

  const status: { type: StatusType; message: string } = errorMessage
    ? {
        type: errorType === 'info' ? 'info' : 'error',
        message:
          errorType === 'info' ? errorMessage : `エラー: ${errorMessage}`,
      }
    : sessionStatus.inProgress
      ? {
          type: 'info',
          message:
            sessionStatus.status === 'connecting' ? '接続中...' : '切断中...',
        }
      : isConnected
        ? { type: 'success', message: 'シリアルポートに接続しました。' }
        : { type: 'info', message: 'シリアルポートに接続していません。' };

  const handleConnect = () => {
    clearReceivedData();
    connect$(baudRate).subscribe({
      error: (e: unknown) => console.error('接続エラー:', e),
    });
  };
  const handleDisconnect = () =>
    disconnect$().subscribe({
      error: (e: unknown) => console.error('切断エラー:', e),
    });
  const handleSend = () => {
    const text = sendInput.trim();
    if (!text) return;
    send$(`${text}\n`).subscribe({
      next: () => setSendInput(''),
      error: (e: unknown) => console.error('送信エラー:', e),
    });
  };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="container">
      <header>
        <h1>Web Serial RxJS - React Example</h1>
        <p className="subtitle">
          React カスタムフックを使用した Web Serial API のサンプル
        </p>
        <nav className="example-nav" aria-label="Example links">
          <ul className="example-nav-primary">
            <li>
              <a href={navLinks.viewSource.href} {...externalLinkProps}>
                {navLinks.viewSource.label}
              </a>
            </li>
            <li>
              <a href={navLinks.documentation.href} {...externalLinkProps}>
                {navLinks.documentation.label}
              </a>
            </li>
            <li>
              <a href={navLinks.backToExamples.href} {...externalLinkProps}>
                {navLinks.backToExamples.label}
              </a>
            </li>
            <li>
              <a href={navLinks.reportIssue.href} {...externalLinkProps}>
                {navLinks.reportIssue.label}
              </a>
            </li>
          </ul>
          <ul className="example-nav-source">
            <li>
              <a href={navLinks.sourceParts.entry.href} {...externalLinkProps}>
                {navLinks.sourceParts.entry.label}
              </a>
            </li>
            <li>
              <a
                href={navLinks.sourceParts.serviceHookStore.href}
                {...externalLinkProps}
              >
                {navLinks.sourceParts.serviceHookStore.label}
              </a>
            </li>
            <li>
              <a href={navLinks.sourceParts.ui.href} {...externalLinkProps}>
                {navLinks.sourceParts.ui.label}
              </a>
            </li>
            <li>
              <a href={navLinks.sourceParts.readme.href} {...externalLinkProps}>
                {navLinks.sourceParts.readme.label}
              </a>
            </li>
          </ul>
        </nav>
      </header>
      <main>
        <section className="section">
          <h2>{requirements.title}</h2>
          <ul className="requirements-list">
            {requirements.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <h3 className="subsection-title">ブラウザサポート</h3>
          <div className={`status-message ${supportStatus.statusType}`}>
            {supportStatus.statusMessage}
          </div>
        </section>
        <section className="section">
          <h2>接続設定</h2>
          <div className="form-group">
            <label htmlFor="baud-rate">ボーレート</label>
            <select
              id="baud-rate"
              className="form-control"
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={isConnected}
            >
              {[9600, 19200, 38400, 57600, 115200].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="button-group">
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={!controls.connect}
            >
              接続
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              disabled={!controls.disconnect}
            >
              切断
            </button>
          </div>
          <div className={`status-message ${status.type}`}>{status.message}</div>
          <h3 className="subsection-title">セッション状態</h3>
          <dl className="session-state-list">
            <div>
              <dt>status</dt>
              <dd data-testid="session-status">{sessionStatus.display}</dd>
            </div>
            <div>
              <dt>進行中</dt>
              <dd data-testid="session-in-progress">
                {sessionStatus.inProgress ? 'はい' : 'いいえ'}
              </dd>
            </div>
            {portInfoDisplay ? (
              <div>
                <dt>ポート情報</dt>
                <dd data-testid="session-port-info">{portInfoDisplay.display}</dd>
              </div>
            ) : null}
          </dl>
          <h3 className="subsection-title">最新エラー</h3>
          {errorMessage ? (
            <>
              <dl className="session-state-list">
                <div>
                  <dt>message</dt>
                  <dd data-testid="session-error-message">{errorMessage}</dd>
                </div>
                <div>
                  <dt>code</dt>
                  <dd data-testid="session-error-code">{errorCode}</dd>
                </div>
                {errorContext ? (
                  <div>
                    <dt>context</dt>
                    <dd data-testid="session-error-context">{errorContext}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="button-group">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={clearError}
                  data-testid="clear-error"
                >
                  エラークリア
                </button>
              </div>
            </>
          ) : (
            <p className="session-empty" data-testid="session-error-empty">
              エラーはありません。
            </p>
          )}
        </section>
        <section className="section">
          <h2>データ送信</h2>
          <div className="form-group">
            <label htmlFor="send-input">送信データ</label>
            <div className="input-group">
              <input
                id="send-input"
                type="text"
                className="form-control"
                value={sendInput}
                onChange={(e) => setSendInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!controls.send}
                placeholder="送信するテキストを入力..."
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!controls.send || !sendInput.trim()}
              >
                送信
              </button>
            </div>
          </div>
        </section>
        <section className="section">
          <h2>データ受信</h2>
          <div className="form-group">
            <label htmlFor="receive-output">受信データ</label>
            <textarea
              id="receive-output"
              className="form-control receive-output"
              value={receivedData}
              readOnly
              placeholder="受信したデータがここに表示されます..."
            />
          </div>
          <div className="button-group">
            <button
              className="btn btn-secondary"
              onClick={clearReceivedData}
              disabled={!receivedData}
            >
              クリア
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

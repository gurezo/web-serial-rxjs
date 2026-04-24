import { useState } from 'react';
import { useSerialSession } from './hooks/useSerialSession';

type StatusType = 'info' | 'success' | 'error';

export function App() {
  const [baudRate, setBaudRate] = useState(9600);
  const [sendInput, setSendInput] = useState('');
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

  const connected = state === 'connected';
  const connecting = state === 'connecting';
  const disconnecting = state === 'disconnecting';

  const status: { type: StatusType; message: string } = errorMessage
    ? { type: 'error', message: `エラー: ${errorMessage}` }
    : connecting
      ? { type: 'info', message: '接続中...' }
      : disconnecting
        ? { type: 'info', message: '切断中...' }
        : connected
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
      </header>
      <main>
        <section className="section">
          <h2>ブラウザサポート</h2>
          <div className={`status-message ${browserSupported ? 'success' : 'error'}`}>
            {browserSupported
              ? 'ブラウザは Web Serial API をサポートしています。'
              : 'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。'}
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
              disabled={connected}
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
              disabled={!browserSupported || connected || connecting}
            >
              接続
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              disabled={!connected || disconnecting}
            >
              切断
            </button>
          </div>
          <div className={`status-message ${status.type}`}>{status.message}</div>
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
                disabled={!connected}
                placeholder="送信するテキストを入力..."
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!connected || !sendInput.trim()}
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

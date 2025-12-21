import { useState } from 'react';
import { useSerialClient } from './hooks/useSerialClient';

/**
 * メインアプリケーションコンポーネント
 */
export function App() {
  const [baudRate, setBaudRate] = useState(9600);
  const [sendInput, setSendInput] = useState('');

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
      setSendInput(''); // 送信成功後に入力欄をクリア
    } catch (error) {
      console.error('送信エラー:', error);
    }
  };

  /**
   * Enter キーで送信
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /**
   * ステータスメッセージを取得
   */
  const getStatusMessage = (): { type: string; message: string } => {
    if (connectionState.error) {
      return { type: 'error', message: connectionState.error };
    }
    if (connectionState.connecting) {
      return { type: 'info', message: '接続中...' };
    }
    if (connectionState.disconnecting) {
      return { type: 'info', message: '切断中...' };
    }
    if (connectionState.connected) {
      return { type: 'success', message: 'シリアルポートに接続しました。' };
    }
    return { type: 'info', message: 'シリアルポートに接続していません。' };
  };

  const status = getStatusMessage();

  return (
    <div className="container">
      <header>
        <h1>Web Serial RxJS - React Example</h1>
        <p className="subtitle">
          React カスタムフックを使用した Web Serial API のサンプル
        </p>
      </header>

      <main>
        {/* ブラウザサポート */}
        <section className="section">
          <h2>ブラウザサポート</h2>
          <div
            className={`status-message ${
              browserSupported ? 'success' : 'error'
            }`}
          >
            {browserSupported
              ? 'ブラウザは Web Serial API をサポートしています。'
              : 'このブラウザは Web Serial API をサポートしていません。Chrome、Edge、Opera などの Chromium ベースのブラウザをご使用ください。'}
          </div>
        </section>

        {/* 接続設定 */}
        <section className="section">
          <h2>接続設定</h2>
          <div className="form-group">
            <label htmlFor="baud-rate">ボーレート</label>
            <select
              id="baud-rate"
              className="form-control"
              value={baudRate}
              onChange={(e) => setBaudRate(Number(e.target.value))}
              disabled={connectionState.connected}
            >
              <option value={9600}>9600</option>
              <option value={19200}>19200</option>
              <option value={38400}>38400</option>
              <option value={57600}>57600</option>
              <option value={115200}>115200</option>
            </select>
          </div>
          <div className="button-group">
            <button
              className="btn btn-outline"
              onClick={handleRequestPort}
              disabled={
                !browserSupported ||
                connectionState.connected ||
                connectionState.connecting
              }
            >
              ポートを選択
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConnect}
              disabled={
                !browserSupported ||
                connectionState.connected ||
                connectionState.connecting
              }
            >
              接続
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleDisconnect}
              disabled={
                !connectionState.connected || connectionState.disconnecting
              }
            >
              切断
            </button>
          </div>
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        </section>

        {/* データ送信 */}
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
                disabled={!connectionState.connected}
                placeholder="送信するテキストを入力..."
              />
              <button
                className="btn btn-primary"
                onClick={handleSend}
                disabled={!connectionState.connected || !sendInput.trim()}
              >
                送信
              </button>
            </div>
          </div>
        </section>

        {/* データ受信 */}
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

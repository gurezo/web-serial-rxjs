# クイックスタート

v1 の推奨導線（`text$` / `state$` / `send$`）で始めると、`TextDecoder` / `TextEncoder` の手動処理が不要です。

```typescript
import {
  createSerialClient,
  isBrowserSupported,
} from '@gurezo/web-serial-rxjs';

// ブラウザサポートをチェック
if (!isBrowserSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
  return;
}

// シリアルクライアントを作成
const client = createSerialClient({ baudRate: 9600 });

client.state$.subscribe((state) => {
  console.log('状態:', state);
});

client.text$.subscribe((text) => {
  console.log('受信:', text);
});

// シリアルポートに接続（ポート選択ダイアログを表示）
client.connect().subscribe({
  next: () => {
    client.send$('help\n').subscribe({
      next: () => console.log('送信: help'),
      error: (error) => console.error('送信エラー:', error),
    });
  },
  error: (error) => {
    console.error('接続エラー:', error);
  },
});
```

## 使用例

### 基本的な接続

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

const client = createSerialClient({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

// 接続（ユーザーにポート選択を促す）
client.connect().subscribe({
  next: () => console.log('接続しました'),
  error: (error) => console.error('接続に失敗しました:', error),
});
```

### テキストと行の読み取り

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    client.text$.subscribe((text) => console.log('チャンク:', text));
    client.lines$.subscribe((line) => console.log('行:', line));
  },
});
```

### 順序保証付き送信

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // send$ は内部キューにより送信順序を保証します。
    const messages = ['メッセージ 1\n', 'メッセージ 2\n', 'メッセージ 3\n'];
    from(messages)
      .pipe(concatMap((msg) => client.send$(msg)))
      .subscribe({
        next: () => console.log('メッセージを書き込みました'),
        error: (error) => console.error('送信エラー:', error),
      });
  },
});
```

### エラーハンドリング

```typescript
import {
  createSerialClient,
  SerialError,
  SerialErrorCode,
} from '@gurezo/web-serial-rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => console.log('接続しました'),
  error: (error) => {
    if (error instanceof SerialError) {
      switch (error.code) {
        case SerialErrorCode.BROWSER_NOT_SUPPORTED:
          console.error('ブラウザが Web Serial API をサポートしていません');
          break;
        case SerialErrorCode.PORT_NOT_AVAILABLE:
          console.error('シリアルポートが利用できません');
          break;
        case SerialErrorCode.CONNECTION_LOST:
          console.error('接続が切断されました');
          break;
        default:
          console.error('シリアルエラー:', error.message);
      }
    } else {
      console.error('不明なエラー:', error);
    }
  },
});
```

### ポートフィルタリング

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';

// USB ベンダー ID でポートをフィルタリング
const client = createSerialClient({
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }, { usbVendorId: 0x5678 }],
});

// 特定のポートをリクエスト
client.requestPort().subscribe({
  next: (port) => {
    console.log('ポートが選択されました:', port);
    // 選択されたポートに接続
    client.connect(port).subscribe({
      next: () => console.log('フィルタリングされたポートに接続しました'),
      error: (error) => console.error('接続エラー:', error),
    });
  },
  error: (error) => console.error('ポートリクエストエラー:', error),
});
```

## 次のステップ

- 詳細な API ドキュメントは [API リファレンス](./API_REFERENCE.ja.md) を参照してください
- より複雑なパターンについては [高度な使用方法](./ADVANCED_USAGE.ja.md) を確認してください
- フレームワーク固有の統合については [フレームワーク別の例](../README.ja.md#フレームワーク別の例) を探索してください

# クイックスタート

簡単な使用例：

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

// シリアルポートに接続
client.connect().subscribe({
  next: () => {
    console.log('シリアルポートに接続しました');

    // シリアルポートからデータを読み取る
    client.getReadStream().subscribe({
      next: (data: Uint8Array) => {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        console.log('受信:', text);
      },
      error: (error) => {
        console.error('読み取りエラー:', error);
      },
    });

    // シリアルポートにデータを書き込む
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello, Serial Port!\n');
    client.write(data).subscribe({
      next: () => console.log('データを書き込みました'),
      error: (error) => console.error('書き込みエラー:', error),
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

### データの読み取り

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { map } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // データを読み取ってデコード
    client
      .getReadStream()
      .pipe(
        map((data: Uint8Array) => {
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(data);
        }),
      )
      .subscribe({
        next: (text) => console.log('受信:', text),
        error: (error) => console.error('読み取りエラー:', error),
      });
  },
});
```

### データの書き込み

```typescript
import { createSerialClient } from '@gurezo/web-serial-rxjs';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // 単一のチャンクを書き込む
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello\n');
    client.write(data).subscribe({
      next: () => console.log('書き込みました'),
      error: (error) => console.error('書き込みエラー:', error),
    });

    // Observable ストリームから書き込む
    const messages = ['メッセージ 1\n', 'メッセージ 2\n', 'メッセージ 3\n'];
    const dataStream$ = from(messages).pipe(
      map((msg) => new TextEncoder().encode(msg)),
    );
    client.writeStream(dataStream$).subscribe({
      next: () => console.log('すべてのメッセージを書き込みました'),
      error: (error) => console.error('ストリーム書き込みエラー:', error),
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

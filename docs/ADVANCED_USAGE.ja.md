# 高度な使用方法

## Observable パターン

RxJS オペレーターを使用してシリアルデータを処理できます：

```typescript
import { map, filter, bufferTime } from 'rxjs/operators';

client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    filter((text) => text.trim().length > 0),
    bufferTime(1000), // 1 秒間メッセージをバッファリング
  )
  .subscribe({
    next: (messages) => {
      console.log('バッファリングされたメッセージ:', messages);
    },
  });
```

## ストリーム処理

RxJS オペレーターでデータストリームを処理：

```typescript
import { map, scan, debounceTime } from 'rxjs/operators';

// 受信データを累積
client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    scan((acc, current) => acc + current, ''),
    debounceTime(500),
  )
  .subscribe({
    next: (accumulated) => {
      console.log('累積データ:', accumulated);
    },
  });
```

## カスタムフィルター

ポートフィルターを使用して利用可能なポートを制限：

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

## エラー回復

エラー回復パターンを実装：

```typescript
import { retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

client
  .getReadStream()
  .pipe(
    retry({
      count: 3,
      delay: 1000,
    }),
    catchError((error) => {
      console.error('リトライ後も失敗:', error);
      return of(null); // 空の observable を返す
    }),
  )
  .subscribe({
    next: (data) => {
      if (data) {
        console.log('受信:', data);
      }
    },
  });
```

## 関連ドキュメント

- [クイックスタートガイド](./QUICK_START.ja.md) - 基本的な例で始める
- [API リファレンス](./API_REFERENCE.ja.md) - 詳細な API ドキュメント

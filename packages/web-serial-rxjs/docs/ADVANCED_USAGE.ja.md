# 高度な使用方法

## リアクティブな受信パターン

`text$` と `lines$` をそのまま利用できるため、手動デコードは不要です：

```typescript
import { bufferTime, filter } from 'rxjs/operators';

client
  .lines$
  .pipe(
    filter((line) => line.trim().length > 0),
    bufferTime(1000), // 1秒分の行をまとめる
  )
  .subscribe({
    next: (lines) => {
      console.log('バッファリングされた行:', lines);
    },
  });
```

## 順序保証付きコマンド実行

`send$` / `command$` は内部キューで直列化されるため、並行呼び出しでも順序が保たれます：

```typescript
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';

const commands = ['help', 'status', 'version'];

from(commands)
  .pipe(concatMap((command) => client.command$(command)))
  .subscribe({
    next: ({ stdout }) => {
      console.log('コマンド出力:', stdout);
    },
    error: (error) => {
      console.error('コマンド実行失敗:', error);
    },
  });
```

## リクエスト/レスポンス取引

`transact$` を使うと、送信・待受・抽出を1つの操作として扱えます：

```typescript
client
  .transact$({
    payload: 'read-temp',
    prompt: /device>\s$/,
    timeout: 5000,
    collect: (stdout) => {
      const match = stdout.match(/TEMP:\s*([0-9.]+)/);
      if (!match) {
        throw new Error('温度フィールドが見つかりませんでした');
      }
      return Number.parseFloat(match[1]);
    },
  })
  .subscribe({
    next: (temperature) => {
      console.log('温度:', temperature);
    },
    error: (error) => {
      console.error('トランザクション失敗:', error);
    },
  });
```

## 状態・エラーストリーム

UI 側の状態管理は `state$` と `errors$` に集約できます：

```typescript
client.state$.subscribe((state) => {
  switch (state.kind) {
    case 'connecting':
    case 'connected':
    case 'disconnecting':
      console.log('状態:', state.kind);
      break;
    case 'unsupported':
      console.warn('未対応ブラウザ:', state.support.reason);
      break;
    case 'error':
      console.error('状態遷移エラー:', state.error.message);
      break;
    default:
      console.log('状態:', state.kind);
  }
});

client.errors$.subscribe((error) => {
  console.error('エラーストリーム:', error.code, error.message);
});
```

## カスタムフィルター

ポート選択対象を絞りたい場合はフィルターを設定します：

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

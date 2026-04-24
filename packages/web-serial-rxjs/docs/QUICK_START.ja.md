# クイックスタート

v2 の公開 API は `createSerialSession` が返す単一の `SerialSession` です。`state$` / `receive$` / `errors$` を購読し、`connect$` / `disconnect$` / `send$` でポートを操作します。

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });

if (!session.isBrowserSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
}

session.state$.subscribe((state) => console.log('状態:', state));
session.receive$.subscribe((text) => console.log('受信:', text));
session.errors$.subscribe((error) => console.error('シリアルエラー:', error));

session.connect$().subscribe({
  next: () => {
    session.send$('help\n').subscribe({
      error: (error) => console.error('送信エラー:', error),
    });
  },
  error: (error) => console.error('接続エラー:', error),
});
```

## 使用例

### 基本的な接続

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

session.connect$().subscribe({
  next: () => console.log('接続しました'),
  error: (error) => console.error('接続に失敗しました:', error),
});
```

### テキストを読み取る

`receive$` はストリーミング `TextDecoder` を用いて UTF-8 デコード済みの文字列を emit します。マルチバイト文字がチャンクをまたいでも正しく結合されます。行単位で扱いたい場合は RxJS のオペレータで整形します。

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';
import { scan, filter, map } from 'rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.connect$().subscribe();

session.receive$.subscribe((chunk) => console.log('chunk:', chunk));

session.receive$
  .pipe(
    scan(
      (acc, chunk) => {
        const combined = acc.buffer + chunk;
        const parts = combined.split('\n');
        return { buffer: parts.pop() ?? '', lines: parts };
      },
      { buffer: '', lines: [] as string[] },
    ),
    filter((s) => s.lines.length > 0),
    map((s) => s.lines),
  )
  .subscribe((lines) => lines.forEach((line) => console.log('行:', line)));
```

### 順序を保証した送信

`send$` は内部の FIFO キューにより、並行する呼び出しでも呼び出し順にポートへ書き込まれます。

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';
import { from, concatMap } from 'rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.connect$().subscribe({
  next: () => {
    const messages = ['メッセージ 1\n', 'メッセージ 2\n', 'メッセージ 3\n'];
    from(messages)
      .pipe(concatMap((msg) => session.send$(msg)))
      .subscribe({
        error: (error) => console.error('送信エラー:', error),
      });
  },
});
```

### エラーハンドリング

接続・読み取り・書き込み・クローズで発生するすべてのエラーは `SerialError` に正規化され、`errors$` に流れます。致命的なエラーは `state$` を `'error'` に遷移させます。

```typescript
import {
  createSerialSession,
  SerialError,
  SerialErrorCode,
} from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });

session.errors$.subscribe((error: SerialError) => {
  switch (error.code) {
    case SerialErrorCode.BROWSER_NOT_SUPPORTED:
      console.error('Web Serial API がサポートされていません');
      break;
    case SerialErrorCode.PORT_OPEN_FAILED:
      console.error('ポートのオープンに失敗:', error.message);
      break;
    case SerialErrorCode.READ_FAILED:
    case SerialErrorCode.CONNECTION_LOST:
      console.error('接続が失われました');
      break;
    case SerialErrorCode.WRITE_FAILED:
      console.error('書き込みに失敗:', error.message);
      break;
    default:
      console.error('シリアルエラー:', error);
  }
});

session.connect$().subscribe({
  error: () => {
    // errors$ 側でも流れているのでここでは握り潰しても OK
  },
});
```

### ポートフィルタ

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }, { usbVendorId: 0x5678 }],
});

session.connect$().subscribe({
  error: (error) => console.error('接続エラー:', error),
});
```

## 次のステップ

- `SerialSession` の全インターフェイスは [API リファレンス](./API_REFERENCE.ja.md) を参照してください。
- 応用パターンは [高度な使用方法](./ADVANCED_USAGE.ja.md) を参照してください。
- v1 からの移行は [v1 → v2 マイグレーションガイド](https://github.com/gurezo/web-serial-rxjs/blob/main/docs/MIGRATION_V2.ja.md) を参照してください。

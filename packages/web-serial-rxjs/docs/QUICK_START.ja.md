# クイックスタート

**最短で**シリアルポートを開き、行単位で受信し、送信・切断するところまで進む手順です。`state$` / `receive$` / `errors$` と各メソッドの一覧は、先に[リポジトリの README](../../../README.ja.md#serialsessionv2の全体像)を参照してください。

`SerialSession` にビルトインの `lines$` や `connected$` はありません。下記では `receive$` と `state$` から**派生**させます（パターンの説明は[高度な使用方法](./ADVANCED_USAGE.ja.md#行単位のフレーミング)）。

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
}

const connected$ = session.state$.pipe(map((s) => s === 'connected'));

const lines$ = session.receive$.pipe(
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
);

connected$.subscribe((isConnected) => console.log('接続中:', isConnected));
lines$.subscribe((lines) => lines.forEach((line) => console.log('行:', line)));

// 本番では errors$ を購読して SerialError を扱うことを推奨します
session.errors$.subscribe((err) => console.error('シリアルエラー:', err));

session.connect$().subscribe({
  next: () => {
    session.send$('ls\r\n').subscribe({
      error: (e) => console.error('送信エラー:', e),
    });
  },
  error: (e) => console.error('接続エラー:', e),
});
```

## 切断する

ポートを閉じるときは `disconnect$` を呼びます。

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('切断エラー:', e),
});
```

## 次のステップ

- 公開メソッドとストリームの一覧は [API リファレンス](./API_REFERENCE.ja.md) を参照してください。
- チャンク単位の受信、送信の順序制御、エラー分岐の詳細、ポートフィルタなどは [高度な使用方法](./ADVANCED_USAGE.ja.md) を参照してください。
- v1 からの移行は [v1 → v2 マイグレーション](./MIGRATION_V2.ja.md) を参照してください。

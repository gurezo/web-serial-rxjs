# クイックスタート

**最短で**シリアルポートを開き、行単位で受信し、送信・切断するところまで進む手順です。`state$` / `receive$` / `lines$` / `errors$` と各メソッドの一覧は、先に[リポジトリの README](../../../README.ja.md#serialsessionv2の全体像)を参照してください。

標準的な改行区切り（`\n` / `\r\n`）には **`lines$`** を使います。**`receive$`** はデコーダが返す生のチャンク列のままです。独自区切りや別の分割ルールが必要なときは `receive$` 上に `scan` などで組み立てます（[高度な使用方法](./ADVANCED_USAGE.ja.md#行単位のフレーミング)）。接続の真偽は **`isConnected$`** を使うか、従来どおり `state$` から `map` しても構いません。

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
}

session.isConnected$.subscribe((isConnected) => console.log('接続中:', isConnected));
session.lines$.subscribe((line) => console.log('行:', line));

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

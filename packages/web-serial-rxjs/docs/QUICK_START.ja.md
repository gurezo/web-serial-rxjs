# クイックスタート

**最短で**シリアルポートを開き、行単位で受信し、送信・切断するところまで進む手順です。`state$` / `errors$` / `receive$` / `lines$` と各メソッドの一覧は、先に [SerialSession の概要](./OVERVIEW.ja.md#serialsessionの全体像)を参照してください。

標準的な改行区切り（`\n` / `\r\n`）には **`lines$`** を使います。**`receive$`** はデコーダが返す生のチャンク列のままです。ライフサイクル UI には **`state$`** の `state.status` narrowing を優先してください。**`isConnected$`** は boolean だけ欲しい場合の convenience stream です。

### SerialSessionStatus（早見表）

| 定数 | 値 | 意味 |
| --- | --- | --- |
| `SerialSessionStatus.Idle` | `'idle'` | ポート未接続。Web Serial 利用可能な場合の初期値。 |
| `SerialSessionStatus.Connecting` | `'connecting'` | `connect$` 実行中。 |
| `SerialSessionStatus.Connected` | `'connected'` | ポートが開き、read pump が動作中（`portInfo` 付き）。 |
| `SerialSessionStatus.Disconnecting` | `'disconnecting'` | `disconnect$` 実行中。 |
| `SerialSessionStatus.Unsupported` | `'unsupported'` | セッション生成時点で Web Serial が利用できない。 |
| `SerialSessionStatus.Error` | `'error'` | 致命的な失敗（`error` 付き）。 |
| `SerialSessionStatus.Disposed` | `'disposed'` | `dispose$` により永久破棄。すべての Observable が complete。 |

詳細は [API リファレンス](./API_REFERENCE.ja.md#serialsessionstate--serialsessionstatus) と [v3 移行ガイド](./MIGRATION_V3.ja.md) を参照してください。

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

`state$` の分岐は **`state.status`** を **`SerialSessionStatus`** の定数と比較します:

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    console.warn('このブラウザでは Web Serial を利用できません');
  }
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

## 切断する

ポートを閉じつつセッションを再利用可能なままにしたいときは `disconnect$` を呼びます。

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('切断エラー:', e),
});
```

## 破棄する

baud rate 変更で session を作り替えるなど、セッション自体を完全に手放すときは `dispose$` を呼びます。アクティブな接続を閉じ、すべての Observable を complete します。（`destroy$` は `dispose$` のエイリアスです。）

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('破棄エラー:', e),
});
```

破棄後は古いインスタンスを再利用せず、新しい `createSerialSession()` を作成してください。

## 次のステップ

- 公開メソッドとストリームの一覧は [API リファレンス](./API_REFERENCE.ja.md) を参照してください。
- チャンク単位の受信、送信の順序制御、エラー分岐の詳細、ポートフィルタなどは [高度な使用方法](./ADVANCED_USAGE.ja.md) を参照してください。
- v2 型モデルからの移行は [v2 → v3 マイグレーション](./MIGRATION_V3.ja.md) を参照してください。
- v1 からの移行は [v1 → v2 マイグレーション](./MIGRATION_V2.ja.md) を参照してください。

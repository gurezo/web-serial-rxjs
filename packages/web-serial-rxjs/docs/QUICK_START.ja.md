# クイックスタート

**最短で**シリアルポートを開き、行単位で受信し、送信・切断するところまで進む手順です。`state$` / `isConnected$` / `receive$` / `lines$` / `errors$` と各メソッドの一覧は、先に [SerialSession（v2）の概要](./OVERVIEW.ja.md#serialsessionv2の全体像)を参照してください。

標準的な改行区切り（`\n` / `\r\n`）には **`lines$`** を使います。**`receive$`** はデコーダが返す生のチャンク列のままです。独自区切りや別の分割ルールが必要なときは `receive$` 上に `scan` などで組み立てます（[高度な使用方法](./ADVANCED_USAGE.ja.md#行単位のフレーミング)）。接続の真偽は **`isConnected$`** を使うか、従来どおり `state$` から `map` しても構いません。

### SerialSessionState（早見表）

| 定数 | 値 | 意味 |
| --- | --- | --- |
| `SerialSessionState.Idle` | `'idle'` | ポート未接続。Web Serial 利用可能な場合の初期値。 |
| `SerialSessionState.Connecting` | `'connecting'` | `connect$` 実行中。 |
| `SerialSessionState.Connected` | `'connected'` | ポートが開き、read pump が動作中。 |
| `SerialSessionState.Disconnecting` | `'disconnecting'` | `disconnect$` 実行中。 |
| `SerialSessionState.Unsupported` | `'unsupported'` | セッション生成時点で Web Serial が利用できない。 |
| `SerialSessionState.Error` | `'error'` | 致命的な失敗。`disconnect$` または新しいセッションで復帰。 |
| `SerialSessionState.Disposed` | `'disposed'` | `dispose$` により永久破棄。すべての Observable が complete。 |

遷移・詳細は [API リファレンスの SerialSessionState](./API_REFERENCE.ja.md#serialsessionstate) を参照してください。

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

`state$` の分岐は **`SerialSessionState`** の定数で比較します（`'connected'` などの文字列直書きは避けてください）:

```typescript
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((s) => {
  if (s === SerialSessionState.Unsupported) {
    console.warn('このブラウザでは Web Serial を利用できません');
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

baud rate 変更で session を作り替えるなど、セッション自体を完全に手放すときは `dispose$`（または `destroy$`）を呼びます。アクティブな接続を閉じ、すべての Observable を complete します。

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('破棄エラー:', e),
});
```

破棄後は古いインスタンスを再利用せず、新しい `createSerialSession()` を作成してください。

## 次のステップ

- 公開メソッドとストリームの一覧は [API リファレンス](./API_REFERENCE.ja.md) を参照してください。
- チャンク単位の受信、送信の順序制御、エラー分岐の詳細、ポートフィルタなどは [高度な使用方法](./ADVANCED_USAGE.ja.md) を参照してください。
- v1 からの移行は [v1 → v2 マイグレーション](./MIGRATION_V2.ja.md) を参照してください。

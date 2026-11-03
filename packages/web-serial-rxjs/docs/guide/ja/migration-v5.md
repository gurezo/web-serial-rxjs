# v5 への移行

このページは v5 の破壊的変更を集めます。後続の変更は節を足します。この節はエラー通知契約（[#633](https://github.com/gurezo/web-serial-rxjs/issues/633)）です。

v4 までの `state$` と `SerialError` の形は変わりません。変わったのは、同じ失敗を `errors$` と操作 Observable の両方に出さなくなったことです。

## TL;DR

- `connect$` / `send$` / `disconnect$` の失敗は、その subscriber だけに出ます。`errors$` には出ません。
- `errors$` に出るのは、接続完了後の read pump、接続中の予期しない切断、`LINE_BUFFER_OVERFLOW` だけです。
- fatal のとき `state.error` はその `SerialError` と同一インスタンスです。`errors$` に出ていなくても載ります。
- ポート選択のキャンセルは `connect$` が `OPERATION_CANCELLED` で error 終了します。`state$` は `'idle'` に戻ります。

## エラー通知

### 以前（v4）

`errors$` だけを見ていれば、接続・送信・切断の失敗も届きました。

```typescript
session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
    showToast(error.message);
  }
  if (error.is(SerialErrorCode.WRITE_FAILED)) {
    showToast(error.message);
  }
});

session.connect$().subscribe();
session.send$('hello\n').subscribe();
```

### 以後（v5）

操作の結果は、その Observable で受けます。`errors$` はセッションが自分から壊れたときだけです。

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.connect$().subscribe({
  error: (error) => {
    if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
      return;
    }
    if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
      showToast(error.message);
    }
  },
});

session.send$('hello\n').subscribe({
  error: (error) => {
    if (error.is(SerialErrorCode.WRITE_FAILED)) {
      showToast(error.message);
    }
  },
});

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    showToast(error.message);
  }
});
```

同じ失敗を両方でトーストすると、v4 では二重表示になりました。v5 ではチャネルが分かれているので、両方を購読しても同じ事象は 1 回です。

## チャネル

| 起点 | 通知先 | `state$` |
| --- | --- | --- |
| `connect$` の失敗（open、起動中の pump、picker キャンセルを含む） | `connect$` の `error` | fatal は `'error'`。キャンセルは `'idle'` |
| `send$` の `WRITE_FAILED` / `PORT_NOT_OPEN` | `send$` の `error` | 変えない |
| `disconnect$` の close 失敗 | `disconnect$` の `error` | fatal は `'error'` |
| 接続完了後の read pump | `errors$` | `'error'` |
| 接続中の予期しない stream close | `errors$` | `'error'` |
| `LINE_BUFFER_OVERFLOW` | `errors$` | 変えない |
| `dispose$` 後の `SESSION_DISPOSED` | その操作の `error` | すでに `'disposed'` |

切断で捨てられた未開始の `send$` は、pump の `READ_FAILED` とは別の `PORT_NOT_OPEN` です。`send$` の subscriber だけに出ます。

## 関連

- [クイックスタート – エラーハンドリング](./quick-start.md#エラーハンドリング)
- [概念 – `errors$`](./concepts.md#errors-observableserialerror)
- [トラブルシューティング – Recovery Matrix](./troubleshooting.md#エラー-recovery-matrix)

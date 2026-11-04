# v5 への移行

このページは v5 の契約変更を集めます。ここまでの節は、エラー通知契約（[#633](https://github.com/gurezo/web-serial-rxjs/issues/633)）、セッション破棄（[#655](https://github.com/gurezo/web-serial-rxjs/issues/655)）、削除した deprecated API（[#658](https://github.com/gurezo/web-serial-rxjs/issues/658)）です。

`state$` の形は v4 のままです。`SerialError` は旧 cause 引数と `originalError` を持ちません。`PORT_NOT_AVAILABLE`、`OPERATION_TIMEOUT`、公開 `assertNever` はありません。同じ失敗を `errors$` と操作 Observable の両方には出しません。永久破棄は `dispose(): Promise<void>` を使います。`dispose$()` は残り、非推奨です。

## TL;DR

- `connect$` / `send$` / `disconnect$` の失敗は、その subscriber だけに出ます。`errors$` には出ません。
- `errors$` に出るのは、接続完了後の read pump、接続中の予期しない切断、`LINE_BUFFER_OVERFLOW` だけです。
- fatal のとき `state.error` はその `SerialError` と同一インスタンスです。`errors$` に出ていなくても載ります。
- ポート選択のキャンセルは `connect$` が `OPERATION_CANCELLED` で error 終了します。`state$` は `'idle'` に戻ります。
- 破棄は `await session.dispose()` を使います。呼び出した時点で始まり、ポートと read pump の解放で resolve します。`dispose$()` は非推奨の cold Observable のままです。購読しないと呼んでも何もしません。
- `PORT_NOT_AVAILABLE`、`OPERATION_TIMEOUT`、公開 `assertNever`、`originalError`、`SerialError` の旧 cause 引数は削除しました。[削除した deprecated API](#削除した-deprecated-api) を参照してください。

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
| `dispose()` 後の `SESSION_DISPOSED` | その操作の `error` | すでに `'disposed'` |

切断で捨てられた未開始の `send$` は、pump の `READ_FAILED` とは別の `PORT_NOT_OPEN` です。`send$` の subscriber だけに出ます。

## 破棄

`dispose$()` は残します。非推奨です。推奨する破棄は `dispose()` です。

### 以前（v4）

```typescript
session.dispose$().subscribe({ error: () => void 0 });
```

`dispose$()` を `subscribe()` せずに呼んでも、何も起きませんでした。

### 以後（v5）

```typescript
await session.dispose();
```

`async` にできない cleanup hook では、`void session.dispose()` でも破棄は始まります。

`dispose$()` を残す場合は、今までどおり購読します。購読は `dispose()` と同じ破棄に接続し、解放完了で complete します。

### 完了条件

- `dispose()` はポートと read pump の解放が終わると resolve します。`state$` の `'disposed'` はそれより先に出ることがあります。
- `port.close()` の失敗では Promise は reject しません。想定外の teardown 失敗だけ `SerialError` で reject します。
- 2 回目の `dispose()` も、後から購読した `dispose$()` も、進行中の同じ解放完了を待ちます。
- `'connecting'` で `open()` 開始後は、`dispose()` も購読した `dispose$()` も、そのポートの解放が終わってから resolve します。`open()` 前（`requestPort()` 待ちを含む）は待たずに resolve します。ポート選択ダイアログは閉じず、その後に選ばれたポートは開きません。
- `[Symbol.asyncDispose]` はこのリリースには含まれません。

## 削除した deprecated API

v4 で非推奨だった次の面を削除しました（[#658](https://github.com/gurezo/web-serial-rxjs/issues/658)）。

### `PORT_NOT_AVAILABLE` と `OPERATION_TIMEOUT`

実行時には出ていませんでした。これらに分岐している処理は削除します。ポート取得の失敗は `PORT_OPEN_FAILED` または `OPERATION_CANCELLED` で扱います。

#### 以前（v4）

```typescript
if (error.is(SerialErrorCode.PORT_NOT_AVAILABLE)) {
  showToast(error.message);
}
if (error.is(SerialErrorCode.OPERATION_TIMEOUT)) {
  showToast(error.message);
}
```

#### 以後（v5）

```typescript
if (error.is(SerialErrorCode.PORT_OPEN_FAILED)) {
  showToast(error.message);
}
if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
  return;
}
```

### `assertNever`

helper はパッケージ内部に残します。公開 export ではありません。ローカル helper を定義するか、`SerialSessionStatus` で `state.status` を網羅します。

#### 以前（v4）

```typescript
import { assertNever } from '@gurezo/web-serial-rxjs';

assertNever(state);
```

#### 以後（v5）

```typescript
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${String(value)}`);
}
```

### `SerialError` の cause 引数と `originalError`

コンストラクタは `(code, message, context?)` です。cause 系 code は第 3 引数に `{ cause }` を渡します。原因は `context.cause` から読みます。

#### 以前（v4）

```typescript
console.error(error.originalError);

new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', cause);
new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', undefined, {
  cause,
});
```

#### 以後（v5）

```typescript
if (error.is(SerialErrorCode.READ_FAILED)) {
  console.error(error.context.cause);
}

new SerialError(SerialErrorCode.READ_FAILED, 'Failed to read', { cause });
```

## 関連

- [クイックスタート – エラーハンドリング](./quick-start.md#エラーハンドリング)
- [クイックスタート – 破棄](./quick-start.md#破棄する（リソース解放）)
- [概念 – `dispose()`](./concepts.md#dispose-promisevoid)
- [概念 – `errors$`](./concepts.md#errors-observableserialerror)
- [Framework 別 session ライフサイクル](./framework-session-lifecycle.md)
- [トラブルシューティング – Recovery Matrix](./troubleshooting.md#エラー-recovery-matrix)

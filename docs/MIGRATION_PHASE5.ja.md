# 移行ガイド（Phase5 cleanup）

このガイドでは、旧ストリーム/イベントAPIから現在のAPIへ移行する方法を説明します。

## 削除されたAPI

- `getReadStream()`
- `writeStream()`
- `connectionEvents$`

## 置き換え先

- 受信（bytes/text/lines）:
  - `getReadStream()` -> `bytes$` または `text$`
- 送信（順序保証）:
  - `writeStream()` -> `send$(...)`（内部キューで順序制御）
- 接続ライフサイクル:
  - `connectionEvents$` -> `state$`

## 変更例

```ts
// Before
client.getReadStream().subscribe((chunk) => {
  console.log(new TextDecoder().decode(chunk));
});

client.writeStream(payload$).subscribe();
client.connectionEvents$.subscribe((event) => console.log(event));
```

```ts
// After
client.text$.subscribe((text) => {
  console.log(text);
});

client.send$('AT\r\n').subscribe();
client.state$.subscribe((state) => console.log(state.kind));
```

## 補足

- `send$` は同時呼び出しでも送信順序を保証します。
- 行単位のプロトコルでは `lines$` を利用してください。
- request/response は `command$` / `transact$` の利用を推奨します。

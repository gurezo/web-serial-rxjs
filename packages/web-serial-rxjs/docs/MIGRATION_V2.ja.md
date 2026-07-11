# v1（`SerialClient`）から v2（`SerialSession`）への移行ガイド

v2 では、v1 の `SerialClient` / `ShellClient` / ブラウザユーティリティなど多岐にわたる API を、単一の `SerialSession` に置き換えました。**v1 の export は shim なしで完全に削除されています。** アップグレード前にすべての呼び出し箇所を書き換えてください。

本ガイドでは削除された API と v2 での置換先をすべて対応付けます。

## 一言まとめ

```typescript
// v1
import { createSerialClient, isBrowserSupported } from '@gurezo/web-serial-rxjs';

if (!isBrowserSupported()) return;
const client = createSerialClient({ baudRate: 9600 });
client.connect().subscribe();
client.text$.subscribe(console.log);
client.write(new TextEncoder().encode('hi')).subscribe();

// v2
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });
if (!session.isBrowserSupported()) return;
session.connect$().subscribe();
session.receive$.subscribe(console.log);
session.send$('hi').subscribe();
```

## 削除された公開 export

以下の v1 公開 export は **削除** されており、互換性 shim も提供されません。

| 削除された v1 export              | v2 での置換先                                                    |
| --------------------------------- | ---------------------------------------------------------------- |
| `createSerialClient`              | `createSerialSession`                                            |
| `SerialClient`（型）              | `SerialSession`                                                  |
| `SerialClientOptions`             | `SerialSessionOptions`（フィールドは同一）                       |
| `SerialState`                     | `SerialSessionState`（定数オブジェクト＋型。後述）                 |
| `SerialSupport` / `SerialRequest` | _（内部詳細のため非公開）_                                       |
| `createShellClient` / `ShellClient` / `ShellClientOptions` / `ShellExecResult` | `send$` + `receive$` の上でアプリ側が実装 |
| `isBrowserSupported`（トップレベル）| `session.isBrowserSupported()`                                 |
| `checkBrowserSupport`             | `session.isBrowserSupported()` を呼び、`false` なら自前で throw  |
| `BrowserType` / `detectBrowserType` / `hasWebSerialSupport` / `isChromiumBased` | v2 の公開 API には含まれません。必要なら `navigator.userAgent` を直接参照してください |
| `observableToWritable` / `subscribeToWritable` | 不要。`send$` が書き込みを内部処理します                  |
| `readableToObservable`            | 不要。`receive$` がストリームを提供します                        |
| `buildRequestOptions`             | `createSerialSession` に `filters` を渡すだけで OK               |

`SerialError` と `SerialErrorCode` は v2 では v1 と同一です。v3 では `SerialErrorCode` が const object + 型エイリアスへ変わります（[v3 移行ガイド](./MIGRATION_V3.ja.md) を参照）。ランタイムのメンバー名と値は不変です。

## メソッド／フィールド対応表

| v1                                      | v2                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------ |
| `createSerialClient(opts)`              | `createSerialSession(opts)`                                              |
| `client.connect()`                      | `session.connect$()`                                                     |
| `client.disconnect()`                   | `session.disconnect$()`                                                  |
| `client.connected` / `client.connected$`| `session.isConnected$`（または `session.state$` を `map`）               |
| `client.state$`（discriminated object） | `session.state$`（`SerialSessionState` 文字列ユニオン）                 |
| `client.text$` / `client.lines$`        | `session.lines$`（行区切り）または `session.receive$`（生の UTF-8 チャンク） |
| `client.bytes$`                         | v2 では非公開。バイトが必要なら `new TextEncoder().encode(chunk)` などで変換するか issue でリクエストしてください |
| `client.write(bytes)`                   | `session.send$(bytes)`                                                   |
| `client.writeText(str)`                 | `session.send$(str)`                                                     |
| `client.send$(data)`                    | `session.send$(data)`                                                    |
| `client.command$(cmd)` / `client.transact$(opts)` | `send$` + `receive$` + `timeout` をアプリ側で合成              |
| `client.requestPort()` / `client.getPorts()` | 非公開。`connect$` 内部で `requestPort` が呼ばれます                |
| トップレベル `isBrowserSupported()`     | `session.isBrowserSupported()`                                           |

## `state$` の形の変更

v1 の `SerialState` は `{ connected: true, connecting: false, ... }` のような discriminated object でした。v2 では同じ文字列を **const オブジェクト**と型エイリアスとして提供するため、`SerialSessionState.Connected` でも `'connected'` でも分岐・比較できます。

```typescript
export const SerialSessionState = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
  Unsupported: 'unsupported',
  Error: 'error',
} as const;

export type SerialSessionState =
  (typeof SerialSessionState)[keyof typeof SerialSessionState];
```

ライフサイクル:

```
idle -> connecting -> connected -> disconnecting -> idle
                              \-> error
(any) -> error       （致命的失敗）
(any) -> unsupported （生成時に navigator.serial が無い場合）
```

## `receive$` は subscription-lazy ではない

v1 の `text$` は subscriber ごとに read loop を張っていましたが、v2 の `receive$` は multicast です。read pump は `connect$` で起動し、すべての subscriber が同じストリームを共有します。**遅れて購読した consumer は購読以降のチャンクしか受け取れません。**

バックログを残したい場合は明示的にバッファしてください。

```typescript
import { shareReplay } from 'rxjs';

const buffered$ = session.receive$.pipe(
  shareReplay({ bufferSize: 100, refCount: true }),
);
```

## エラーは `errors$` に集約される

v1 では主に `subscribe({ error })` でエラーを受けていましたが、v2 ではすべての失敗が `session.errors$` にも push されます。`errors$` は **主** エラーチャネルです。致命的エラーはさらに `state$` を `'error'` に遷移させ、ポートと read pump をテアダウンします。

```typescript
session.errors$.subscribe((error) => logError(error));
```

`errors$` に流れるインスタンスは、該当呼び出しの `subscribe({ error })` に渡されるものと同一なので、1 つの subscribe で全履歴を観測できます。

## Shell / command ヘルパ

`ShellClient` / `command$` / `transact$` は `send$` と、プロンプトマッチで区切られた `receive$` バッファ読み取りの組み合わせに過ぎませんでした。必要に応じてアプリ側で再実装します。

```typescript
import { firstValueFrom, scan, filter, map, timeout } from 'rxjs';

async function query(
  session: SerialSession,
  cmd: string,
  prompt = /device>\s$/,
  timeoutMs = 5000,
): Promise<string> {
  const response$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter((buffer) => prompt.test(buffer)),
    map((buffer) => buffer),
    timeout(timeoutMs),
  );
  await firstValueFrom(session.send$(cmd));
  return firstValueFrom(response$);
}
```

## オプション

`SerialSessionOptions` は `SerialClientOptions` と同じフィールド（`baudRate` / `dataBits` / `stopBits` / `parity` / `bufferSize` / `flowControl` / `filters`）を持ち、デフォルト値（`9600` / `8` / `1` / `'none'` / `255` / `'none'`）も同一です。

`createSerialSession` factory 時に `resolveSerialSessionOptions` が `filters`・`baudRate`・`receiveReplay`・`terminalBuffer`・`lineBuffer` を検証します。不正な値は `SerialError` として throw されます（例: `SerialErrorCode.INVALID_FILTER_OPTIONS`）。

## フレームワーク別の例

Angular / Vue / React / Svelte / Vanilla JS・TS 向けの具体的な before / after は各 example の README（[`apps/`](../apps/)）を参照してください。

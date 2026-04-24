# 高度な使用方法

v2 の `SerialSession` は意図的に小さな公開面に絞られています。応用パターンの大半は、`receive$` と `send$` の上に普通の RxJS オペレータを組み合わせることで表現できます。API の全体像は先に[README](../README.ja.md#serialsessionv2の全体像)と[クイックスタート](./QUICK_START.ja.md)を読み、本ページは README で省いた**行フレーミング・派生ストリーム・リカバリ**のレシピに絞ります。

## 行単位のフレーミング

`receive$` は `TextDecoder` 経由で UTF-8 デコード済みのチャンクをそのまま emit します。`scan` と組み合わせて改行でフレーム化します。

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
session.connect$().subscribe();

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

lines$.subscribe((lines) => lines.forEach((line) => console.log('行:', line)));
```

## 接続中フラグ（`connected$` 相当）

`SerialSession` に `connected$` プロパティはありません。ボタンの有効／無効などに使う真偽値が欲しい場合は `state$` から派生します。

```typescript
import { map } from 'rxjs';

const connected$ = session.state$.pipe(map((s) => s === 'connected'));
```

接続中以外の段階（`connecting` など）も扱う UI では、真偽値ではなく下記の [state$ 駆動の UI](#state-駆動の-ui) のように `state$` 全体を使う方が分かりやすいです。

## 順序保証のある送信

`send$` は内部 FIFO キューで直列化済みなので、並行購読でも呼び出し順に配送されます。

```typescript
import { from, concatMap } from 'rxjs';

const commands = ['help\n', 'status\n', 'version\n'];
from(commands)
  .pipe(concatMap((cmd) => session.send$(cmd)))
  .subscribe({
    error: (error) => console.error('コマンド失敗:', error),
  });
```

リクエスト／レスポンスのペアが欲しい場合は、`send$` と `receive$` の有限な読み取りを合成します。

```typescript
import { firstValueFrom, scan, filter, map, timeout } from 'rxjs';

async function query(cmd: string, prompt = /device>\s$/): Promise<string> {
  const response$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter((buffer) => prompt.test(buffer)),
    map((buffer) => buffer),
    timeout(5000),
  );
  await firstValueFrom(session.send$(cmd));
  return firstValueFrom(response$);
}
```

## state$ 駆動の UI

真偽値を自分で追うのではなく、UI 遷移は `state$` で駆動します。

```typescript
session.state$.subscribe((state) => {
  switch (state) {
    case 'idle':
      showConnectButton();
      break;
    case 'connecting':
    case 'disconnecting':
      showSpinner();
      break;
    case 'connected':
      showSendUi();
      break;
    case 'error':
      showErrorBanner();
      break;
    case 'unsupported':
      showUnsupportedBanner();
      break;
  }
});
```

## 一元化されたエラーハンドリング

`errors$` が主エラーチャネルです。`connect$().subscribe({ error })` で受け取るのは `errors$` に流れるものと同一の `SerialError` インスタンスです。

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.code === SerialErrorCode.READ_FAILED) {
    // 致命的エラー — session はすでに 'error' 状態でポートもテアダウン済み
    session.disconnect$().subscribe();
  }
});
```

## 致命的エラー時の再接続

致命的エラーは `state$` を `'error'` に遷移させるので、再接続ポリシーは素直に書けます。

```typescript
import { filter, concatMap } from 'rxjs';

session.state$
  .pipe(
    filter((state) => state === 'error'),
    concatMap(() => session.disconnect$()),
    concatMap(() => session.connect$()),
  )
  .subscribe({
    error: (error) => console.error('再接続失敗:', error),
  });
```

## フレームワーク統合

各 example は典型的な統合例を示しています。

- Angular: `ReplaySubject<SerialSession>` を `switchMap` で展開し、`state$` / `receive$` / `errors$` を service から公開
- Vue 3: 同じストリームを `ref` にミラーする composable
- React: session を `ref` に保持しつつ、ストリームを `useState` にミラーする hook
- Svelte: `derived` store でセッションをラップ
- Vanilla JS/TS: そのまま subscribe

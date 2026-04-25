# 高度な使用方法

v2 の `SerialSession` は意図的に小さな公開面に絞られています。応用パターンの大半は、`receive$` と `send$` の上に普通の RxJS オペレータを組み合わせることで表現できます。API の全体像は先に[SerialSession（v2）の概要](./OVERVIEW.ja.md#serialsessionv2の全体像)と[クイックスタート](./QUICK_START.ja.md)を読み、本ページは概要で省いた**行フレーミング・派生ストリーム・リカバリ**のレシピに絞ります。

本ページは [Issue #228](https://github.com/gurezo/web-serial-rxjs/issues/228) で列挙したパターンに対応します。**`lines$`** と **`isConnected$`** は `SerialSession` の組み込みとして用意されています。**`sendLine`・`readUntil`・`waitForState`** などは、引き続きコア API の上に組み立てるパターンです（専用の追加 export はありません）。USB OTG シリアルコンソールの実例として [CHIRIMEN PiZeroWebSerialConsole](https://github.com/chirimen-oh/PiZeroWebSerialConsole) があります。同アプリの読み書きループを `SerialSession` で書き直すときも、ここでのレシピがそのまま使えます。

## 行単位のフレーミング（組み込み `lines$` と `receive$` 上のカスタム分割）

**通常は** 組み込みの **`lines$`** で十分です（改行区切りの1行が都度1件 emit）。**`receive$`** は従来どおり、デコーダが返す **生チャンク**をそのまま流します。組み込み `lines$` とは異なる区切り文字や正規化が必要なときだけ `scan` などでフレーミングします。

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
session.connect$().subscribe();

// カスタムフレーミング（組み込み `lines$` では足りない場合のみ）
const customLines$ = session.receive$.pipe(
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

customLines$
  .subscribe((lines) => lines.forEach((line) => console.log('行:', line)));
```

組み込みシェルでよく使う `\r\n` も、既定の `lines$` 側で扱います。上のパターンは、独自の分割ルールが必要なとき専用です。

**プロンプトや改行なしのデータ:** `lines$` は改行が揃うまで emit しません。デバイスが **改行（`\n` / `\r\n`）なし**でプロンプトや行の途中だけを送る場合は、`lines$` を待たず **`receive$` でバッファを積み上げる**（下の「readUntil パターン」）方が向いています。

## 接続中フラグ（`isConnected$`）

ボタンの有効／無効など「接続済みかどうか」だけが欲しい場合は **`isConnected$`**（`state$` から `distinctUntilChanged` 付きで派生）を使います。

```typescript
session.isConnected$.subscribe((isOpen) => {
  // 操作の有効化など
});
```

独自の判定が必要な場合は、従来どおり `state$` から `map` しても構いません。`connecting` など多段階の UI では、真偽値ではなく下記の [state$ 駆動の UI](#state-駆動の-ui) のように `state$` 全体を使う方が分かりやすいです。

## 1 行送信（`sendLine` / `sendLine$` 相当）

対話シェルでは CRLF 終端の 1 行を期待することが多いです。ライブラリに API を増やさず、`send$` の薄いラッパーにします。

```typescript
const sendLine = (line: string) => session.send$(`${line}\r\n`);

sendLine('ls -al').subscribe({
  error: (error) => console.error('送信失敗:', error),
});
```

相手が LF のみを期待する UART プロトコルなら `\n` に置き換えます。いずれも文字列は同様に UTF-8 エンコードされます。

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

## readUntil パターン（`readUntil$` / プロンプト待ち）

`receive$` は**チャンク**単位であり、メッセージ単位ではありません。**readUntil** はバッファに蓄積したテキストが述語（区切り・正規表現・プロンプト）を満たすまで待ちます。`receive$` はホットで過去チャンクを後から購読しただけでは再現されないため、相手がすぐ応答するなら **`send$` する前に `receive$` 側の待ち受けを開始**してください。

```typescript
import { firstValueFrom, scan, filter, map, take, timeout } from 'rxjs';

async function readUntil(
  predicate: (buffer: string) => boolean,
  options: { timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const match$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter(predicate),
    map((buffer) => buffer),
    take(1),
    timeout(timeoutMs),
  );
  return firstValueFrom(match$);
}

const sendLine = (line: string) => session.send$(`${line}\r\n`);

// 例: ログインプロンプトを待ってから資格情報を送る（説明用）
await readUntil((buf) => /login:\s*$/im.test(buf));
await firstValueFrom(sendLine('pi'));
await readUntil((buf) => /password:\s*$/im.test(buf));
await firstValueFrom(sendLine('raspberry'));
```

**コマンド送信＋プロンプト待ち**も同じ蓄積パイプラインです。先に購読（`firstValueFrom` で Promise を取得）してから送ります。

```typescript
async function query(cmd: string, prompt = /device>\s$/): Promise<string> {
  const response$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter((buffer) => prompt.test(buffer)),
    map((buffer) => buffer),
    take(1),
    timeout(5000),
  );
  const responsePromise = firstValueFrom(response$);
  await firstValueFrom(session.send$(cmd));
  return responsePromise;
}
```

## waitForState

`connect$` や `disconnect$` のあと、特定の `SerialSessionState`（例: `SerialSessionState.Connected` や `SerialSessionState.Idle`）が立つまで **await** したい場合があります。`state$` に `filter`・`take(1)`・必要なら `timeout` を載せます。

```typescript
import { filter, take, firstValueFrom, timeout } from 'rxjs';
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

async function waitForState(
  target: SerialSessionState,
  options: { timeoutMs?: number } = {},
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  await firstValueFrom(
    session.state$.pipe(
      filter((s) => s === target),
      take(1),
      timeout(timeoutMs),
    ),
  );
}

// 例: connect$ 成功後はすでに 'connected' だが、他の非同期処理との整合や
// タイムアウトを明示したいときに使う
await firstValueFrom(session.connect$());
await waitForState(SerialSessionState.Connected, { timeoutMs: 5000 });
```

## state$ 駆動の UI

真偽値を自分で追うのではなく、UI 遷移は `state$` で駆動します。

```typescript
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  switch (state) {
    case SerialSessionState.Idle:
      showConnectButton();
      break;
    case SerialSessionState.Connecting:
    case SerialSessionState.Disconnecting:
      showSpinner();
      break;
    case SerialSessionState.Connected:
      showSendUi();
      break;
    case SerialSessionState.Error:
      showErrorBanner();
      break;
    case SerialSessionState.Unsupported:
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
import { SerialSessionState } from '@gurezo/web-serial-rxjs';

session.state$
  .pipe(
    filter((state) => state === SerialSessionState.Error),
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

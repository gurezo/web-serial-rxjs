# Request / Response レシピ

シリアル機器では、**コマンド送信後に条件に合う応答を待つ**流れがよくあります。本 Recipe は、コア API に `request$()` を追加せず、`SerialSession` 上の RxJS 組み合わせでその流れを組み立てる方法を示します。

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#538](https://github.com/gurezo/web-serial-rxjs/issues/538) · 関連: [実機なしテスト](./testing.md) · 後続: タイムアウト・キャンセル・再試行（[#539](https://github.com/gurezo/web-serial-rxjs/issues/539)）

## スコープの判断

| 項目 | 判断 |
| --- | --- |
| コア API | **`request$()` は追加しない**（利用側で RxJS を組み立てる） |
| npm パッケージ | 下記ヘルパーは **公開 export ではない** |
| 使い方 | パターンをアプリへコピーするか、同等のローカルヘルパーを置く |
| リポジトリ参照 | [`tests/helpers/request-response-recipes.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/request-response-recipes.ts)（CI 用の例） |

一般的なコマンド／応答プロトコルには RxJS の組み合わせで足ります。多数のアプリが同じ相関・フレーミング規則を必要とした場合に限り、将来のコアヘルパーを検討します。

## `lines$` と `receive$` の使い分け

| ストリーム | 向いている用途 |
| --- | --- |
| `lines$` | 改行区切りの応答（`OK`、ステータス行、パーサ） |
| `receive$` | **改行なし**のプロンプト／終端、ターミナル、`\r` による再描画 |

## 重要な順序: 先に待ち、その後に送信

`lines$` / `receive$` は **ホット**で、過去の emit を再生しません。機器がすぐに返す場合は、**`send$` の前に待ち受け購読を開始**してください。

```typescript
import { filter, firstValueFrom, take, timeout } from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function requestOk(session: SerialSession, cmd: string): Promise<string> {
  const waitForOk$ = session.lines$.pipe(
    filter((line) => line === 'OK'),
    take(1),
    timeout({ first: 3000 }),
  );

  // 1) 先に待ち受け開始（firstValueFrom で購読）
  const replyPromise = firstValueFrom(waitForOk$);
  // 2) その後に送信
  await firstValueFrom(session.send$(cmd));
  return replyPromise;
}
```

送信してから待ち始めると、速い応答を取りこぼすことがあります。

## 行指向パターン（`lines$`）

### 完全一致・部分一致・正規表現

```typescript
import { filter, take, timeout } from 'rxjs';

// 完全一致
const waitExact$ = session.lines$.pipe(
  filter((line) => line === 'OK'),
  take(1),
  timeout({ first: 3000 }),
);

// 部分一致
const waitContains$ = session.lines$.pipe(
  filter((line) => line.includes('ready')),
  take(1),
  timeout({ first: 3000 }),
);

// 正規表現
const waitRegex$ = session.lines$.pipe(
  filter((line) => /^VERSION=\d+$/.test(line)),
  take(1),
  timeout({ first: 3000 }),
);
```

`take(1)` により、最初の一致で購読が完了します。

### コピー用ヘルパー: `requestLine$`

```typescript
import {
  Observable,
  filter,
  take,
  timeout,
} from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';
import type { SerialPayload } from '@gurezo/web-serial-rxjs';

type LineMatcher = string | RegExp | ((line: string) => boolean);

function matchesLine(matcher: LineMatcher, line: string): boolean {
  if (typeof matcher === 'function') return matcher(line);
  if (typeof matcher === 'string') return line === matcher;
  return matcher.test(line);
}

function waitForLine$(
  session: SerialSession,
  matcher: LineMatcher,
  timeoutMs = 3000,
): Observable<string> {
  return session.lines$.pipe(
    filter((line) => matchesLine(matcher, line)),
    take(1),
    timeout({ first: timeoutMs }),
  );
}

function requestLine$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  timeoutMs = 3000,
): Observable<string> {
  return new Observable<string>((subscriber) => {
    const waitSub = waitForLine$(session, matcher, timeoutMs).subscribe({
      next: (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      error: (error) => subscriber.error(error),
    });

    const sendSub = session.send$(payload).subscribe({
      error: (error) => {
        waitSub.unsubscribe();
        subscriber.error(error);
      },
    });

    return () => {
      waitSub.unsubscribe();
      sendSub.unsubscribe();
    };
  });
}
```

## チャンク／プロンプトパターン（`receive$`）

チャンクを蓄積し、プロンプトや終端文字列が現れるまで待ちます。

```typescript
import { filter, scan, take, timeout } from 'rxjs';

const waitPrompt$ = session.receive$.pipe(
  scan((buffer, chunk) => buffer + chunk, ''),
  filter((buffer) => /device>\s*$/.test(buffer)),
  take(1),
  timeout({ first: 5000 }),
);
```

待ち → 送信の順序は `lines$` と同じです。詳細は [高度な使用方法 – readUntil](./advanced-usage.md#readuntil-パターンreaduntil--プロンプト待ち) も参照してください。

## 送信エラーと応答タイムアウトの区別

| 失敗 | 型 | 典型的な原因 |
| --- | --- | --- |
| 書き込み / `send$` | `SerialError` | ポート閉鎖、書き込み失敗 |
| 一致する応答なし | RxJS `TimeoutError` | 無応答、matcher の誤り |

```typescript
import { TimeoutError, firstValueFrom } from 'rxjs';
import { SerialError } from '@gurezo/web-serial-rxjs';

try {
  await firstValueFrom(requestLine$(session, 'AT\r\n', 'OK'));
} catch (error) {
  if (error instanceof SerialError) {
    // 送信失敗 — 「応答が来なかった」とは別扱い
  } else if (error instanceof TimeoutError) {
    // 待ち続けたが一致する行がなかった
  } else {
    throw error;
  }
}
```

キャンセル・再試行・バックオフの方針は [#539](https://github.com/gurezo/web-serial-rxjs/issues/539) を参照してください。

## 複数コマンドの直列化: `concatMap` と `switchMap`

**相関 ID のない**プロトコルでは、要求を **1 つずつ** 実行します。`concatMap` を推奨します。`switchMap` は新しいコマンド開始時に直前の待ちをキャンセルするため、応答を取りこぼし得ます。

```typescript
import { concatMap, from } from 'rxjs';

from([
  { payload: 'CMD1\r\n', matcher: 'R1' },
  { payload: 'CMD2\r\n', matcher: 'R2' },
]).pipe(
  concatMap(({ payload, matcher }) =>
    requestLine$(session, payload, matcher),
  ),
);
```

同じ応答文字列が非同期イベントとしても流れる機器では、相関方法（シーケンス番号、ポートの排他など）を利用側で決めてください。

## Vitest カバレッジ（実機なし）

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/request-response-recipes.test.ts
```

応答の投入には [実機なしテスト](./testing.md) の Fake（`emitLine` / `emitReceive` / `failNextSend`）を使います。

## 関連

- [高度な使用方法](./advanced-usage.md) — 行フレーミング、`readUntil`、順序付き送信
- [実機なしテスト](./testing.md) — Fake `SerialSession`
- 後続: [#539](https://github.com/gurezo/web-serial-rxjs/issues/539) タイムアウト・キャンセル・再試行

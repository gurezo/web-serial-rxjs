# タイムアウト・キャンセル・再試行レシピ

`connect$()`、`send$()`、応答待ちには、しばしば **タイムアウト**、**キャンセル**、**回数制限付き再試行** が必要です。本 Recipe は、コアの自動再接続・自動再試行 API を追加せず、利用側で plain RxJS によって方針を置く方法を示します。

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#539](https://github.com/gurezo/web-serial-rxjs/issues/539) · 関連: [通信パターン別 Recipes](./recipes.md) · [Request / Response](./request-response.md) · [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) · [実機なしテスト](./testing.md)

## スコープの判断

| 項目 | 判断 |
| --- | --- |
| コア API | **自動再接続・自動再試行は追加しない** |
| npm パッケージ | 下記ヘルパーは **公開 export ではない** |
| 使い方 | パターンをアプリへコピーするか、同等のローカルヘルパーを置く |
| リポジトリ参照 | [`tests/helpers/timeout-cancel-retry-recipes.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/timeout-cancel-retry-recipes.ts)（CI 用の例） |

無条件の再試行は、ポート選択ダイアログの再表示、ユーザーキャンセルの障害扱い、コマンドの重複送信、非冪等な機器操作の複数回実行、USB 切断中の無限ループなどを招き得ます。操作ごとに判断できるよう、方針はアプリ側に置きます。

## 責務の分離

| 関心事 | 意味 | 典型的な RxJS |
| --- | --- | --- |
| **タイムアウト** | 期限までに終わらなければ打ち切る | `timeout({ first })` |
| **キャンセル** | ユーザー操作や UI 破棄により打ち切る | `takeUntil(destroy$)`、unsubscribe |
| **再試行** | 失敗後に再度試みる（安全な場合のみ） | `retry({ count, delay })` |

これらを「とにかく続ける」1 本のループにまとめないでください。ポート選択のキャンセルは、一時的な通信障害ではありません。

## 処理別の推奨方針

| 処理 | 推奨方針 |
| --- | --- |
| ポート選択 | ユーザー操作から開始し、キャンセル時は自動再表示しない |
| 接続失敗 | 原因に応じて手動再試行または回数制限 |
| 読み取り停止 | デバイス切断とアプリ終了を区別する |
| 応答タイムアウト | コマンドの冪等性を確認してから再試行する |
| 送信失敗 | 同じデータを自動再送してよいか利用側で判断する |
| `dispose$` 後 | 再試行しない（新しい `SerialSession` を作る） |

## 接続のタイムアウト

```typescript
import { firstValueFrom, timeout } from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function connectWithTimeout(
  session: SerialSession,
  timeoutMs = 10_000,
): Promise<void> {
  await firstValueFrom(session.connect$().pipe(timeout({ first: timeoutMs })));
}
```

ここでの `timeout` は、`connect$`（ポート選択ダイアログを含む）の完了待ちに上限を付けるものです。ライブラリ全体の接続リースではありません。

## 応答待機のタイムアウト

待ち → 送信のパターンは [Request / Response](./request-response.md) を優先してください。書き込み失敗（`SerialError`）と待ちタイムアウト（RxJS `TimeoutError`）を区別します。

```typescript
import { TimeoutError, firstValueFrom, filter, take, timeout } from 'rxjs';
import { SerialError } from '@gurezo/web-serial-rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function requestOk(session: SerialSession, cmd: string): Promise<string> {
  const wait$ = session.lines$.pipe(
    filter((line) => line === 'OK'),
    take(1),
    timeout({ first: 3000 }),
  );
  const replyPromise = firstValueFrom(wait$);
  await firstValueFrom(session.send$(cmd));
  return replyPromise;
}

try {
  await requestOk(session, 'AT\r\n');
} catch (error) {
  if (error instanceof SerialError) {
    // 送信失敗
  } else if (error instanceof TimeoutError) {
    // 期限内に一致する応答がなかった
  } else {
    throw error;
  }
}
```

## `takeUntil` によるキャンセル

```typescript
import { Subject, takeUntil } from 'rxjs';

const destroy$ = new Subject<void>();

const sub = session.lines$
  .pipe(takeUntil(destroy$))
  .subscribe((line) => console.log(line));

// 後で: 画面遷移や Cancel
destroy$.next();
destroy$.complete();
// sub は complete。以降の行は届かない
```

キャンセルはパイプラインを **完了**（または unsubscribe）させ、無限の `retry` に流し込まないでください。

## Component / Hook 破棄時のキャンセル

フレームワーク非依存の型: `destroy$` Subject を持ち、cleanup で complete します。

> **subscription 解除 ≠ session dispose。** `takeUntil` や `unsubscribe()` で UI への配信を止めても、serial port や read pump は teardown されません。session 所有者の破棄時には `dispose$().subscribe()` も呼んでください — [Framework 別 session ライフサイクル](./framework-session-lifecycle.md) を参照。

**React**

```typescript
import { useEffect, useRef } from 'react';
import { Subject, takeUntil } from 'rxjs';

function useSerialLines(session: SerialSession, onLine: (line: string) => void) {
  const destroyRef = useRef(new Subject<void>());

  useEffect(() => {
    const destroy$ = destroyRef.current;
    const sub = session.lines$.pipe(takeUntil(destroy$)).subscribe(onLine);
    return () => {
      destroy$.next();
      destroy$.complete();
      sub.unsubscribe();
    };
  }, [session, onLine]);
}
```

**Angular**（`DestroyRef` / `takeUntilDestroyed`）

```typescript
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const destroyRef = inject(DestroyRef);
session.lines$
  .pipe(takeUntilDestroyed(destroyRef))
  .subscribe((line) => console.log(line));
```

## `retry()` してよい処理 / 避けるべき処理

| **回数制限付き**で検討してよい例 | 自動再試行を避ける例 |
| --- | --- |
| 切断後の一時的な `PORT_OPEN_FAILED` | `OPERATION_CANCELLED`（ユーザーがダイアログを閉じた） |
| 応答タイムアウト後の冪等な読み取りクエリ | 非冪等コマンド（`MOTOR_START`、`WRITE_FLASH` など） |
| fatal エラー後の **制限付き**再接続（後述） | `dispose$` / `SESSION_DISPOSED` の後 |
| | ケーブル未接続のままの無限再接続 |

```typescript
import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';

function shouldRetryConnect(error: unknown): boolean {
  if (
    error instanceof SerialError &&
    (error.is(SerialErrorCode.OPERATION_CANCELLED) ||
      error.is(SerialErrorCode.SESSION_DISPOSED))
  ) {
    return false;
  }
  if (
    error instanceof SerialError &&
    (error.is(SerialErrorCode.PORT_OPEN_FAILED) ||
      error.is(SerialErrorCode.CONNECTION_LOST))
  ) {
    return true;
  }
  return false;
}
```

## 回数制限付き再試行（無限ループにしない）

```typescript
import { retry, throwError, timeout, timer } from 'rxjs';

session
  .connect$()
  .pipe(
    timeout({ first: 10_000 }),
    retry({
      count: 2, // 初回失敗のあと最大 2 回再試行 → 合計最大 3 回
      delay: (error, retryCount) => {
        if (!shouldRetryConnect(error)) {
          return throwError(() => error);
        }
        return timer(200 * 2 ** (retryCount - 1)); // 指数バックオフ
      },
    }),
  )
  .subscribe({
    error: (error) => console.error('回数制限内で接続に失敗', error),
  });
```

## 指数バックオフ

RxJS `retry({ delay })` の `retryCount` は、最初の再試行が **1** です。

| 再試行 # | `base = 200` のときの遅延 |
| --- | --- |
| 1 | 200 ms |
| 2 | 400 ms |
| 3 | 800 ms |

```typescript
const delayMs = baseDelayMs * 2 ** (retryCount - 1);
```

## ユーザーキャンセルは再試行しない

ユーザーがポート選択を閉じると、Chromium の `DOMException` が `SerialErrorCode.OPERATION_CANCELLED` に正規化されます。一時障害ではなく、意図的な UI 操作として扱います。

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
    // idle UI を表示 — connect$() を自動では呼び出さない
    return;
  }
});
```

## `disposed` では再接続しない

`dispose$()` のあと、セッションは終端です。`connect$` / `send$` は `SESSION_DISPOSED` で失敗します。再接続が必要なら **新しい** `SerialSession` を作成してください（ボーレート変更後など）。

```typescript
import { firstValueFrom, take } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

async function reconnectIfAlive(session: SerialSession): Promise<void> {
  const state = await firstValueFrom(session.state$.pipe(take(1)));
  if (state.status === SerialSessionStatus.Disposed) {
    throw new Error('Session disposed — 新しい SerialSession を作成してください');
  }
  await firstValueFrom(session.connect$());
}
```

## 非冪等コマンドを自動再送しない

待ちがタイムアウトしても、書き込みは機器に届いている場合があります。`MOTOR_START` やフラッシュ書き込みの再送は副作用を重複させ得ます。

```typescript
// 1 回の試行 + 運用者判断を推奨
session.send$('MOTOR_START\r\n').subscribe({
  error: (error) => {
    // 再送する前にユーザー確認や機器状態の確認を行う
    console.error(error);
  },
});

// 再送が安全と分かっている場合のみ（読み取り専用の status など）
// ヘルパーでは idempotent: true のような明示的なガードを付ける
```

## Vitest カバレッジ（実機なし）

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/timeout-cancel-retry-recipes.test.ts
```

失敗の投入には [実機なしテスト](./testing.md) の Fake（`failNextConnect` / `failConnectTimes` / `hangNextConnect` / `failNextSend` / `dispose$`）を使います。

## 関連

- [通信パターン別 Recipes](./recipes.md) — パターン → Guide 索引
- [Request / Response](./request-response.md) — 待ち→送信、送信エラーとタイムアウトの区別
- [高度な使用方法](./advanced-usage.md) — リカバリ／再接続（本ページの **制限付き**再試行を優先）
- [実機なしテスト](./testing.md) — Fake `SerialSession`
- [トラブルシューティング](./troubleshooting.md) — ポート選択キャンセルとよくある失敗

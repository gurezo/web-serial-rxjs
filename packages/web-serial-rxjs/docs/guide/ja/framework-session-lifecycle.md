# Framework 別 session ライフサイクル: disconnect と dispose

このリポジトリの Example アプリはシリアルポートに接続しますが、**いつ disconnect するか**、**いつ dispose するか**、**subscription をどこで解除するか**は framework のコンポーネントライフサイクルに依存します。ここを誤ると、画面遷移後も read pump や UI 向け subscription が残り、リソースリークや再接続の不具合につながります。

Parent: [#585](https://github.com/gurezo/web-serial-rxjs/issues/585) · Issue: [#593](https://github.com/gurezo/web-serial-rxjs/issues/593) · Related: [クイックスタート – 切断 / 破棄](./quick-start.md#破棄する（リソース解放）) · [命令メソッドの実行（cold Observable）](./quick-start.md#命令メソッドの実行（cold-observable）) · [API の概念 – SerialSession](./concepts.md#serialsession) · [タイムアウト・キャンセル・再試行 – Component / Hook 破棄時のキャンセル](./timeout-cancel-retry.md#component-hook-破棄時のキャンセル) · [Examples](../../examples/)

## disconnect$() と dispose$() の使い分け

どちらも **cold Observable** です — 購読したときだけ実行されます。[クイックスタート – 命令メソッドの実行（cold Observable）](./quick-start.md#命令メソッドの実行（cold-observable）) を参照してください。

| メソッド | ポート / read pump | セッション再利用 | 全 Observable | 典型的なトリガー |
| --- | --- | --- | --- | --- |
| **`disconnect$()`** | 閉じて停止 | **可** — `idle` に戻る | 継続 | ユーザーが切断; エラー後の再接続前; 一時的なクローズ |
| **`dispose$()`** | 閉じて停止 | **不可** — 終端 | **complete** | コンポーネント / ページ破棄; ボーレート変更（新 session）; アプリ終了 |

正式な API 定義は [API の概念 – SerialSession](./concepts.md#serialsession)（`disconnect$` / `dispose$` セクション）を参照してください。

### disconnect$() を呼ぶタイミング

- ユーザーが明示的に切断する（切断ボタン）。
- **同じ** `SerialSession` インスタンスで再接続する前にポートを閉じる必要がある。
- 致命的 read エラー後、同じ session から `idle` または `error` で復旧する予定でポートを teardown する。

```typescript
// ユーザー操作 — 後で Connect するために session を残す
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

### dispose$() を呼ぶタイミング

- session を所有するコンポーネント、hook、composable、ページが破棄される。
- session を丸ごと作り替える（ボーレート変更後 — 旧インスタンスを dispose してから `createSerialSession()`）。
- アプリまたは SPA ルートが終了し、この session を再利用しない。

```typescript
// 終端 teardown — 再度 serial が必要なら新しい session を作る
session.dispose$().subscribe({
  error: (e) => console.error('Dispose error:', e),
});
```

`dispose$` 後は **同じインスタンス**で `connect$()` を呼ばないでください。新しい `createSerialSession()` を作成します。

## 推奨 teardown 順序

すべての framework の cleanup hook で次の順序を適用してください。

1. **UI 向け subscription を解除** — `state$` / `lines$` / `terminalText$` / `errors$` をコンポーネントへ配信しない。
2. **dispose 前の `disconnect$()` は任意** — `dispose$()` がアクティブな接続を閉じ、read pump を停止する。
3. **session 所有者の破棄時に cleanup hook で `dispose$().subscribe()` を呼ぶ**。
4. **ユーザーが戻ってきたら新しい session を作成** — dispose 済みインスタンスを再利用しない。

```typescript
// 汎用 cleanup スケッチ（framework の hook に合わせて適用）
function teardownSession(session: SerialSession, uiSub: Subscription): void {
  uiSub.unsubscribe();
  session.dispose$().subscribe({ error: () => void 0 });
}
```

ボタンハンドラからの `connect$()` / `send$()` / `disconnect$()` への one-shot 購読は通常 self-complete し、明示的 teardown は不要です。hot stream（`state$` / `lines$` など）への **長寿命** subscription は **必要**です。

## subscription 解除と session dispose の違い

[タイムアウト・キャンセル・再試行 – Component / Hook 破棄時のキャンセル](./timeout-cancel-retry.md#component-hook-破棄時のキャンセル) では `takeUntil(destroy$)` や `takeUntilDestroyed()` で UI への **イベント配信を止める**方法を示しています。

これは `dispose$()` の **代替ではありません**:

| 操作 | 止めるもの | セッションの port / pump |
| --- | --- | --- |
| `unsubscribe()` / `takeUntil` | UI コールバック | 接続中なら動作し続ける |
| `disconnect$()` | port と read pump | セッション再利用可 |
| `dispose$()` | port、pump、全 session Observable | セッション終端 |

stream から unsubscribe 済みでも、session 所有者の破棄時には必ず `dispose$()` を呼んでください。

## Framework 別パターン

[Example アプリ](../../examples/) は `createSerialSession()` をローカルヘルパー `createSerialSessionController`（`@gurezo/examples-shared`、npm 非公開）でラップしています。以下のパターンはヘルパー有無に関わらず適用できます — ヘルパーを使わない場合は `controller.dispose()` の代わりに `session.dispose$().subscribe()` を呼びます。

### Angular

**Cleanup hook:** session を所有する service または component の `ngOnDestroy`。

**参照:** [`apps/example-angular/src/app/services/serial-client.service.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-angular/src/app/services/serial-client.service.ts)

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly session: SerialSession = createSerialSession({ baudRate: 9600 });

  readonly state$ = this.session.state$;
  readonly lines$ = this.session.lines$;
  readonly errors$ = this.session.errors$;

  connect$() {
    return this.session.connect$();
  }

  disconnect$() {
    return this.session.disconnect$();
  }

  ngOnDestroy(): void {
    this.session.dispose$().subscribe({ error: () => void 0 });
  }
}
```

**Disconnect** はコンポーネントのユーザー操作から呼び出します:

```typescript
handleDisconnect(): void {
  this.serialService.disconnect$().subscribe({
    error: (error: unknown) => console.error('Disconnect error:', error),
  });
}
```

**注意:**

- `providedIn: 'root'` では `ngOnDestroy` は Angular アプリ終了時（テスト teardown など）に実行され、単一の routed component アンマウント時ではありません。ルート単位で serial を使う場合は component レベルで provider を指定（`providers: [SerialClientService]`）し、その component 破棄時に `ngOnDestroy` が走るようにします。
- component 内の stream 購読には `toSignal()` や `takeUntilDestroyed()` を優先 — [タイムアウト・キャンセル・再試行 – Angular](./timeout-cancel-retry.md#component-hook-破棄時のキャンセル) を参照。

**Live example:** [Angular example app](../../examples/angular/)

### React

**Cleanup hook:** `useEffect` の return 関数。

**参照:** [`apps/example-react/src/hooks/useSerialSession.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-react/src/hooks/useSerialSession.ts)

```typescript
import { useEffect, useRef } from 'react';
import { Subscription } from 'rxjs';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

function useSerialSession() {
  const sessionRef = useRef<SerialSession | null>(null);

  if (sessionRef.current === null) {
    sessionRef.current = createSerialSession({ baudRate: 9600 });
  }

  useEffect(() => {
    const session = sessionRef.current as SerialSession;
    const sub = new Subscription();
    sub.add(session.state$.subscribe(/* setState */));
    sub.add(session.lines$.subscribe(/* onLine */));
    sub.add(session.errors$.subscribe(/* onError */));

    return () => {
      sub.unsubscribe();
      session.dispose$().subscribe({ error: () => void 0 });
      sessionRef.current = null;
    };
  }, []);

  const disconnect = () =>
    (sessionRef.current as SerialSession).disconnect$().subscribe({
      error: (e) => console.error('Disconnect error:', e),
    });

  return { disconnect /* … */ };
}
```

**注意:**

- session を `useRef` に保持し、React StrictMode の二重マウント / アンマウントで effect setup と cleanup の間にインスタンスを失わないようにする。
- 複合 `Subscription` を **`dispose$()` の前に** unsubscribe する。
- イベントハンドラからの `connect$()` / `disconnect$()` / `send$()` は one-shot `.subscribe()` — 追加 cleanup 不要。

**Live example:** [React example app](../../examples/react/)

### Vue 3

**Cleanup hook:** session を所有する composable の `onUnmounted`。

**参照:** [`apps/example-vue/src/composables/useSerialClient.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-vue/src/composables/useSerialClient.ts)

```typescript
import { onUnmounted, ref } from 'vue';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

export function useSerialClient() {
  const session: SerialSession = createSerialSession({ baudRate: 9600 });
  const isConnected = ref(false);

  const stateSub = session.state$.subscribe((state) => {
    isConnected.value = state.status === 'connected';
  });
  const linesSub = session.lines$.subscribe(/* append to buffer */);
  const errorsSub = session.errors$.subscribe(/* show error */);

  const disconnect = () =>
    session.disconnect$().subscribe({
      error: (error: unknown) => console.error('Disconnect error:', error),
    });

  onUnmounted(() => {
    stateSub.unsubscribe();
    linesSub.unsubscribe();
    errorsSub.unsubscribe();
    session.dispose$().subscribe({ error: () => void 0 });
  });

  return { isConnected, disconnect /* … */ };
}
```

**注意:**

- composable 呼び出しごとに session を 1 回作成（serial を使う component ごとに composable を 1 回呼ぶ）。
- `onUnmounted` で各 stream を明示的に unsubscribe してから session を dispose。

**Live example:** [Vue example app](../../examples/vue/)

### Svelte

**Cleanup hook:** `onDestroy`。

**参照:** [`apps/example-svelte/src/stores/useSerialSession.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-svelte/src/stores/useSerialSession.ts)

```typescript
import { onDestroy } from 'svelte';
import { readable } from 'svelte/store';
import { Subscription } from 'rxjs';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

export function useSerialSession() {
  const session: SerialSession = createSerialSession({ baudRate: 9600 });

  // readable store — stop 関数で最後の購読者離脱時に unsubscribe
  const state = readable({ status: 'idle' }, (set) => {
    const sub = session.state$.subscribe(set);
    return () => sub.unsubscribe();
  });

  const linesSub = session.lines$.subscribe(/* update store */);
  const errorSub = new Subscription();
  errorSub.add(session.errors$.subscribe(/* show error */));

  onDestroy(() => {
    linesSub.unsubscribe();
    errorSub.unsubscribe();
    session.dispose$().subscribe({ error: () => void 0 });
  });

  const disconnect = () =>
    session.disconnect$().subscribe({
      error: (e) => console.error('Disconnect error:', e),
    });

  return { state, disconnect /* … */ };
}
```

**注意:**

- `readable` store は stop 関数で auto-unsubscribe できるが、`terminalText$` など長寿命の直接 subscription は `onDestroy` で明示 cleanup が必要。
- store factory を呼んだ component 破棄時に `onDestroy` で `dispose$()` を呼ぶ。

**Live example:** [Svelte example app](../../examples/svelte/)

### Vanilla TypeScript

**Cleanup hook:** app クラスの明示的 `destroy()`（または router teardown コールバック）。

**参照:** [`apps/example-vanilla-ts/src/app.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-vanilla-ts/src/app.ts) — 配布 Example は subscription をアプリ寿命分保持; 本番アプリでは明示 teardown を追加すべき。

```typescript
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';
import { Subscription } from 'rxjs';

export class App {
  private readonly session: SerialSession = createSerialSession({ baudRate: 9600 });
  private readonly sub = new Subscription();

  constructor() {
    this.sub.add(this.session.state$.subscribe(/* update UI */));
    this.sub.add(this.session.lines$.subscribe(/* append output */));
    this.sub.add(this.session.errors$.subscribe(/* show error */));

    disconnectBtn.addEventListener('click', () => {
      this.session.disconnect$().subscribe({ error: () => void 0 });
    });

    window.addEventListener('beforeunload', () => this.destroy());
  }

  destroy(): void {
    this.sub.unsubscribe();
    this.session.dispose$().subscribe({ error: () => void 0 });
  }
}
```

**注意:**

- framework の cleanup hook がないため、`beforeunload`、SPA ルート変更、UI 削除時に自前で `destroy()` を呼ぶ。
- クライアントサイドルーティングの SPA では、フルページ unload だけでなく serial ルート離脱時に dispose する。
- Example の切断ボタンは `disconnect$()` を呼ぶ; 完全な session teardown には `destroy()` を追加する。

**Live example:** [Vanilla TS example app](../../examples/vanilla-ts/)

## クイックリファレンス

| 質問 | 答え |
| --- | --- |
| ユーザーが Disconnect をクリック? | `disconnect$().subscribe()` — session は再利用可 |
| Component / ルートがアンマウント? | UI stream を unsubscribe してから `dispose$().subscribe()` |
| ボーレート変更（新 session）? | 旧 session で `dispose$()`、その後 `createSerialSession()` |
| `dispose$` 後? | **新しい** session を作成 — 旧 session では再接続しない |
| `takeUntil(destroy$)` だけで十分? | **いいえ** — session 所有者 teardown 時に `dispose$()` も呼ぶ |

## Example apps

| Framework | URL |
| --- | --- |
| Angular | [examples/angular/](../../examples/angular/) |
| React | [examples/react/](../../examples/react/) |
| Vue | [examples/vue/](../../examples/vue/) |
| Svelte | [examples/svelte/](../../examples/svelte/) |
| Vanilla TS | [examples/vanilla-ts/](../../examples/vanilla-ts/) |

disconnect 後（dispose ではない）の再接続とエラー復旧は [トラブルシューティング – 再接続に失敗する](./troubleshooting.md#再接続に失敗する) と [高度な使用方法 – 致命的エラー時の再接続](./advanced-usage.md#致命的エラー時の再接続) を参照してください。

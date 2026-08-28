# Framework session lifecycle: disconnect vs dispose

Each example app in this repository connects to a serial port, but **when to disconnect**, **when to dispose**, and **where to unsubscribe** depends on your framework's component lifecycle. Getting this wrong leaves read pumps or UI subscriptions running after navigation — a common source of resource leaks and confusing reconnect behaviour.

Parent: [#585](https://github.com/gurezo/web-serial-rxjs/issues/585) · Issue: [#593](https://github.com/gurezo/web-serial-rxjs/issues/593) · Related: [Quick Start – Disconnect / Dispose](./quick-start.md#dispose-resource-cleanup) · [Running imperative methods (cold Observables)](./quick-start.md#running-imperative-methods-cold-observables) · [API concepts – SerialSession](./concepts.md#serialsession) · [Timeout / cancel / retry – Component teardown](./timeout-cancel-retry.md#cancel-on-component--hook-teardown) · [Examples](../../examples/)

## disconnect$() vs dispose$()

Both methods are **cold Observables** — they run only when subscribed. See [Quick Start – Running imperative methods (cold Observables)](./quick-start.md#running-imperative-methods-cold-observables).

| Method | Port / read pump | Session reuse | All observables | Typical trigger |
| --- | --- | --- | --- | --- |
| **`disconnect$()`** | Closed and stopped | **Yes** — returns to `idle` | Stay active | User clicks Disconnect; reconnect after error; temporary close |
| **`dispose$()`** | Closed and stopped | **No** — terminal | **Completed** | Component / page teardown; baud-rate change (new session); app shutdown |

For the formal API definitions, see [API concepts – SerialSession](./concepts.md#serialsession) (`disconnect$` / `dispose$` sections).

### When to call disconnect$()

- The user explicitly disconnects (Disconnect button).
- You need to close the port before reconnecting on the **same** `SerialSession` instance.
- After a fatal read error, you tear down the port and plan to recover from `idle` or `error` on the same session.

```typescript
// User action — keep the session for a later Connect
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

### When to call dispose$()

- The owning component, hook, composable, or page is being destroyed.
- You replace the session entirely (for example after a baud-rate change — dispose the old instance, then `createSerialSession()`).
- The application or SPA route is shutting down and you will not reuse this session.

```typescript
// Terminal teardown — create a new session if you need serial again
session.dispose$().subscribe({
  error: (e) => console.error('Dispose error:', e),
});
```

After `dispose$`, **do not** call `connect$()` on the same instance. Create a new `createSerialSession()`.

## Recommended teardown order

Apply this order in every framework's cleanup hook:

1. **Unsubscribe UI subscriptions** — stop delivering `state$`, `lines$`, `terminalText$`, and `errors$` to your component.
2. **`disconnect$()` is optional** before dispose — `dispose$()` already closes an active connection and stops the read pump.
3. **Call `dispose$().subscribe()`** in the cleanup hook when the session owner is destroyed.
4. **Create a new session** if the user returns — never reuse a disposed instance.

```typescript
// Generic cleanup sketch (adapt to your framework hook)
function teardownSession(session: SerialSession, uiSub: Subscription): void {
  uiSub.unsubscribe();
  session.dispose$().subscribe({ error: () => void 0 });
}
```

One-shot subscriptions to `connect$()`, `send$()`, or `disconnect$()` from button handlers usually complete on their own and do not need explicit teardown. Long-lived subscriptions to hot streams (`state$`, `lines$`, …) **do**.

## Subscription cleanup vs session dispose

[Timeout / cancel / retry – Cancel on Component / Hook teardown](./timeout-cancel-retry.md#cancel-on-component--hook-teardown) shows `takeUntil(destroy$)` and `takeUntilDestroyed()` to stop **delivering events** to your UI.

That is **not** a substitute for `dispose$()`:

| Action | What it stops | Session port / pump |
| --- | --- | --- |
| `unsubscribe()` / `takeUntil` | UI callbacks | Still running if connected |
| `disconnect$()` | Port and read pump | Session reusable |
| `dispose$()` | Port, pump, and all session observables | Session terminal |

Always call `dispose$()` when the session owner is destroyed, even if you already unsubscribed from streams.

## Framework patterns

The [example apps](../../examples/) wrap `createSerialSession()` with a local `createSerialSessionController` helper (`@gurezo/examples-shared`, not published on npm). The patterns below apply whether you use that helper or hold a `SerialSession` directly — call `session.dispose$().subscribe()` instead of `controller.dispose()` when you do not use the helper.

### Angular

**Cleanup hook:** `ngOnDestroy` on the service or component that owns the session.

**Reference:** [`apps/example-angular/src/app/services/serial-client.service.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-angular/src/app/services/serial-client.service.ts)

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

**Disconnect** is triggered from the component on user action:

```typescript
handleDisconnect(): void {
  this.serialService.disconnect$().subscribe({
    error: (error: unknown) => console.error('Disconnect error:', error),
  });
}
```

**Notes:**

- With `providedIn: 'root'`, `ngOnDestroy` runs when the Angular application is torn down (for example in tests), not when a single routed component unmounts. For per-route serial access, provide the service at the component level (`providers: [SerialClientService]`) so `ngOnDestroy` runs when that component is destroyed.
- Prefer `toSignal()` or `takeUntilDestroyed()` for stream subscriptions in components — see [Timeout / cancel / retry – Angular](./timeout-cancel-retry.md#cancel-on-component--hook-teardown).

**Live example:** [Angular example app](../../examples/angular/)

### React

**Cleanup hook:** `useEffect` return function.

**Reference:** [`apps/example-react/src/hooks/useSerialSession.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-react/src/hooks/useSerialSession.ts)

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

**Notes:**

- Store the session in a `useRef` so React StrictMode's double mount/unmount cycle does not lose the instance between effect setup and cleanup.
- Unsubscribe the composite `Subscription` **before** calling `dispose$()`.
- `connect$()` / `disconnect$()` / `send$()` from event handlers are one-shot `.subscribe()` calls — no extra cleanup needed.

**Live example:** [React example app](../../examples/react/)

### Vue 3

**Cleanup hook:** `onUnmounted` in the composable that owns the session.

**Reference:** [`apps/example-vue/src/composables/useSerialClient.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-vue/src/composables/useSerialClient.ts)

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

**Notes:**

- Create the session once per composable invocation (one composable call per component that uses serial).
- Unsubscribe each stream explicitly in `onUnmounted`, then dispose the session.

**Live example:** [Vue example app](../../examples/vue/)

### Svelte

**Cleanup hook:** `onDestroy`.

**Reference:** [`apps/example-svelte/src/stores/useSerialSession.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-svelte/src/stores/useSerialSession.ts)

```typescript
import { onDestroy } from 'svelte';
import { readable } from 'svelte/store';
import { Subscription } from 'rxjs';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

export function useSerialSession() {
  const session: SerialSession = createSerialSession({ baudRate: 9600 });

  // readable store — stop function unsubscribes when last subscriber leaves
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

**Notes:**

- `readable` stores can auto-unsubscribe via their stop function, but long-lived direct subscriptions (for example `terminalText$`) still need explicit cleanup in `onDestroy`.
- Call `dispose$()` in `onDestroy` when the component that invoked the store factory is destroyed.

**Live example:** [Svelte example app](../../examples/svelte/)

### Vanilla TypeScript

**Cleanup hook:** explicit `destroy()` on your app class (or router teardown callback).

**Reference:** [`apps/example-vanilla-ts/src/app.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/apps/example-vanilla-ts/src/app.ts) — the shipped example keeps subscriptions for the app lifetime; production apps should add explicit teardown.

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

**Notes:**

- Without a framework cleanup hook, you must call `destroy()` yourself — on `beforeunload`, SPA route change, or when removing the UI.
- For SPAs with client-side routing, dispose when leaving the serial route, not only on full page unload.
- The example app's disconnect button calls `disconnect$()`; add `destroy()` for full session teardown.

**Live example:** [Vanilla TS example app](../../examples/vanilla-ts/)

## Quick reference

| Question | Answer |
| --- | --- |
| User clicks Disconnect? | `disconnect$().subscribe()` — session stays reusable |
| Component / route unmounts? | Unsubscribe UI streams, then `dispose$().subscribe()` |
| Baud rate changes (new session)? | `dispose$()` on old session, then `createSerialSession()` |
| After `dispose$`? | Create a **new** session — do not reconnect the old one |
| `takeUntil(destroy$)` enough? | **No** — also call `dispose$()` on the session owner teardown |

## Example apps

| Framework | URL |
| --- | --- |
| Angular | [examples/angular/](../../examples/angular/) |
| React | [examples/react/](../../examples/react/) |
| Vue | [examples/vue/](../../examples/vue/) |
| Svelte | [examples/svelte/](../../examples/svelte/) |
| Vanilla TS | [examples/vanilla-ts/](../../examples/vanilla-ts/) |

For reconnect and error recovery after disconnect (not dispose), see [Troubleshooting – Reconnect fails](./troubleshooting.md#reconnect-fails) and [Advanced Usage – Reconnect On Fatal Error](./advanced-usage.md#reconnect-on-fatal-error).

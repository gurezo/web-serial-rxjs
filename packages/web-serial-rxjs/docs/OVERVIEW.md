# SerialSession (v2) overview

<p align="center">
  <img src="../../../assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs project icon" width="512" />
</p>

This page is the **mental model** for the v2 public API: what each `SerialSession` surface does, how `SerialSessionState` maps to `state$`, and how to choose between `receive$` and `lines$`. For options, error codes, and formal type details, see [API Reference](modules.html).

## Table of Contents

- [Features](#features)
- [Framework support](#framework-support)
- [SerialSession (v2) at a glance](#serialsession-v2-at-a-glance)
- [Documentation index](#documentation-index)

## Features

- **Session-oriented reactive API**: a single `SerialSession` exposes `state$`, `isConnected$`, `receive$`, `lines$`, `errors$`, plus `connect$`, `disconnect$`, and `send$`
- **UTF-8 text stream**: `receive$` is already decoded with a streaming `TextDecoder`, so multi-byte characters split across chunks are joined correctly
- **Ordered send queue**: concurrent `send$` calls are serialized internally in call order, without the caller having to manage a writer
- **Unified error channel**: every I/O error is normalised into `SerialError` and multiplexed on `errors$`
- **Explicit lifecycle**: `state$` emits `idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` so UIs can drive directly from it
- **TypeScript support**: full TypeScript type definitions included
- **Framework agnostic**: works with any JavaScript/TypeScript framework or vanilla JavaScript

## Framework support

This library is framework-agnostic and can be used with:

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## SerialSession (v2) at a glance

`createSerialSession` returns a single **SerialSession**. All interaction goes through the fields below. The public API is intentionally small; when you need **custom** framing, compose plain RxJS on `receive$` (see [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).

| Surface | Role |
| --- | --- |
| `state$` | **Connection lifecycle** — `idle` / `connecting` / `connected` / `disconnecting` / `error` / `unsupported`. Replays the current state on subscribe. Compare with **`SerialSessionState`** instead of string literals. |
| `SerialSessionState` | **State constants** — exported const object (e.g. `SerialSessionState.Connected`, `SerialSessionState.Idle`) with the same values `state$` emits. |
| `isConnected$` | **Connected flag** — `true` only when `state$` is `SerialSessionState.Connected`; `false` in every other state (derived from `state$` with `distinctUntilChanged`). |
| `receive$` | **Raw incoming UTF-8 text** as decoded string **chunks** (not line-delimited; multi-byte safe). |
| `lines$` | **Line-delimited UTF-8 text** — one string per complete line, using the built-in newline buffer (`\n` / `\r\n`). |
| `errors$` | **All `SerialError` instances** from connect / read / write / close (primary error channel). |
| `connect$()` | **Open** a user-selected port and start the internal read pump. |
| `disconnect$()` | **Close** the port and stop the pump. |
| `send$(string \| Uint8Array)` | **Enqueue** outgoing data; writes are **FIFO-ordered** when multiple `send$` run concurrently. |
| `isBrowserSupported()` | Synchronous `boolean` for Web Serial availability before `connect$`. |

### SerialSessionState (quick reference)

`state$` uses the string union below. Prefer the **const object** (e.g. `SerialSessionState.Connected` → `'connected'`) in code. Full lifecycle diagram, transitions, and edge cases: [API Reference – SerialSessionState](variables/SerialSessionState.html).

| Constant | Value | Meaning |
| --- | --- | --- |
| `SerialSessionState.Idle` | `'idle'` | No open port; initial state when the browser supports Web Serial. |
| `SerialSessionState.Connecting` | `'connecting'` | `connect$` in progress. |
| `SerialSessionState.Connected` | `'connected'` | Port is open; internal read pump is running. |
| `SerialSessionState.Disconnecting` | `'disconnecting'` | `disconnect$` in progress. |
| `SerialSessionState.Unsupported` | `'unsupported'` | Web Serial was not available when the session was created. |
| `SerialSessionState.Error` | `'error'` | Fatal I/O or lifecycle failure; call `disconnect$` or build a new session. |

**`receive$` vs `lines$`:** prefer **`lines$`** for typical newline-framed text; use **`receive$`** when you need raw chunk timing, a custom delimiter, or a rolling buffer you control (recipes in [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md#line-framing)).

**`isConnected$` (for simple UIs)** — a read-only `Observable<boolean>`. Use it for “port open?” toggles without comparing `state$` to `SerialSessionState.Connected` yourself. You can still derive your own boolean from `state$` with `map` if you need different rules.

**`lines$` (newline framing)** — built in; for non-standard delimiters, frame on `receive$` (recipes in [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md#line-framing)).

### Minimal example

```typescript
import { createSerialSession, SerialSessionState } from '@gurezo/web-serial-rxjs';
import { filter } from 'rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  throw new Error('Web Serial is not available in this browser');
}

session.lines$.subscribe(console.log);
session.errors$.subscribe(console.error);
session.state$
  .pipe(filter((s) => s === SerialSessionState.Connected))
  .subscribe(() => {
    /* e.g. enable UI that must wait until the port is open */
  });
session.connect$().subscribe();
session.send$('hello\r\n').subscribe();
```

In real apps, handle `connect$().subscribe({ next, error })` and `send$().subscribe({ error })` (errors are also on `errors$`). A fuller walkthrough is in [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.md).

## Documentation index

| Doc | Use it for |
| --- | --- |
| **Repository [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md)** | Monorepo overview, examples index, and contribution links. |
| **[Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.md)** | Shortest path to a working open port and subscriptions. |
| **[Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)** | Line framing, request/response-style flows, and recovery. |
| **[API Reference](modules.html)** | Options, `SerialSessionState`, and `SerialError` details (generated TypeDoc); narrative tables also on [GitHub](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.md). |
| **[v1 → v2 Migration Guide](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.md)** | Replacing the removed v1 `SerialClient` / `ShellClient` API. |
| **[Phase 5 archive (legacy v1 doc)](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/archive/MIGRATION_PHASE5.md)** | Historical v1 context only. |

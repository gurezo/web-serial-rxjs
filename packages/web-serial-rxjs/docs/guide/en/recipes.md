# Communication pattern Recipes

This index maps **serial communication goals** to existing Guide pages and recipes. Prefer this page when you know the **pattern** you need (line protocol, command/reply, timeout, and so on). For framework-specific wiring, use the [Examples](../../examples/) instead.

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#558](https://github.com/gurezo/web-serial-rxjs/issues/558)

## Scope

| Item | Decision |
| --- | --- |
| Axis | **Communication patterns**, not device brands |
| Device names | Do **not** treat product names as a compatibility guarantee |
| New long pages | Prefer **links** to existing Guide / Recipe pages |
| Binary receive | **Not supported** — see [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) and [Supported data](./concepts.md#supported-data-text-binary--charset) |

## Catalog

| Pattern | Primary APIs | Details |
| --- | --- | --- |
| [Basic text send / receive](#basic-text-send--receive) | `connect$`, `lines$`, `send$`, `disconnect$` / `dispose$` | [Quick Start](./quick-start.md) |
| [Line-oriented protocol](#line-oriented-protocol) | `lines$`, optionally `receive$` | [Advanced Usage – Line framing](./advanced-usage.md#line-framing-built-in-vs-custom-framing-on-) · [Stream selection](./stream-selection.md) |
| [Terminal / carriage-return handling](#terminal--carriage-return-handling) | `terminalText$`, `receive$` | [Stream selection](./stream-selection.md) · [Advanced Usage](./advanced-usage.md) |
| [Command / Response](#command--response) | `lines$` / `receive$`, `send$` | [Request / Response](./request-response.md) |
| [Timeout](#timeout) | RxJS `timeout` on `connect$` / waits | [Timeout / cancel / retry – Connect timeout](./timeout-cancel-retry.md#connect-timeout) |
| [Cancellation](#cancellation) | `takeUntil`, unsubscribe, teardown | [Timeout / cancel / retry – Cancel](./timeout-cancel-retry.md#cancel-with) |
| [Reconnect policy](#reconnect-policy) | `state$`, `connect$`, new session after `dispose$` | [Timeout / cancel / retry – disposed](./timeout-cancel-retry.md#do-not-reconnect-after) · [Advanced Usage – Reconnect](./advanced-usage.md#reconnect-on-fatal-error) |
| [Fake SerialSession testing](#fake-serialsession-testing) | Fake implementing `SerialSession` | [Hardware-free testing](./testing.md) |
| [Binary send with `Uint8Array`](#binary-send-with-uint8array) | `send$(Uint8Array)` | [Supported data](./concepts.md#supported-data-text-binary--charset) |

---

### Basic text send / receive

| | |
| --- | --- |
| **APIs** | `createSerialSession`, `connect$`, `lines$`, `send$`, `disconnect$` / `dispose$`, `state$`, `errors$` |
| **Good for** | First connect, log-style line receive, simple string send |
| **Not for** | Custom framing, command/reply correlation, binary wire protocols |
| **Details** | [Quick Start](./quick-start.md) · choose streams in [Stream selection](./stream-selection.md) |

### Line-oriented protocol

| | |
| --- | --- |
| **APIs** | `lines$` (default); `receive$` + RxJS when built-in framing is not enough |
| **Good for** | Newline-delimited logs, JSON Lines, one-line status replies |
| **Not for** | Prompts without a newline, `\r` redraw terminals (prefer `receive$` / `terminalText$`) |
| **Details** | [Advanced Usage – Line framing](./advanced-usage.md#line-framing-built-in-vs-custom-framing-on-) · [Stream selection](./stream-selection.md) |

### Terminal / carriage-return handling

| | |
| --- | --- |
| **APIs** | `terminalText$`, `receive$` (and `SerialSessionOptions.terminalBuffer`) |
| **Good for** | Binding a terminal-like viewport; folding `\r` redraws; optional ANSI strip |
| **Not for** | Strict line parsers (use `lines$`); expecting wire `Uint8Array` receive |
| **Details** | [Stream selection](./stream-selection.md) · [Advanced Usage](./advanced-usage.md) · [`createTerminalBuffer`](./concepts.md#createterminalbufferreceive-options) |

### Command / Response

| | |
| --- | --- |
| **APIs** | `lines$` or `receive$`, `send$` (compose wait-then-send; **no** core `request$`) |
| **Good for** | Send a command, wait for a matching line / prompt, serialize with `concatMap` |
| **Not for** | Fire-and-forget logs only; assuming past emissions replay on late subscribe |
| **Details** | [Request / Response recipes](./request-response.md) |

### Timeout

| | |
| --- | --- |
| **APIs** | RxJS `timeout` around `connect$` or response waits (app policy, not a core lease) |
| **Good for** | Bounding port picker / connect waits and reply waits |
| **Not for** | Treating every timeout as “safe to resend” non-idempotent commands |
| **Details** | [Connect timeout](./timeout-cancel-retry.md#connect-timeout) · [Response-wait timeout](./timeout-cancel-retry.md#response-wait-timeout) |

### Cancellation

| | |
| --- | --- |
| **APIs** | `takeUntil`, unsubscribe, component / hook teardown |
| **Good for** | Stopping work when the UI tears down; distinguishing user cancel from device failure |
| **Not for** | Auto-reopening the port picker after `OPERATION_CANCELLED` |
| **Details** | [Cancel with `takeUntil`](./timeout-cancel-retry.md#cancel-with) · [Cancel on teardown](./timeout-cancel-retry.md#cancel-on-component-hook-teardown) |

### Reconnect policy

| | |
| --- | --- |
| **APIs** | `state$`, `connect$`, `errors$`; **new** `SerialSession` after `dispose$` |
| **Good for** | App-owned limited retry / manual reconnect after recoverable failures |
| **Not for** | Core auto-reconnect; reconnecting a disposed session; infinite retry loops |
| **Details** | [Do not reconnect after `disposed`](./timeout-cancel-retry.md#do-not-reconnect-after) · [Reconnect on fatal error](./advanced-usage.md#reconnect-on-fatal-error) · [What to retry](./timeout-cancel-retry.md#what-to-retry-and-what-to-avoid) |

### Fake `SerialSession` testing

| | |
| --- | --- |
| **APIs** | A Fake that matches the swappable `SerialSession` contract (not published on npm) |
| **Good for** | Unit / integration tests without USB hardware; injecting failures in CI |
| **Not for** | Replacing the real Web Serial stack in production |
| **Details** | [Hardware-free testing](./testing.md) · [Swappable public contract](./concepts.md#swappable-public-contract-decision-536) |

### Binary send with `Uint8Array`

| | |
| --- | --- |
| **APIs** | `send$(Uint8Array)` — bytes written as-is |
| **Good for** | Sending opaque binary payloads the peer already understands |
| **Not for** | Binary **receive** (no `receiveBytes$` / `Uint8Array` receive stream); Modbus RTU / COBS / SLIP as a library feature |
| **Details** | [Supported data](./concepts.md#supported-data-text-binary--charset) · design notes [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) |

Short example (send only; receive remains UTF-8 text):

```typescript
import { firstValueFrom } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
await firstValueFrom(session.connect$());

const payload = new Uint8Array([0x01, 0x02, 0x03]);
await firstValueFrom(session.send$(payload));
```

---

## Related

- [Choosing receive$ / lines$ / terminalText$](./stream-selection.md) — pick the receive stream first when unsure
- [Hardware-free testing](./testing.md) — fake session and contract tests without a port
- [Troubleshooting](./troubleshooting.md) — port picker, line endings, reconnect symptoms
- [API Reference (TypeDoc)](modules.html) — options, types, and formal signatures
- [Examples](../../examples/) — Angular / React / Vue / Svelte / Vanilla apps
- [日本語 Recipes](../ja/recipes.md)

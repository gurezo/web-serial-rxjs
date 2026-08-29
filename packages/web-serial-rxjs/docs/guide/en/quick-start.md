# Quick Start

This is the **shortest path** to opening a serial port, receiving **newline-delimited lines**, sending data, and closing the port. For the full map of `state$`, `errors$`, `receive$`, `lines$`, and the imperative methods, read [SerialSession overview](./overview.md#serialsession-at-a-glance) first.

Use **`lines$`** for standard newline-framed text (`\n`, `\r\n`). **`receive$`** is the unframed UTF-8 decoder chunk stream (decoded text, not wire bytes) when you need custom framing (see [Advanced Usage](./advanced-usage.md#line-framing)). Prefer **`state$`** with `state.status` narrowing for lifecycle UI. Derive a connected boolean from `state$` when you only need a flag. For **`connect$()`**, **`send$()`**, **`disconnect$()`**, and **`dispose$()`**, see [Running imperative methods (cold Observables)](#running-imperative-methods-cold-observables) — they run only when subscribed.

Choosing among `receive$`, `lines$`, and `terminalText$`: see [Choosing receive$ / lines$ / terminalText$](./stream-selection.md).

## Requirements

- Serve the page over **HTTPS** or **localhost** (a [secure context](https://developer.mozilla.org/en-US/docs/Web/Security/Secure_Contexts)). Web Serial is unavailable on plain `http://` hosts other than localhost.
- Call **`connect$()`** from a **user gesture** (for example a button click). The browser will not show the port picker otherwise.

If something still fails (unsupported browser, missing subscribe, line endings, reconnect), see [Troubleshooting](./troubleshooting.md).

## Installation

Install the package with npm or pnpm.

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer dependency

**RxJS** `^7.8.0` is required as a peer dependency.

```bash
npm install rxjs
# or
pnpm add rxjs
```

The package is **ESM-only**. For what CI verifies, how Examples relate to compatibility, and TypeScript notes, see [Bundler and framework compatibility](./bundler-compatibility.md).

For browser **API availability** vs this project's **official support** (and untested mobile), see [Browser support and support policy](./browser-support.md). The monorepo [README.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md) also summarizes browser support and lists example apps.

## Running imperative methods (cold Observables)

**`connect$()`**, **`send$()`**, **`disconnect$()`**, and **`dispose$()`** return **cold** Observables. Calling them only builds the Observable — **nothing runs until you subscribe** (or use an operator that subscribes for you).

This is different from **`state$`**, **`lines$`**, **`errors$`**, and other session streams: subscribe to those as early as you need their emissions, then trigger imperative work through the methods below.

### What not to do

```typescript
// NG: no dialog, no send, no teardown — these lines do nothing by themselves
session.connect$();
session.send$('AT\r\n');
session.disconnect$();
session.dispose$();
```

### Pattern 1 — subscribe (fire-and-forget)

Use `.subscribe()` from a button handler or other call site. Always handle `error` in production apps.

```typescript
document.getElementById('connect')?.addEventListener('click', () => {
  session.connect$().subscribe({
    error: (e) => console.error('Connection error:', e),
  });
});

document.getElementById('disconnect')?.addEventListener('click', () => {
  session.disconnect$().subscribe({
    error: (e) => console.error('Disconnect error:', e),
  });
});
```

### Pattern 2 — `firstValueFrom()` with async/await

Convert a one-shot Observable to a Promise when you prefer sequential `async`/`await` code.

```typescript
import { firstValueFrom } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

async function runOnce(): Promise<void> {
  try {
    await firstValueFrom(session.connect$());
    await firstValueFrom(session.send$('AT\r\n'));
    await firstValueFrom(session.disconnect$());
  } catch (e) {
    console.error('Serial operation failed:', e);
  }
}
```

`firstValueFrom` completes after the first emission (or throws on error). The same rule applies to every imperative method.

### Pattern 3 — inside an RxJS pipeline

Chain imperative steps with operators such as `switchMap` or `concatMap` so subscription happens in one place.

```typescript
import { concatMap, from, of } from 'rxjs';

from(['AT\r\n', 'ATI\r\n']).pipe(
  concatMap((cmd) => session.send$(cmd)),
).subscribe({
  error: (e) => console.error('Send error:', e),
});

// Connect, then send once the port is open
of(undefined).pipe(
  concatMap(() => session.connect$()),
  concatMap(() => session.send$('hello\r\n')),
).subscribe({
  error: (e) => console.error('Pipeline error:', e),
});
```

For richer pipelines (request/response, timeouts, retry), see [Advanced Usage](./advanced-usage.md) and [Request / Response](./request-response.md).

## Connect, receive, and send

### SerialSessionStatus (quick reference)

| Constant | Value | Meaning |
| --- | --- | --- |
| `SerialSessionStatus.Idle` | `'idle'` | No open port; initial when Web Serial is supported. |
| `SerialSessionStatus.Connecting` | `'connecting'` | `connect$` in progress. |
| `SerialSessionStatus.Connected` | `'connected'` | Port open; read pump running (`portInfo` included). |
| `SerialSessionStatus.Disconnecting` | `'disconnecting'` | `disconnect$` in progress. |
| `SerialSessionStatus.Unsupported` | `'unsupported'` | Web Serial unavailable at session creation. |
| `SerialSessionStatus.Error` | `'error'` | Fatal failure (`error` included). |
| `SerialSessionStatus.Disposed` | `'disposed'` | Session permanently torn down via `dispose$`. |

Details: [API concepts and design notes](./concepts.md#serialsessionstate--serialsessionstatus) and [Migrating to v3](./migration-v3.md).

```typescript
import { createSerialSession, isWebSerialSupported } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!isWebSerialSupported()) {
  console.error('Web Serial API is not supported in this browser');
}

session.lines$.subscribe((line) => console.log('line:', line));

// In production apps, subscribe to errors$ and handle SerialError
session.errors$.subscribe((err) => console.error('Serial error:', err));

session.connect$().subscribe({
  next: () => {
    session.send$('ls\r\n').subscribe({
      error: (e) => console.error('Send error:', e),
    });
  },
  error: (e) => console.error('Connection error:', e),
});
```

## Lifecycle observation (`state$`)

Branch on **`state.status`** with **`SerialSessionStatus`** constants. When connected, TypeScript narrowing gives type-safe access to **`state.portInfo`**.

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    console.warn('Web Serial is not available');
  }
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

## Error handling (`errors$`)

**`errors$`** is the **canonical error event channel** for all `SerialError` instances from connect, read, write, and close. Errors received via `connect$().subscribe({ error })` are the same instances emitted on `errors$`.

- **fatal** — stops the read pump and tears down the port; `state$` transitions to `{ status: 'error', error }`
- **non-fatal** — session continues (e.g. `WRITE_FAILED`, `LINE_BUFFER_OVERFLOW`)

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error('Read failed:', error.context.cause);
  }
  if (error.is(SerialErrorCode.WRITE_FAILED)) {
    console.warn('Write failed (session continues):', error.context.cause);
  }
});
```

For error code tables and `context` shapes, see [API concepts and design notes](./concepts.md#serialerror--serialerrorcode).

## Disconnect

Call `disconnect$` when you want to close the port while keeping the session reusable.

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('Disconnect error:', e),
});
```

## Dispose (resource cleanup)

Call `dispose$` when you are done with the session entirely—for example before replacing it after a baud-rate change. This closes any active connection and completes all observables.

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('Dispose error:', e),
});
```

After disposal, create a new `createSerialSession()` instance instead of reusing the old one.

For framework-specific cleanup hooks (Angular `ngOnDestroy`, React `useEffect`, Vue `onUnmounted`, Svelte `onDestroy`, Vanilla TS explicit teardown), see [Framework session lifecycle](./framework-session-lifecycle.md).

## Next steps

- See [API concepts and design notes](./concepts.md) for the full list of streams and methods.
- Chunk-mode reception, ordered sends, detailed error handling, port filters, and more recipes are in [Advanced Usage](./advanced-usage.md).
- Connection and receive/send problems: [Troubleshooting](./troubleshooting.md).
- Migrating from v2 typings is covered in [Migrating to v3](./migration-v3.md).
- Migrating from v1 is covered in [Migration v1 → v2](./migration-v2.md).

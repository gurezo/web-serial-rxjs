# Advanced Usage

The v2 `SerialSession` intentionally exposes a small surface. Most "advanced" workflows are expressed by composing plain RxJS operators over `receive$` and `send$`. If you are new to the API, read the [README](../../../README.md#serialsession-v2-at-a-glance) and [Quick Start](./QUICK_START.md) first; this page focuses on **recipes** (line framing, derived streams, and recovery) that the README defers on purpose.

This page maps directly to [issue #228](https://github.com/gurezo/web-serial-rxjs/issues/228): built-in **`lines$`**, **`isConnected$`**, and the imperative methods cover common cases. Patterns such as **`sendLine`**, **`readUntil`**, and **`waitForState`** are still things you build on the core API (no extra exports for those). For a real-world serial-console style app, see [CHIRIMEN PiZeroWebSerialConsole](https://github.com/chirimen-oh/PiZeroWebSerialConsole) (Web Serial over USB OTG); the same recipes apply when you reimplement its read/write loop with `SerialSession`.

## Line Framing (built-in `lines$` vs custom framing on `receive$`)

**Default:** `lines$` emits one complete line at a time, handling `\n`, `\r\n`, and a lone interior `\r` the way the built-in line buffer does. It is the right choice for typical newline-delimited devices.

`receive$` still emits raw UTF-8 decoded **chunks** as they arrive. Use `scan` (or a similar stateful transform) when you need a custom delimiter, regex split, or batching that differs from the built-in `lines$`:

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
session.connect$().subscribe();

// Custom framing: only when the built-in `lines$` is not enough.
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
  .subscribe((lines) => lines.forEach((line) => console.log('line:', line)));
```

Many embedded shells use `\r\n` line endings. The default `lines$` already normalises the common cases; the pattern above is for custom rules only.

## Connected boolean (UI) (`isConnected$`)

For a simple "is the port open?" flag for buttons or templates, prefer **`isConnected$`** (derived from `state$` with `distinctUntilChanged`):

```typescript
session.isConnected$.subscribe((isOpen) => {
  // enable / disable actions
});
```

If you need a custom rule, you can still derive from `state$` with `map`. Prefer driving full UI from `state$` when you need spinners and multiple phases (see [State-driven UI](#state-driven-ui) below).

## Send line (`sendLine` / `sendLine$` pattern)

Interactive shells often expect a full line terminated by CRLF. Wrap `send$` in a small helper instead of adding API to the library:

```typescript
const sendLine = (line: string) => session.send$(`${line}\r\n`);

sendLine('ls -al').subscribe({
  error: (error) => console.error('send failed:', error),
});
```

Use `\n` only when the remote explicitly expects LF-only (some UART protocols). The session encodes strings as UTF-8 the same way in both cases.

## Ordered Writes

`send$` is already serialised by an internal FIFO queue, so concurrent subscribers are delivered in call order:

```typescript
import { from, concatMap } from 'rxjs';

const commands = ['help\n', 'status\n', 'version\n'];
from(commands)
  .pipe(concatMap((cmd) => session.send$(cmd)))
  .subscribe({
    error: (error) => console.error('Command failed:', error),
  });
```

## readUntil pattern (`readUntil$` / prompt-style reads)

`receive$` delivers **chunks**, not logical messages. A **read-until** pattern accumulates text until a predicate (delimiter, regex, prompt) matches. Because `receive$` is hot and does not replay past chunks to late subscribers, **start waiting on `receive$` before you `send$`** if the device may respond immediately.

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

// Example: wait for a login prompt, then send credentials (illustrative only)
await readUntil((buf) => /login:\s*$/im.test(buf));
await firstValueFrom(sendLine('pi'));
await readUntil((buf) => /password:\s*$/im.test(buf));
await firstValueFrom(sendLine('raspberry'));
```

One-shot **command + prompt** pairs use the same accumulation pipeline; subscribe first, then send:

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

Sometimes you need to **await** a specific `SerialSessionState` (for example `SerialSessionState.Connected` after UI-driven `connect$`, or `SerialSessionState.Idle` after `disconnect$`) instead of wiring everything through `subscribe`. Use `state$` with `filter`, `take(1)`, and an optional timeout:

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

// Example: after connect$ completes, you are already 'connected'; this is for
// coordination with other async code or stricter timeout handling.
await firstValueFrom(session.connect$());
await waitForState(SerialSessionState.Connected, { timeoutMs: 5000 });
```

## State-Driven UI

Drive every UI transition from `state$` rather than tracking a boolean:

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

## Unified Error Handling

`errors$` is the primary error channel; `connect$().subscribe({ error })` receives the same `SerialError` instance.

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.code === SerialErrorCode.READ_FAILED) {
    // fatal — session is already in 'error' and the port is torn down
    session.disconnect$().subscribe();
  }
});
```

## Reconnect On Fatal Error

Because fatal failures drive `state$` to `'error'`, a reconnect policy is straightforward:

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
    error: (error) => console.error('Reconnect failed:', error),
  });
```

## Framework Integration

Each example application in this repository demonstrates one idiomatic integration:

- Angular: thin service that exposes `state$` / `receive$` / `errors$` through `switchMap` over a `ReplaySubject<SerialSession>`
- Vue 3: composable that mirrors the same streams into `ref`s
- React: hook that stores the session in a `ref` and mirrors the streams into `useState`
- Svelte: store that wraps the session with `derived` stores
- Vanilla JS/TS: direct subscriptions

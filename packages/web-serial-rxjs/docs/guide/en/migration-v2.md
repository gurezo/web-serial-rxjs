# Migrating from v1 (`SerialClient`) to v2 (`SerialSession`)

v2 replaces the multi-surface `SerialClient` / `ShellClient` / browser-util API with a single `SerialSession`. **v1 exports are removed with no shim.** You must update every call site before upgrading.

This guide maps every removed symbol to its v2 replacement.

## TL;DR

```typescript
// v1
import { createSerialClient, isBrowserSupported } from '@gurezo/web-serial-rxjs';

if (!isBrowserSupported()) return;
const client = createSerialClient({ baudRate: 9600 });
client.connect().subscribe();
client.text$.subscribe(console.log);
client.write(new TextEncoder().encode('hi')).subscribe();

// v2
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 9600 });
if (!session.isBrowserSupported()) return;
session.connect$().subscribe();
session.receive$.subscribe(console.log);
session.send$('hi').subscribe();
```

## Removed public exports

The following v1 exports are **deleted** and no compatibility shim is provided.

| Removed v1 export                 | v2 replacement                                                   |
| --------------------------------- | ---------------------------------------------------------------- |
| `createSerialClient`              | `createSerialSession`                                            |
| `SerialClient` (type)             | `SerialSession`                                                  |
| `SerialClientOptions`             | `SerialSessionOptions` (same fields)                             |
| `SerialState`                     | `SerialSessionState` (const object + type; see below)             |
| `SerialSupport` / `SerialRequest` | _(internal details, no longer public)_                           |
| `createShellClient` / `ShellClient` / `ShellClientOptions` / `ShellExecResult` | Implement request/response on top of `send$` + `receive$` |
| `isBrowserSupported` (top-level)  | `session.isBrowserSupported()`                                   |
| `checkBrowserSupport`             | Call `session.isBrowserSupported()` and throw on `false` yourself |
| `BrowserType` / `detectBrowserType` / `hasWebSerialSupport` / `isChromiumBased` | Not part of v2. Use `navigator.userAgent` if you still need it. |
| `observableToWritable` / `subscribeToWritable` | Not needed; `send$` manages writes internally          |
| `readableToObservable`            | Not needed; `receive$` is the stream                             |
| `buildRequestOptions`             | Pass `filters` to `createSerialSession` directly                 |

`SerialError` and `SerialErrorCode` are unchanged in v2. In v3, `SerialErrorCode` becomes a const object + type alias (see [Migrating to v3](./migration-v3.md)); runtime member names and values stay the same.

## Method / field mapping

| v1                                      | v2                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `createSerialClient(opts)`              | `createSerialSession(opts)`                                             |
| `client.connect()`                      | `session.connect$()`                                                    |
| `client.disconnect()`                   | `session.disconnect$()`                                                 |
| `client.connected` / `client.connected$`| `session.isConnected$` (or `session.state$` with `map`)                  |
| `client.state$` (discriminated object)  | `session.state$` (`SerialSessionState` string union)                  |
| `client.text$` / `client.lines$`        | `session.lines$` (line-delimited) or `session.receive$` (raw UTF-8 chunks) |
| `client.bytes$`                         | Not exposed in v2. Convert with `new TextEncoder().encode(chunk)` if you need bytes, or open an issue. |
| `client.write(bytes)`                   | `session.send$(bytes)`                                                  |
| `client.writeText(str)`                 | `session.send$(str)`                                                    |
| `client.send$(data)`                    | `session.send$(data)`                                                   |
| `client.command$(cmd)` / `client.transact$(opts)` | Compose `send$` + `receive$` + `timeout` in your app code      |
| `client.requestPort()` / `client.getPorts()` | Not exposed; `connect$` internally calls `requestPort`             |
| Top-level `isBrowserSupported()`        | `session.isBrowserSupported()`                                          |

## `state$` shape changes

> **Note (v3):** In v3, `state$` changed again from a flat string to a discriminated union with `status` plus per-variant fields (`portInfo`, `error`). Constants were renamed to `SerialSessionStatus`. If you are on v3 or upgrading from v2 typings, see [Migrating to v3](./migration-v3.md) instead of the patterns below.

v1 `SerialState` was a discriminated object (for example `{ connected: true, connecting: false, ... }`). v2 exposes the same flat strings as a **const object** plus a type alias, so UIs can switch on `SerialSessionState.Connected` or on `'connected'` interchangeably:

```typescript
export const SerialSessionState = {
  Idle: 'idle',
  Connecting: 'connecting',
  Connected: 'connected',
  Disconnecting: 'disconnecting',
  Unsupported: 'unsupported',
  Error: 'error',
} as const;

export type SerialSessionState =
  (typeof SerialSessionState)[keyof typeof SerialSessionState];
```

Lifecycle:

```
idle -> connecting -> connected -> disconnecting -> idle
                              \-> error
(any) -> error       (fatal failure)
(any) -> unsupported (when navigator.serial is missing at construction)
```

## `receive$` is not subscription-lazy

v1 `text$` subscribed a read loop per subscriber. v2 `receive$` is multicast: the read pump is started by `connect$` and all subscribers share the same stream. **Late subscribers only see chunks produced after subscription.**

If you need to keep a backlog, buffer explicitly:

```typescript
import { shareReplay } from 'rxjs';

const buffered$ = session.receive$.pipe(shareReplay({ bufferSize: 100, refCount: true }));
```

## Errors are multiplexed on `errors$`

In v1 you typically only saw errors via `subscribe({ error })`. In v2 every failure is also pushed to `session.errors$`, which is the **primary** error channel. Fatal failures additionally drive `state$` to `'error'` and tear down the port and read pump.

```typescript
session.errors$.subscribe((error) => logError(error));
```

The instance emitted on `errors$` is identical to the one passed to `subscribe({ error })` at the relevant call site, so a single subscription on `errors$` is enough to observe the full error history.

## Shell / command helpers

`ShellClient`, `command$`, and `transact$` were opinionated wrappers around `send$` + a buffered `receive$` read with a prompt matcher. Recreate them in user code when needed:

```typescript
import { firstValueFrom, scan, filter, map, timeout } from 'rxjs';

async function query(
  session: SerialSession,
  cmd: string,
  prompt = /device>\s$/,
  timeoutMs = 5000,
): Promise<string> {
  const response$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter((buffer) => prompt.test(buffer)),
    map((buffer) => buffer),
    timeout(timeoutMs),
  );
  await firstValueFrom(session.send$(cmd));
  return firstValueFrom(response$);
}
```

## Options

`SerialSessionOptions` mirrors the fields of `SerialClientOptions` (`baudRate`, `dataBits`, `stopBits`, `parity`, `bufferSize`, `flowControl`, `filters`) and uses the same defaults (`9600`, `8`, `1`, `'none'`, `255`, `'none'`).

At `createSerialSession` factory time, `resolveSerialSessionOptions` validates `filters`, `baudRate`, `receiveReplay`, `terminalBuffer`, and `lineBuffer`. Invalid values throw `SerialError` (for example `SerialErrorCode.INVALID_FILTER_OPTIONS`).

## Framework examples

Concrete before / after wrappers for Angular, Vue, React, Svelte, and Vanilla JS/TS are in each example's README under [`apps/`](../apps/).

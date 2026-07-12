# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="@gurezo/web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The public API exposes a single `SerialSession` so applications can drive their UI from `state$` (canonical lifecycle state) + `errors$` (error event channel) + `receive$` + `lines$`, without rebuilding read loops or send queues themselves.

## Browser support

The Web Serial API is supported on **desktop** browsers only. Smartphones and other mobile browsers are not supported.

Supported desktop browsers:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** does not currently support the Web Serial API.

`SerialSession.isBrowserSupported()` returns a synchronous `boolean` for feature detection before `connect$`.

## Connection state (lifecycle UI)

Prefer **`state$`** with `state.status` narrowing as the canonical API for lifecycle UI. Derive a boolean from `state$` when you only need a connected flag. `isConnected$` remains available in v3.x but is **deprecated** — see [Migrating to v3](./docs/guide/en/migration-v3.md#6-isconnected-deprecation).

## Port info (device identification)

After a successful `connect$`, use `state.portInfo` when handling `state$` with `state.status === SerialSessionStatus.Connected` — this is the canonical API. `getPortInfo()` and `portInfo$` remain available in v3.x but are **deprecated**; migrate to `state$` narrowing. `getCurrentPort()` has been removed; see [Migrating to v3 – getCurrentPort() removal](./docs/guide/en/migration-v3.md#7-getcurrentport-removal).

## Receive replay (`receive$` vs `receiveReplay$`)

`receive$` is **non-replay**: late subscribers only see chunks emitted after they subscribe. To retain the last *N* decoded text **chunks** per open connection (same bytes as `receive$`, e.g. for boot logs), pass `receiveReplay: { enabled: true, bufferSize: 512 }` to `createSerialSession` and subscribe to `receiveReplay$`. `bufferSize` must be a positive safe integer up to 65536. Optional `maxChars` bounds total buffered characters by discarding oldest chunks (non-fatal `RECEIVE_REPLAY_BUFFER_OVERFLOW` on `errors$`). Larger `bufferSize` or chunk sizes use more memory. When receive replay is **off** (default), `receiveReplay$` is the same hot stream as `receive$`. This option does not add replay to `lines$`—only raw decoder chunks on `receiveReplay$`.

## `receive$` vs `lines$`

Pick the stream that matches your use case. Using **`lines$`** for a terminal mirror drops `\r` and redraw behaviour, which breaks shells and tools that rely on carriage-return updates ([overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md)).

### `receive$` (raw stream)

- UTF-8 **decoder chunks** as they arrive—not line-aligned.
- Preserves `\r`, partial lines, and other control characters.
- Use for: **terminal display**, **prompt detection**, **buffering** / scrollback you control, and other **raw-stream** handling.

### `lines$` (line-delimited events)

- Emits **complete lines** (`\n`, `\r\n`, interior `\r` per implementation).
- Use for **logs**, **structured parsing**, and protocols framed on newlines.
- **Not suitable** for mirroring interactive CLI output when peers use `\r` for in-place redraws—you lose those semantics.

### Avoid / Prefer

**Avoid**—appending **`lines$`** strings for a terminal-style view hides redraws and corrupts layouts.

```ts
session.lines$.subscribe((line) => {
  output += line + '\n';
});
```

**Prefer**—concatenate **chunks** from **`receive$`** for mirrors and shell-style buffers.

```ts
session.receive$.subscribe((chunk) => {
  output += chunk;
});
```

## Installation

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer dependency

This library requires **RxJS** `^7.8.0` as a peer dependency:

```bash
npm install rxjs
# or
pnpm add rxjs
```

## Where to go next

- Full **API map** (features, `SerialSession` table, `SerialSessionState`, minimal example): [SerialSession overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md) ([日本語](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/ja/overview.md))
- Shortest path to an open port: [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/quick-start.md)
- Browse as one integrated site (TypeDoc): [web-serial-rxjs API Documentation](https://gurezo.github.io/web-serial-rxjs/)

## Documentation

| Doc | Use it for |
| --- | --- |
| [TypeDoc top page](https://gurezo.github.io/web-serial-rxjs/) | Start from overview and move to guides/API in one site |
| [English Guide index](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/README.md) | Getting Started reading order and full index |
| [Overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md) | Features and the `SerialSession` / `SerialSessionState` map |
| [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/quick-start.md) | Open a port and wire subscriptions end-to-end |
| [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/advanced-usage.md) | Line framing, request/response-style flows, recovery |
| [API concepts and design notes](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/concepts.md) | `SerialSessionOptions`, `SerialError`, and formal details |
| [v2 → v3 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v3.md) | `state$` discriminated union, `SerialSessionStatus`, `context.cause` |
| [v1 → v2 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v2.md) | Replacing the removed v1 `SerialClient` / `ShellClient` API |
| [Repository README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md) | Monorepo layout, **examples** under `apps/`, contributing, MCP, and project icon |

## License

MIT — see the [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) file in the repository.

## Links

- **Repository**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API (spec)**: [wicg.github.io/serial](https://wicg.github.io/serial/)

# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="@gurezo/web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The v2 API exposes a single `SerialSession` so applications can drive their UI from `state$` + `isConnected$` + `receive$` + `lines$` + `errors$`, without rebuilding read loops or send queues themselves.

## Browser support

The Web Serial API is only available in **Chromium-based** browsers: **Chrome** 89+, **Edge** 89+, **Opera** 75+.

`SerialSession.isBrowserSupported()` returns a synchronous `boolean` for feature detection before `connect$`.

## Port info (device identification)

After a successful `connect$`, use `getPortInfo()` or subscribe to `portInfo$` for the `SerialPort.getInfo()` snapshot (e.g. USB vendor/product IDs when the device exposes them). Both yield `null` when disconnected. `getCurrentPort()` returns the underlying `SerialPort` while connected; do not call `close()` on it—use `disconnect$` for lifecycle.

## Receive replay (`receive$` vs `receiveReplay$`)

`receive$` is **non-replay**: late subscribers only see chunks emitted after they subscribe. To retain the last *N* decoded text **chunks** per open connection (same bytes as `receive$`, e.g. for boot logs), pass `receiveReplay: { enabled: true, bufferSize: 512 }` to `createSerialSession` and subscribe to `receiveReplay$`. Larger `bufferSize` uses more memory. When receive replay is **off** (default), `receiveReplay$` is the same hot stream as `receive$`. This option does not add replay to `lines$`—only raw decoder chunks on `receiveReplay$`.

## `receive$` vs `lines$`

Pick the stream that matches your use case. Using **`lines$`** for a terminal mirror drops `\r` and redraw behaviour, which breaks shells and tools that rely on carriage-return updates ([overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.md)).

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

- Full **v2 API map** (features, `SerialSession` table, `SerialSessionState`, minimal example): [SerialSession (v2) overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.ja.md))
- Shortest path to an open port: [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.md)

## Documentation

| Doc | Use it for |
| --- | --- |
| [Overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/OVERVIEW.md) | Features and the v2 `SerialSession` / `SerialSessionState` map |
| [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.md) | Open a port and wire subscriptions end-to-end |
| [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) | Line framing, request/response-style flows, recovery |
| [API Reference](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.md) | `SerialSessionOptions`, `SerialError`, and formal details |
| [v1 → v2 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.md) | Replacing the removed v1 `SerialClient` / `ShellClient` API |
| [Repository README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md) | Monorepo layout, **examples** under `apps/`, contributing, MCP, and project icon |

## License

MIT — see the [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) file in the repository.

## Links

- **Repository**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API (spec)**: [wicg.github.io/serial](https://wicg.github.io/serial/)

# @gurezo/web-serial-rxjs

<p align="center">
  <img src="https://raw.githubusercontent.com/gurezo/web-serial-rxjs/main/packages/web-serial-rxjs/web-serial-rxjs-icon.png" alt="@gurezo/web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The public API exposes a single `SerialSession` so applications can drive their UI from `state$` (canonical lifecycle state) + `errors$` (error event channel) + `receive$` + `lines$`, without rebuilding read loops or send queues themselves.

**Primary focus: UTF-8 text.** Incoming data is always decoded with a streaming UTF-8 `TextDecoder`. `receive$` emits **decoded text chunks** (unframed), not raw wire bytes. Binary **send** via `send$(Uint8Array)` is supported; binary **receive**, non-UTF-8 charsets, and protocol framing (Modbus, COBS, SLIP, …) are out of scope. See [Supported data](#supported-data-text--binary--charset) below and [API concepts](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/concepts.md#supported-data-text--binary--charset).

## Browser support

This section separates **Web Serial API availability** (what the browser implements) from this project's **official support policy** (what we test and guarantee).

### Web Serial API availability

Where `navigator.serial` exists, this library can talk to the Web Serial API. Typical desktop availability:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** does not currently implement the Web Serial API. Many **mobile** browsers also lack `navigator.serial`; when the API is missing, `isWebSerialSupported()` returns `false`.

### Project support policy

**Official support** covers the desktop browsers listed above (Chrome 89+, Edge 89+, Opera 75+, Firefox 151+).

**Mobile** browsers are **untested** and **out of official support**. Untested does **not** mean the library rejects them — if a mobile browser exposes Web Serial and the page is in a secure context, feature detection may succeed, but we do not guarantee behavior.

### `isWebSerialSupported()`

`isWebSerialSupported()` returns a synchronous `boolean` for **feature detection** (`navigator.serial` present) before `connect$`. It is **not** a compatibility or official-support guarantee. Secure context (HTTPS or localhost) is a separate requirement.

Guide detail: [Browser support and support policy](docs/guide/en/browser-support.md).

## Connection state (lifecycle UI)

Prefer **`state$`** with `state.status` narrowing as the canonical API for lifecycle UI. Derive a boolean from `state$` when you only need a connected flag. Session teardown uses **`dispose$()`** (subscribe to run it). See [Migrating to v4](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v4.md).

## Port info (device identification)

After a successful `connect$`, use `state.portInfo` when handling `state$` with `state.status === SerialSessionStatus.Connected` — this is the canonical API. Raw `SerialPort` is not exposed. Removed convenience APIs (`isConnected$`, `portInfo$`, `getPortInfo()`, `destroy$()`, `getCurrentPort()`, `receiveReplay$`, `isBrowserSupported()`) and their replacements are documented in [Migrating to v4](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v4.md).

## Supported data (text / binary / charset)

| Item | Current support |
| --- | --- |
| UTF-8 text send / receive | Supported |
| Chunk-oriented string receive | `receive$` (decoded chunks, not wire bytes) |
| Newline-delimited string receive | `lines$` |
| Terminal display with `\r` redraws | `receive$` / `terminalText$` |
| Binary send | `send$(Uint8Array)` |
| Binary receive | **Not supported** (no raw `Uint8Array` receive stream) |
| Non-UTF-8 charsets | **Not supported** |
| Protocol framing (Modbus, COBS, SLIP, …) | **Application-side** |

Full notes and future design considerations: [API concepts — Supported data](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/concepts.md#supported-data-text--binary--charset).

## `receive$` vs `lines$`

Pick the stream that matches your use case. Using **`lines$`** for a terminal mirror drops `\r` and redraw behaviour, which breaks shells and tools that rely on carriage-return updates ([overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md)).

### `receive$` (decoded chunks)

- UTF-8 **decoder chunks** as they arrive—not line-aligned, and **not** raw wire bytes.
- Preserves `\r`, partial lines, and other control characters from the decoded text.
- Use for: **terminal display**, **prompt detection**, **buffering** / scrollback you control, and other unframed decoded-stream handling.

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
- Common problems and self-help: [Troubleshooting](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/troubleshooting.md)
- Browse the published documentation site: [web-serial-rxjs Documentation](https://gurezo.net/web-serial-rxjs/)
- Browse API Reference (TypeDoc): [web-serial-rxjs API Documentation](https://gurezo.net/web-serial-rxjs/api/)

## Documentation

| Doc | Use it for |
| --- | --- |
| [Documentation home](https://gurezo.net/web-serial-rxjs/) | Site landing with Guide (ja/en) and API Reference |
| [English Guide (site)](https://gurezo.net/web-serial-rxjs/guide/en/README.html) | Getting Started reading order on the published site |
| [API Reference (site)](https://gurezo.net/web-serial-rxjs/api/index.html) | English TypeDoc API Reference |
| [English Guide index](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/README.md) | Getting Started reading order and full index |
| [Overview](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/overview.md) | Features and the `SerialSession` / `SerialSessionState` map |
| [Quick Start](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/quick-start.md) | Open a port and wire subscriptions end-to-end |
| [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/advanced-usage.md) | Line framing, request/response-style flows, recovery |
| [Troubleshooting](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/troubleshooting.md) | Common Web Serial / session problems and self-help checks |
| [API concepts and design notes](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/concepts.md) | `SerialSessionOptions`, `SerialError`, and formal details |
| [v3 → v4 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v4.md) | Phase 1+2 removals (`receiveReplay$`, `isBrowserSupported()`, options cleanup) |
| [v2 → v3 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v3.md) | `state$` discriminated union, `SerialSessionStatus`, `context.cause` |
| [v1 → v2 migration](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/migration-v2.md) | Replacing the removed v1 `SerialClient` / `ShellClient` API |
| [Repository README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md) | Monorepo hub: **examples** under `apps/`, contribution entry, development-tool pointers |
| [CONTRIBUTING](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.md#5-ai-assistant-mcp---optional) | MCP / Cursor setup for repository contributors |

## License

MIT — see the [LICENSE](https://github.com/gurezo/web-serial-rxjs/blob/main/LICENSE) file in the repository.

## Links

- **Repository**: [github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API (spec)**: [wicg.github.io/serial](https://wicg.github.io/serial/)

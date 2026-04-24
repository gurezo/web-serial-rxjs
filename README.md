# web-serial-rxjs

<p align="center">
  <img src="./assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The v2 API exposes a single `SerialSession` so applications can drive their UI entirely from `state$` + `receive$` + `errors$`, without rebuilding state, read loops, or send queues themselves.

## Table of Contents

- [SerialSession (v2) at a glance](#serialsession-v2-at-a-glance)
- [Features](#features)
- [Framework Support](#framework-support)
- [Browser Support](#browser-support)
- [Installation](#installation)
- [Documentation](#documentation)
- [Examples](#examples)
- [Project Icon](#project-icon)
- [AI Assistant (MCP)](#ai-assistant-mcp)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

## Features

- **Session-oriented reactive API**: a single `SerialSession` exposes `state$`, `receive$`, `errors$`, plus `connect$`, `disconnect$`, and `send$`
- **UTF-8 text stream**: `receive$` is already decoded with a streaming `TextDecoder`, so multi-byte characters split across chunks are joined correctly
- **Ordered send queue**: concurrent `send$` calls are serialised internally in call order, without the caller having to manage a writer
- **Unified error channel**: every I/O error is normalised into `SerialError` and multiplexed on `errors$`
- **Explicit lifecycle**: `state$` emits `idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` so UIs can drive directly from it
- **TypeScript support**: full TypeScript type definitions included
- **Framework agnostic**: works with any JavaScript/TypeScript framework or vanilla JavaScript

## Framework Support

This library is framework-agnostic and can be used with:

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## Browser Support

The Web Serial API is currently only supported in Chromium-based browsers:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

`SerialSession.isBrowserSupported()` returns a synchronous boolean for feature detection before calling `connect$`.

## Installation

Install the package using npm or pnpm:

```bash
npm install @gurezo/web-serial-rxjs
# or
pnpm add @gurezo/web-serial-rxjs
```

### Peer Dependencies

This library requires RxJS as a peer dependency:

```bash
npm install rxjs
# or
pnpm add rxjs
```

**Minimum required version**: RxJS ^7.8.0

## SerialSession (v2) at a glance

`createSerialSession` returns a single **SerialSession**. All interaction goes through the fields below. The public API is intentionally small; line framing, “connected” booleans, and other patterns are built with plain RxJS on top of the streams (see [Advanced Usage](docs/ADVANCED_USAGE.md)).

| Surface | Role |
| --- | --- |
| `state$` | **Connection lifecycle** — `idle` / `connecting` / `connected` / `disconnecting` / `error` / `unsupported`. Replays the current state on subscribe. |
| `receive$` | **Raw incoming UTF-8 text** as decoded string **chunks** (not line-delimited; multi-byte safe). |
| `errors$` | **All `SerialError` instances** from connect / read / write / close (primary error channel). |
| `connect$()` | **Open** a user-selected port and start the internal read pump. |
| `disconnect$()` | **Close** the port and stop the pump. |
| `send$(string \| Uint8Array)` | **Enqueue** outgoing data; writes are **FIFO-ordered** when multiple `send$` run concurrently. |
| `isBrowserSupported()` | Synchronous `boolean` for Web Serial availability before `connect$`. |

**`connected$` (for simple UIs)** — not a property on `SerialSession`. For a read-only `Observable<boolean>`, compose `state$`:

```typescript
import { map } from 'rxjs';

const connected$ = session.state$.pipe(map((s) => s === 'connected'));
```

**Line-delimited “lines$”** — not a built-in property. Frame on top of `receive$` (recipes in [Advanced Usage](docs/ADVANCED_USAGE.md#line-framing)).

### Minimal example

```typescript
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  throw new Error('Web Serial is not available in this browser');
}

session.receive$.subscribe(console.log);
session.errors$.subscribe(console.error);
session.connect$().subscribe();
session.send$('hello\r\n').subscribe();
```

In real apps, handle `connect$().subscribe({ next, error })` and `send$().subscribe({ error })` (errors are also on `errors$`). A fuller walkthrough is in [Quick Start](docs/QUICK_START.md).

## Documentation

| Doc | Use it for |
| --- | --- |
| **This README** | Mental model, API surface, and where to go next. |
| **[Quick Start](docs/QUICK_START.md)** | Shortest path to a working open port and subscriptions. |
| **[Advanced Usage](docs/ADVANCED_USAGE.md)** | Line framing, request/response-style flows, and recovery. |
| **[API Reference](docs/API_REFERENCE.md)** | Options, `SerialSessionState`, and `SerialError` details. |
| **[v1 → v2 Migration Guide](docs/MIGRATION_V2.md)** | Replacing the removed v1 `SerialClient` / `ShellClient` API. |

## Examples

Examples are available for the following environments:

- **[Angular](apps/example-angular/)** - Angular example using a Service
- **[React](apps/example-react/)** - React example with custom hook (`useSerialSession`)
- **[Svelte](apps/example-svelte/)** - Svelte example using Svelte Store
- **[Vanilla JavaScript](apps/example-vanilla-js/)** - Basic usage with vanilla JavaScript
- **[Vanilla TypeScript](apps/example-vanilla-ts/)** - TypeScript example with RxJS
- **[Vue](apps/example-vue/)** - Vue 3 example using Composition API

Each sample is a **minimal smoke test** for **connect**, **receive** (newline-delimited lines derived from `receive$`), **send**, and **disconnect**. Deeper patterns live in [Advanced Usage](docs/ADVANCED_USAGE.md).

Each example includes a README with setup and usage instructions.

## Project Icon

The project icon includes a modified design inspired by the [RxJS](https://rxjs.dev/) logo,
combined with a serial connector motif to represent Web Serial communication.

The icon is used only to indicate that this library provides
RxJS-based abstractions for the Web Serial API.

This project is an independent open source project and is **not affiliated with,
endorsed by, or sponsored by the [ReactiveX](http://reactivex.io/) or [RxJS](https://rxjs.dev/) project**.

## AI Assistant (MCP)

This project includes [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server configuration for AI-assisted development. The following MCP servers are available:

| Server          | Purpose                                                                                |
| --------------- | -------------------------------------------------------------------------------------- |
| **nx-mcp**      | Nx workspace analysis, project graph, CI monitoring, and documentation                 |
| **angular-cli** | Angular CLI tools for example-angular (code generation, documentation, best practices) |
| **svelte**      | Svelte/SvelteKit documentation and code analysis for example-svelte                    |

**Configuration files:**

- `.mcp.json` - Standard MCP configuration (Cursor, VS Code, Claude, etc.)
- `.cursor/mcp.json` - Cursor-specific configuration

To use MCP servers in Cursor, the configuration is automatically loaded from `.cursor/mcp.json`. For VS Code, add the MCP extension and configure it to use `.mcp.json`, or add the server definitions to your MCP settings.

## Development and Release Strategy

This project follows a **trunk-based development** approach:

- **`main` branch**: Always in a release-ready state
- **Short-lived branches**: `feature/*`, `fix/*`, `docs/*` for pull requests
- **Releases**: Managed via Git tags (e.g., `v1.0.0`), not branches
- **Version maintenance**: `release/v*` branches are added only when needed for maintaining multiple major versions

For detailed contribution guidelines, see [CONTRIBUTING.md](CONTRIBUTING.md).

For detailed release instructions, see [RELEASING.md](RELEASING.md).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process
- Release process

For Japanese contributors, please see [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md).

For release instructions, see [RELEASING.md](RELEASING.md) (or [RELEASING.ja.md](RELEASING.ja.md) for Japanese).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **GitHub Repository**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API Specification**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

# web-serial-rxjs

<p align="center">
  <img src="./assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The public API exposes a single `SerialSession` so applications can drive their UI from `state$` (canonical lifecycle state) + `errors$` (error event channel) + `receive$` + `lines$`, without rebuilding state, read loops, or send queues themselves.

## Table of Contents

- [SerialSession at a glance](#serialsession-at-a-glance)
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

- **Session-oriented reactive API**: a single `SerialSession` exposes `state$` (canonical lifecycle discriminated union), `errors$` (error event channel), `receive$`, `lines$`, plus convenience streams such as `isConnected$`, and `connect$`, `disconnect$`, and `send$`
- **UTF-8 text stream**: `receive$` is already decoded with a streaming `TextDecoder`, so multi-byte characters split across chunks are joined correctly
- **Ordered send queue**: concurrent `send$` calls are serialised internally in call order, without the caller having to manage a writer
- **Unified error channel**: every I/O error is normalised into `SerialError` and multiplexed on `errors$`
- **Explicit lifecycle**: `state$` emits a discriminated union with `status` (`idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` / `disposed`) so UIs can narrow on `state.status` and access per-state data such as `state.portInfo`
- **TypeScript support**: full TypeScript type definitions included
- **Framework agnostic**: works with any JavaScript/TypeScript framework or vanilla JavaScript

## Framework Support

This library is framework-agnostic and can be used with:

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## Browser Support

The Web Serial API is supported on **desktop** browsers only. Smartphones and other mobile browsers are not supported.

Supported desktop browsers:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** does not currently support the Web Serial API.

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

## SerialSession at a glance

The **canonical** API map (feature list, the `SerialSession` / `SerialSessionState` tables, and a minimal example) is in the package documentation:

- **[SerialSession overview](packages/web-serial-rxjs/docs/OVERVIEW.md)** · [日本語](packages/web-serial-rxjs/docs/guide/ja/overview.md)

The [npm `README` for `@gurezo/web-serial-rxjs`](packages/web-serial-rxjs/README.md) is a short index; for a first connection, follow [Quick Start](packages/web-serial-rxjs/docs/QUICK_START.md).

Choosing **`receive$`** versus **`lines$`**—terminal-style mirrors and buffering versus newline-delimited logs and parsing—is spelled out in [that package README](packages/web-serial-rxjs/README.md) (`receive$` vs `lines$`).

## Documentation

Documentation is split into **Guide** (how to use; Japanese and English hand-written Markdown) and **API Reference** (English TypeDoc from TypeScript JSDoc). The canonical layout is defined in [Documentation Architecture](packages/web-serial-rxjs/docs/ARCHITECTURE.md) ([日本語](packages/web-serial-rxjs/docs/ARCHITECTURE.ja.md)). Guide files will move to `packages/web-serial-rxjs/docs/guide/{en,ja}/` in upcoming issues; links below point to the current paths until then.

| Doc | Use it for |
| --- | --- |
| **This README** | Monorepo hub: feature summary, examples, and contribution links. |
| **[SerialSession overview](packages/web-serial-rxjs/docs/OVERVIEW.md)** | Full `SerialSession` / `SerialSessionState` map and minimal example. |
| **[Quick Start](packages/web-serial-rxjs/docs/QUICK_START.md)** | Shortest path to a working open port and subscriptions. |
| **[Advanced Usage](packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)** | Line framing, request/response-style flows, and recovery. |
| **[API Reference](packages/web-serial-rxjs/docs/API_REFERENCE.md)** | Options, `SerialSessionState`, and `SerialError` details. |
| **[v2 → v3 Migration Guide](packages/web-serial-rxjs/docs/MIGRATION_V3.md)** | `state$` discriminated union, `SerialSessionStatus`, and `context.cause`. |
| **[v1 → v2 Migration Guide](packages/web-serial-rxjs/docs/MIGRATION_V2.md)** | Replacing the removed v1 `SerialClient` / `ShellClient` API. |

## Examples

Examples are available for the following environments:

- **[Angular](apps/example-angular/)** - Angular example using a Service
- **[React](apps/example-react/)** - React example with custom hook (`useSerialSession`)
- **[Svelte](apps/example-svelte/)** - Svelte example using Svelte Store
- **[Vanilla JavaScript](apps/example-vanilla-js/)** - Basic usage with vanilla JavaScript
- **[Vanilla TypeScript](apps/example-vanilla-ts/)** - TypeScript example with RxJS
- **[Vue](apps/example-vue/)** - Vue 3 example using Composition API

Each sample is a **minimal smoke test** for **connect**, **receive** (terminal-style append via **`receive$`** so `\r` redraws stay intact), **send**, and **disconnect**. Use **`lines$`** only when you want newline-delimited logging or parsing—not for mirroring interactive terminal output; deeper patterns live in [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.md).

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

### Cursor rules and agents

This repository also ships [Cursor](https://www.cursor.com/) rules under `.cursor/rules/` (grouped by topic: `commits/` for Conventional Commits and PR titles, `typescript/`, `rxjs/`, `angular/`, `nx/` including Nx workspace tasks and **commit scope** guidance, `examples/`, and `workflow/`). Rules are split into small `.mdc` files by responsibility to reduce overlap and keep prompts focused.

- `.cursor/agents/ci-monitor-subagent.md` — optional CI helper used with `/monitor-ci` and the Nx MCP `ci_information` / `update_self_healing_fix` tools when Nx Cloud CI monitoring is enabled.

Commit scope tables stay aligned with `commitlint.config.js`; see `.cursor/skills/conventional-commits/` for examples and the scope list.

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

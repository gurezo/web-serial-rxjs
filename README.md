# web-serial-rxjs

<p align="center">
  <img src="./assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs project icon" width="512" />
</p>

A TypeScript library that wraps the Web Serial API with a minimal, session-oriented RxJS surface. The public API exposes a single `SerialSession` so applications can drive their UI from `state$` (canonical lifecycle state) + `errors$` (error event channel) + `receive$` + `lines$`, without rebuilding state, read loops, or send queues themselves.

**Audience:** This README is primarily for **library users** (install, connect, Examples, Guide). Contributors and maintainers should start from [Contributing](#contributing) and [CONTRIBUTING.md](CONTRIBUTING.md). The short [npm package README](packages/web-serial-rxjs/README.md) is the consumer-facing index published with `@gurezo/web-serial-rxjs`; this repository README is the monorepo hub (examples under `apps/`, contribution, and development tools).

## Table of Contents

- [Features](#features)
- [Framework Support](#framework-support)
- [Browser Support](#browser-support)
- [Installation](#installation)
- [SerialSession at a glance](#serialsession-at-a-glance)
- [Documentation](#documentation)
- [Examples](#examples)
- [Migration](#migration)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [Development tools](#development-tools)
- [Development and Release Strategy](#development-and-release-strategy)
- [Project Icon](#project-icon)
- [Security](#security)
- [License](#license)
- [Links](#links)

## Features

- **Session-oriented reactive API**: a single `SerialSession` exposes `state$` (canonical lifecycle discriminated union), `errors$` (error event channel), `receive$`, `lines$`, and `connect$`, `disconnect$`, `dispose$`, and `send$`
- **UTF-8 text stream**: `receive$` is already decoded with a streaming `TextDecoder`, so multi-byte characters split across chunks are joined correctly. This library is **text-first**: binary receive and non-UTF-8 charsets are out of scope (binary **send** via `send$(Uint8Array)` is supported). See the [package README supported-data table](packages/web-serial-rxjs/README.md#supported-data-text--binary--charset) and [Guide concepts](packages/web-serial-rxjs/docs/guide/en/concepts.md#supported-data-text--binary--charset)
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

`isWebSerialSupported()` returns a synchronous boolean for feature detection before calling `connect$`.

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

- **[SerialSession overview](packages/web-serial-rxjs/docs/guide/en/overview.md)** · [日本語](packages/web-serial-rxjs/docs/guide/ja/overview.md)

The [npm `README` for `@gurezo/web-serial-rxjs`](packages/web-serial-rxjs/README.md) is a short index; for a first connection, follow [Quick Start](packages/web-serial-rxjs/docs/guide/en/quick-start.md).

Choosing **`receive$`** versus **`lines$`**—terminal-style mirrors and buffering versus newline-delimited logs and parsing—is spelled out in [that package README](packages/web-serial-rxjs/README.md) (`receive$` vs `lines$`).

## Documentation

Documentation is split into **Guide** (how to use; Japanese and English hand-written Markdown) and **API Reference** (English TypeDoc from TypeScript JSDoc). The canonical layout is defined in [Documentation Architecture](packages/web-serial-rxjs/docs/ARCHITECTURE.md) ([日本語](packages/web-serial-rxjs/docs/ARCHITECTURE.ja.md)).

**Published documentation site:** [gurezo.net/web-serial-rxjs](https://gurezo.net/web-serial-rxjs/)

**Role split:** use the [npm package README](packages/web-serial-rxjs/README.md) for a short consumer index shipped with the package; use **this repository README** for monorepo examples, contribution entry points, and development-tool pointers.

| Doc | Use it for |
| --- | --- |
| **This README** | Monorepo hub: feature summary, examples, and contribution links. |
| **[npm package README](packages/web-serial-rxjs/README.md)** | Short consumer-facing index published with `@gurezo/web-serial-rxjs`. |
| **[English Guide (site)](https://gurezo.net/web-serial-rxjs/guide/en/README.html)** | Getting Started reading order and full index on the published site. |
| **[日本語 Guide (site)](https://gurezo.net/web-serial-rxjs/guide/ja/README.html)** | Getting Started の読み順と一覧（公開サイト）。 |
| **[API Reference (site)](https://gurezo.net/web-serial-rxjs/api/index.html)** | English TypeDoc API Reference on the published site. |
| **[English Guide index](packages/web-serial-rxjs/docs/guide/en/README.md)** | Getting Started reading order and full index (source). |
| **[SerialSession overview](packages/web-serial-rxjs/docs/guide/en/overview.md)** | Full `SerialSession` / `SerialSessionState` map and minimal example. |
| **[Quick Start](packages/web-serial-rxjs/docs/guide/en/quick-start.md)** | Shortest path to a working open port and subscriptions. |
| **[Advanced Usage](packages/web-serial-rxjs/docs/guide/en/advanced-usage.md)** | Line framing, request/response-style flows, and recovery. |
| **[Troubleshooting](packages/web-serial-rxjs/docs/guide/en/troubleshooting.md)** | Common Web Serial / session problems and self-help checks. |
| **[API concepts and design notes](packages/web-serial-rxjs/docs/guide/en/concepts.md)** | Options, `SerialSessionState`, and `SerialError` details. |
| **[v3 → v4 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v4.md)** | Phase 1+2 removals (`receiveReplay$`, `isBrowserSupported()`, options cleanup). |
| **[v2 → v3 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v3.md)** | `state$` discriminated union, `SerialSessionStatus`, and `context.cause`. |
| **[v1 → v2 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v2.md)** | Replacing the removed v1 `SerialClient` / `ShellClient` API. |

## Examples

Framework examples demonstrate **how to wire `SerialSession`** in each stack. They are **not** a supported-device catalog. For communication patterns (line protocol, command/reply, timeout, and so on), see the [Recipes index](packages/web-serial-rxjs/docs/guide/en/recipes.md) instead.

**Start here:** [Vanilla TypeScript](apps/example-vanilla-ts/) (Recommended / まずはこちら) — try the library API with TypeScript and RxJS, with no UI framework.

- **[Vanilla TypeScript](apps/example-vanilla-ts/)** — Recommended starting point (TypeScript + RxJS, no framework)
- **[Vanilla JavaScript](apps/example-vanilla-js/)** — Same connect flow without TypeScript or a UI framework
- **[Angular](apps/example-angular/)** — Wire SerialSession through an injectable Service
- **[React](apps/example-react/)** — Custom hook (`useSerialSession`)
- **[Vue](apps/example-vue/)** — Vue 3 Composition API (composable)
- **[Svelte](apps/example-svelte/)** — Svelte Store

Interactive demos: [https://gurezo.net/web-serial-rxjs/examples/](https://gurezo.net/web-serial-rxjs/examples/).

Each sample is a **minimal smoke test** for **connect**, **receive** (terminal-style append via **`receive$`** so `\r` redraws stay intact), **send**, and **disconnect**. Use **`lines$`** only when you want newline-delimited logging or parsing—not for mirroring interactive terminal output; deeper patterns live in [Advanced Usage](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/guide/en/advanced-usage.md).

Each example includes a README with setup and usage instructions.

## Migration

Upgrading from an older major version:

- [v3 → v4 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v4.md) · [日本語](packages/web-serial-rxjs/docs/guide/ja/migration-v4.md)
- [v2 → v3 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v3.md) · [日本語](packages/web-serial-rxjs/docs/guide/ja/migration-v3.md)
- [v1 → v2 Migration Guide](packages/web-serial-rxjs/docs/guide/en/migration-v2.md) · [日本語](packages/web-serial-rxjs/docs/guide/ja/migration-v2.md)

## Troubleshooting

Common Web Serial / session problems and self-help checks:

- [Troubleshooting (English Guide)](packages/web-serial-rxjs/docs/guide/en/troubleshooting.md) · [日本語](packages/web-serial-rxjs/docs/guide/ja/troubleshooting.md)

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Development setup
- Code style guidelines
- Commit message conventions
- Pull request process
- Release process

For Japanese contributors, please see [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md).

For release instructions, see [RELEASING.md](RELEASING.md) (or [RELEASING.ja.md](RELEASING.ja.md) for Japanese).

## Development tools

For AI-assisted development in this repository:

- **MCP servers** (Nx, Angular CLI, Svelte) and configuration — see [AI Assistant (MCP)](CONTRIBUTING.md#5-ai-assistant-mcp---optional) in CONTRIBUTING
- **Cursor rules, skills, and agents** — see [Cursor Rules / Skills](CONTRIBUTING.md#6-cursor-rules--skills---optional) in CONTRIBUTING

日本語は [CONTRIBUTING.ja.md](CONTRIBUTING.ja.md) の同セクションを参照してください。

## Development and Release Strategy

This project follows **trunk-based development**: `main` stays release-ready; work lands via short-lived `feature/*` / `fix/*` / `docs/*` pull requests; releases are Git tags (for example `v1.0.0`).

- Contribution details: [CONTRIBUTING.md](CONTRIBUTING.md)
- Release instructions: [RELEASING.md](RELEASING.md)

## Project Icon

The project icon includes a modified design inspired by the [RxJS](https://rxjs.dev/) logo,
combined with a serial connector motif to represent Web Serial communication.

The icon is used only to indicate that this library provides
RxJS-based abstractions for the Web Serial API.

This project is an independent open source project and is **not affiliated with,
endorsed by, or sponsored by the [ReactiveX](http://reactivex.io/) or [RxJS](https://rxjs.dev/) project**.

## Security

To report a vulnerability privately, see the [Security Policy](SECURITY.md) ([日本語](SECURITY.ja.md)). Do **not** open a public issue with vulnerability details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Documentation**: [https://gurezo.net/web-serial-rxjs/](https://gurezo.net/web-serial-rxjs/)
- **GitHub Repository**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **Issues**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Security Policy**: [SECURITY.md](SECURITY.md) ([日本語](SECURITY.ja.md))
- **Web Serial API Specification**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

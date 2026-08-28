# English Guide

Hand-written Markdown Guide for using `@gurezo/web-serial-rxjs`. For exhaustive public API types, parameters, and return values, see the [English TypeDoc API Reference](modules.html).

The canonical documentation layout is defined in [ARCHITECTURE.md](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ARCHITECTURE.md).

## Getting Started (recommended reading order)

1. **[Overview](./overview.md)** — `SerialSession` public surface, role of `state$` / `errors$`, minimal sample
2. **[Quick Start](./quick-start.md)** — installation, connect, receive/send, disconnect/dispose, error handling
3. **[Framework session lifecycle](./framework-session-lifecycle.md)** — when to `disconnect$` / `dispose$` and where to unsubscribe (Angular, React, Vue, Svelte, Vanilla TS)
4. **[Browser support and support policy](./browser-support.md)** — Web Serial API availability vs official support
5. **[Version support and release policy](./version-support.md)** — SemVer, deprecations, support window (no LTS)
6. **[Bundler and framework compatibility](./bundler-compatibility.md)** — CI checks vs Example builds; ESM / RxJS / types baseline (no full matrix)
7. **[Bundle size and tree-shaking](./bundle-size.md)** — reproducible library-only size snapshot; measurement procedure
8. **[Verified environment listing criteria](./verified-environment.md)** — minimum fields if hardware results are published (not a device catalog)
9. **[Choosing receive$ / lines$ / terminalText$](./stream-selection.md)** — pick the receive stream by use case
10. **[Communication pattern Recipes](./recipes.md)** — find Guide pages by serial goal (line protocol, command/reply, timeout, …)
11. **[Advanced Usage](./advanced-usage.md)** — line framing, derived streams, recovery
12. **[Request / Response](./request-response.md)** — wait for replies on `lines$` / `receive$`, serialize commands
13. **[Timeout / cancel / retry](./timeout-cancel-retry.md)** — deadlines, teardown cancel, bounded retry (no core auto-retry)
14. **[API concepts and design notes](./concepts.md)** — options tables, `SerialError`, type supplements, swappable `SerialSession` contract, [supported data (text / binary / charset)](./concepts.md#supported-data-text--binary--charset) (not a TypeDoc substitute)
15. **[Binary receive API — design decision](./binary-receive-design.md)** — go / no-go for a future `receiveBytes$` (not implemented)
16. **[Hardware-free testing](./testing.md)** — Fake `SerialSession`, Vitest examples, DI injection (not published on npm)
17. **[Troubleshooting](./troubleshooting.md)** — common Web Serial / session problems and self-help checks

When migrating existing code:

- **[v3 → v4 Migration](./migration-v4.md)** — Phase 1+2 removals (`receiveReplay$`, `isBrowserSupported()`, options cleanup)
- **[v2 → v3 Migration](./migration-v3.md)** — `state$` discriminated union, `SerialSessionStatus`, `context.cause`
- **[v1 → v2 Migration](./migration-v2.md)** — mapping for removed v1 APIs

## Documentation index

| Document | Use it for |
| --- | --- |
| **[Overview](./overview.md)** | Public surface quick reference, feature summary, minimal sample |
| **[Quick Start](./quick-start.md)** | Basic flow from installation through disconnect |
| **[Framework session lifecycle](./framework-session-lifecycle.md)** | `disconnect$` / `dispose$` timing and subscription cleanup by framework |
| **[Browser support and support policy](./browser-support.md)** | API availability vs official support / untested |
| **[Version support and release policy](./version-support.md)** | SemVer, deprecations, support window (no LTS) |
| **[Bundler and framework compatibility](./bundler-compatibility.md)** | CI vs Examples; ESM / RxJS / types (no full bundler matrix) |
| **[Bundle size and tree-shaking](./bundle-size.md)** | Library-only size snapshot and reproducible measurement |
| **[Verified environment listing criteria](./verified-environment.md)** | Minimum verification fields for hardware results (no device catalog) |
| **[Choosing receive$ / lines$ / terminalText$](./stream-selection.md)** | Decision guide for the three receive streams |
| **[Communication pattern Recipes](./recipes.md)** | Pattern → Guide / Recipe index (not device compatibility) |
| **[Advanced Usage](./advanced-usage.md)** | Application patterns and RxJS recipes |
| **[Request / Response](./request-response.md)** | Command + matching reply on `lines$` / `receive$` (no core `request$`) |
| **[Timeout / cancel / retry](./timeout-cancel-retry.md)** | Timeouts, cancel on teardown, limited retry (no core auto-retry) |
| **[API concepts and design notes](./concepts.md)** | Options, error codes, type tables, swappable `SerialSession` contract, [supported data](./concepts.md#supported-data-text--binary--charset) |
| **[Binary receive API — design decision](./binary-receive-design.md)** | Design review: defer `receiveBytes$`; go / no-go criteria |
| **[Hardware-free testing](./testing.md)** | Controllable Fake `SerialSession`, Vitest / Angular / React examples (npm: not bundled) |
| **[Troubleshooting](./troubleshooting.md)** | Common problems, check steps, and what to report |
| **[v3 → v4 Migration](./migration-v4.md)** | Unified Phase 1+2 public API cleanup |
| **[v2 → v3 Migration](./migration-v3.md)** | Steps to adopt v3 canonical API |
| **[v1 → v2 Migration](./migration-v2.md)** | Replacements for removed v1 APIs |
| **[Phase 5 (archive)](./archive/migration-phase5.md)** | Legacy v1 documentation reference |

## Related links

- **Monorepo [README.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md)** — example apps index, contributing, browser support
- **日本語 Guide** — [日本語 Guide index](../ja/README.md)
- **Documentation home** — [../index.html](../index.html)
- **English TypeDoc API Reference** — [modules.html](modules.html)
- **Parent issue** — [#453](https://github.com/gurezo/web-serial-rxjs/issues/453) (documentation structure)

## Canonical API highlights

- **`state$`** — canonical lifecycle source. Branch on `state.status` with `SerialSessionStatus`; use `state.portInfo` when connected
- **`errors$`** — canonical fatal / non-fatal error event channel. Branch with `SerialError.is(SerialErrorCode.*)`
- **`dispose$()`** — sole session teardown API (subscribe to run it)
- **`isWebSerialSupported()`** — top-level sync feature detection (not a session method; not a support guarantee) — see [Browser support](./browser-support.md)
- Phase 1+2 removals (`destroy$`, `isConnected$`, `portInfo$`, `getPortInfo()`, `getCurrentPort()`, `receiveReplay$`, `isBrowserSupported()`) are documented in [Migrating to v4](./migration-v4.md)

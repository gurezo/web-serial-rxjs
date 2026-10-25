# English Guide

Hand-written Markdown Guide for using `@gurezo/web-serial-rxjs`. For exhaustive public API types, parameters, and return values, see the [English TypeDoc API Reference](modules.html).

The canonical documentation layout is defined in [ARCHITECTURE.md](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ARCHITECTURE.md).

This page is the only full index. Start with Getting Started, then open a How-to, Reference, or Project page for the task at hand.

## Getting Started

Read these first.

| Document | Use it for |
| --- | --- |
| **[Overview](./overview.md)** | Public surface quick reference, feature summary, minimal sample |
| **[Quick Start](./quick-start.md)** | Basic flow from installation through disconnect |
| **[Framework session lifecycle](./framework-session-lifecycle.md)** | `disconnect$` / `dispose$` timing and subscription cleanup by framework |

## How-to

Find a page by the serial task you need to finish.

| Document | Use it for |
| --- | --- |
| **[Choosing receive$ / lines$ / terminalText$](./stream-selection.md)** | Decision guide for the three receive streams |
| **[Communication pattern Recipes](./recipes.md)** | Pattern → Guide / Recipe index (not device compatibility) |
| **[Advanced Usage](./advanced-usage.md)** | Application patterns and RxJS recipes |
| **[Request / Response](./request-response.md)** | Command + matching reply on `lines$` / `receive$` (no core `request$`) |
| **[Timeout / cancel / retry](./timeout-cancel-retry.md)** | Timeouts, cancel on teardown, limited retry (no core auto-retry) |
| **[Troubleshooting](./troubleshooting.md)** | Common problems, check steps, Recovery Matrix, and what to report |
| **[Hardware-free testing](./testing.md)** | Controllable Fake `SerialSession`, Vitest / Angular / React examples (npm: not bundled) |

## Reference

Generated API docs and the hand-written design notes that sit beside them.

| Document | Use it for |
| --- | --- |
| **[English TypeDoc API Reference](modules.html)** | Exhaustive public API types, parameters, and return values |
| **[API concepts and design notes](./concepts.md)** | Options, error codes, type tables, swappable `SerialSession` contract, [supported data](./concepts.md#supported-data-text--binary--charset) |
| **[Binary receive API — design decision](./binary-receive-design.md)** | Design review: defer `receiveBytes$`; go / no-go criteria |

## Project

Support policy, release policy, and migration guides.

| Document | Use it for |
| --- | --- |
| **[Browser support and support policy](./browser-support.md)** | API availability vs official support / untested |
| **[Version support and release policy](./version-support.md)** | SemVer, deprecations, support window (no LTS) |
| **[Bundler and framework compatibility](./bundler-compatibility.md)** | CI vs Examples; ESM / RxJS / types (no full bundler matrix) |
| **[Bundle size and tree-shaking](./bundle-size.md)** | Library-only size snapshot and reproducible measurement |
| **[Verified environment listing criteria](./verified-environment.md)** | Minimum verification fields for hardware results (no device catalog) |
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

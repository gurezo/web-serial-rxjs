# English Guide

Hand-written Markdown Guide for using `@gurezo/web-serial-rxjs`. For exhaustive public API types, parameters, and return values, see the [English TypeDoc API Reference](modules.html).

The canonical documentation layout is defined in [ARCHITECTURE.md](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ARCHITECTURE.md).

## Getting Started (recommended reading order)

1. **[Overview](./overview.md)** — `SerialSession` public surface, role of `state$` / `errors$`, minimal sample
2. **[Quick Start](./quick-start.md)** — installation, connect, receive/send, disconnect/dispose, error handling
3. **[Advanced Usage](./advanced-usage.md)** — line framing, request/response-style flows, recovery
4. **[API concepts and design notes](./concepts.md)** — options tables, `SerialError`, type supplements (not a TypeDoc substitute)

When migrating existing code:

- **[v2 → v3 Migration](./migration-v3.md)** — `state$` discriminated union, `SerialSessionStatus`, `context.cause`
- **[v1 → v2 Migration](./migration-v2.md)** — mapping for removed v1 APIs

## Documentation index

| Document | Use it for |
| --- | --- |
| **[Overview](./overview.md)** | Public surface quick reference, feature summary, minimal sample |
| **[Quick Start](./quick-start.md)** | Basic flow from installation through disconnect |
| **[Advanced Usage](./advanced-usage.md)** | Application patterns and RxJS recipes |
| **[API concepts and design notes](./concepts.md)** | Options, error codes, and type tables |
| **[v2 → v3 Migration](./migration-v3.md)** | Steps to adopt v3 canonical API |
| **[v1 → v2 Migration](./migration-v2.md)** | Replacements for removed v1 APIs |
| **[Phase 5 (archive)](./archive/migration-phase5.md)** | Legacy v1 documentation reference |

## Related links

- **Monorepo [README.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md)** — example apps index, contributing, browser support
- **日本語 Guide** — [日本語 Guide index](../ja/README.md)
- **Documentation home** — [../index.html](../index.html)
- **English TypeDoc API Reference** — [modules.html](modules.html)
- **Parent issue** — [#453](https://github.com/gurezo/web-serial-rxjs/issues/453) (documentation structure)

## v3 canonical API highlights

- **`state$`** — canonical lifecycle source. Branch on `state.status` with `SerialSessionStatus`; use `state.portInfo` when connected
- **`errors$`** — canonical fatal / non-fatal error event channel. Branch with `SerialError.is(SerialErrorCode.*)`
- **Deprecated convenience** — `isConnected$`, `portInfo$`, `getPortInfo()` remain in v3.x; prefer `state$` narrowing in new code

# Bundle size and tree-shaking

This page records **how** we measure `@gurezo/web-serial-rxjs` size and tree-shaking, and publishes a **library-only** snapshot. It is for **adoption decisions**. Numbers are reproducible snapshots — **not** a CI size budget or a guarantee that every app bundler will match these bytes.

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#563](https://github.com/gurezo/web-serial-rxjs/issues/563) · Related: [Bundler and framework compatibility](./bundler-compatibility.md) · [Version support](./version-support.md)

## Terminology

| Term | Meaning |
| --- | --- |
| **Library-only** | Size of this package’s code with **`rxjs` external**. The RxJS **peer dependency** is **not** included in primary numbers |
| **npm pack tarball / unpacked** | Footprint of the published package (runtime, types, README, LICENSE, icon, …) |
| **Published artifact** | `dist/index.mjs` as shipped (unminified ESM; `rxjs` already external at build time) |
| **Consumer fixture** | A tiny app entry that imports named exports and is bundled with esbuild for measurement |
| **Tree-shaking** | Unused named exports from this package are omitted from the consumer bundle |

## What we measure

| Metric | Why |
| --- | --- |
| npm pack tarball + unpacked | Adopt / cache cost of the published package |
| `dist/index.mjs` raw / minified / gzip / brotli | Runtime artifact without app code |
| Minimal import (`isWebSerialSupported` only) | Lower bound when most of the API is unused |
| Session import (`createSerialSession` + `isWebSerialSupported`) | Typical “use the session” surface |
| Tree-shake probe | Confirm unused exports (for example `createTerminalBuffer`) are absent from the minimal minified bundle |

### What we do not promise

- A **hard size budget** enforced in CI
- That every bundler / minify / compression setting will match these bytes
- That **RxJS** (or framework) size is “included” — install `rxjs` separately; see [Bundler and framework compatibility](./bundler-compatibility.md)
- Per-device or per-Example size claims

## Measurement procedure

Script (canonical): [`tools/bundle-size/`](https://github.com/gurezo/web-serial-rxjs/tree/main/tools/bundle-size) ([README](https://github.com/gurezo/web-serial-rxjs/blob/main/tools/bundle-size/README.md)).

From the repository root:

```bash
pnpm --filter @gurezo/web-serial-rxjs build
node tools/bundle-size/measure.mjs
```

Conditions fixed by the script:

| Condition | Value |
| --- | --- |
| Bundler | workspace **esbuild** (version printed in the report) |
| Consumer resolve | symlink `tools/bundle-size/.out/node_modules/@gurezo/web-serial-rxjs` → package root (`exports` + `sideEffects` apply) |
| Peer handling | `rxjs` is **always** `external` |
| Minify | esbuild `minify: true` where labeled minified |
| gzip | Node `zlib` level **9** |
| brotli | Node brotli quality **11** |
| Output | stdout summary + `tools/bundle-size/.out/report.json` |

## Results snapshot

Recorded from `node tools/bundle-size/measure.mjs` after build.

| Field | Value |
| --- | --- |
| Package | `@gurezo/web-serial-rxjs@4.0.3` |
| Measured at (UTC) | `2026-08-08T06:06:08.377Z` |
| Node | `v24.16.0` |
| esbuild | `0.28.1` |
| `package.json` `sideEffects` | `false` |

### npm pack (full published package)

| Metric | Bytes |
| --- | --- |
| Tarball | 212,301 |
| Unpacked | 442,307 |
| Files | 65 |

Includes types, READMEs, LICENSE, icon, and `dist/` — **not** a substitute for runtime-only size.

### Published runtime artifact (`dist/index.mjs`, library-only)

| Form | raw | gzip | brotli |
| --- | ---: | ---: | ---: |
| As published (unminified) | 45,138 | 10,200 | 8,862 |
| Minified (esbuild, measurement only) | 16,497 | 5,527 | 5,005 |

The npm artifact itself is **not** minified; the minified row is for adopters comparing compressed transfer sizes.

### Consumer esbuild bundles (`rxjs` external)

| Fixture | Form | raw | gzip | brotli |
| --- | --- | ---: | ---: | ---: |
| `isWebSerialSupported` only | raw | 13,416 | 3,836 | 3,180 |
| `isWebSerialSupported` only | minified | 3,501 | 1,244 | 1,090 |
| `createSerialSession` + `isWebSerialSupported` | raw | 43,688 | 9,876 | 8,579 |
| `createSerialSession` + `isWebSerialSupported` | minified | 16,206 | 5,448 | 4,942 |

### Tree-shaking and `sideEffects`

- The package sets **`"sideEffects": false`** so bundlers that honor the field can treat the ESM entry as free of import-time side effects.
- The measurement script’s **tree-shaking check** asserts that the **minimal minified** consumer bundle does **not** contain unused export names such as `createTerminalBuffer`, `DEFAULT_TERMINAL_BUFFER_OPTIONS`, and `SerialErrorCode`.
- Snapshot result: **PASS** (those symbols absent).

Re-run the script after API or build changes; update this page when publishing a new baseline.

## Related

- Measurement tool: [`tools/bundle-size/`](https://github.com/gurezo/web-serial-rxjs/tree/main/tools/bundle-size)
- [Bundler and framework compatibility](./bundler-compatibility.md)
- [Version support and release policy](./version-support.md)
- [Browser support and support policy](./browser-support.md)
- Package [`package.json`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/package.json) (`exports`, `sideEffects`, `peerDependencies`)

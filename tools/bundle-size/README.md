# Bundle size measurement (`tools/bundle-size`)

Reproducible snapshots for `@gurezo/web-serial-rxjs` library-only size and tree-shaking (Issue [#563](https://github.com/gurezo/web-serial-rxjs/issues/563)).

This tool is **not** part of the pnpm workspace and does **not** fail CI on size budgets. Guide pages under `packages/web-serial-rxjs/docs/guide/` publish the narrative and latest recorded numbers.

## Prerequisites

From the repository root:

```bash
pnpm --filter @gurezo/web-serial-rxjs build
```

Requires Node.js (CI uses Node 22+; local measurement should note the version printed by the script) and the workspace `esbuild` dependency.

## Run

```bash
node tools/bundle-size/measure.mjs
```

Output:

- Human-readable summary on stdout
- Machine-readable `tools/bundle-size/.out/report.json`
- Intermediate consumer bundles under `tools/bundle-size/.out/` (gitignored)

## What is measured

| Metric | Meaning |
| --- | --- |
| npm pack tarball / unpacked | Published package footprint (types, README, LICENSE, icon, `dist/`, …) |
| `dist/index.mjs` raw / minified / gzip / brotli | Published ESM runtime artifact only |
| Consumer fixture A | `isWebSerialSupported` only (tree-shake probe) |
| Consumer fixture B | `createSerialSession` + `isWebSerialSupported` |

Fixtures import `@gurezo/web-serial-rxjs` through a symlink at `tools/bundle-size/.out/node_modules/@gurezo/web-serial-rxjs` so `package.json` `exports` and `sideEffects` are honored.

**Library-only:** `rxjs` is always `external`. Peer dependency bytes are **not** included in primary numbers.

**Compression:** gzip level 9; brotli quality 11.

## Tree-shaking check

The minified minimal fixture must not contain unused export names such as `createTerminalBuffer`. A non-zero exit code means the check failed.

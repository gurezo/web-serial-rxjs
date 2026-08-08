# Bundler and framework compatibility

This page explains what `@gurezo/web-serial-rxjs` verifies in CI, what Framework Examples demonstrate, and the **minimum import requirements** adopters should rely on. It is for **build / tooling decisions**. It does **not** publish a maintained matrix of every bundler as “supported” or “unsupported.”

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#564](https://github.com/gurezo/web-serial-rxjs/issues/564) · Related: [Browser support](./browser-support.md) · [Version support](./version-support.md)

## Terminology

| Term | Meaning |
| --- | --- |
| **Minimum package requirements** | Conditions we document for consuming the published npm package (ESM import, peer RxJS, published types) |
| **CI verification** | What the repository’s CI workflow actually builds and checks on each PR |
| **Example build** | An app under `apps/example-*` that builds successfully in this monorepo — a **reference wiring**, not a compatibility guarantee for every bundler or framework version |
| **Untested tooling** | A bundler or build system we do not run in CI. **Untested is not the same as “unsupported” or “rejected by the library”** |

## Minimum package requirements

These are the conditions adopters should treat as the baseline:

| Requirement | Policy |
| --- | --- |
| **Module format** | The package is **ESM-only**. `package.json` `exports` expose `import` → `dist/index.mjs` and `types` → `dist/index.d.ts`. There is no `require` / CommonJS export condition. |
| **Import** | Use ESM `import` from `@gurezo/web-serial-rxjs` in an environment that resolves the package `exports` map. |
| **RxJS** | **Peer dependency** `rxjs` **`^7.8.0`**. Install it in your app; it is not bundled into this package. |
| **TypeScript** | TypeScript is **not** a peer dependency. The package ships `.d.ts` for TypeScript consumers. We do **not** pin a minimum TypeScript version as a product guarantee; use a TypeScript release that can consume the published declarations. JavaScript consumers can ignore the types. |

Browser / Web Serial availability is separate — see [Browser support and support policy](./browser-support.md).

## What CI verifies

On pull requests to `main`, [CI](https://github.com/gurezo/web-serial-rxjs/blob/main/.github/workflows/ci.yml) typically:

| Check | Meaning |
| --- | --- |
| **Node.js 22** + **pnpm** | Install with a frozen lockfile |
| **`nx run-many --target=lint --all`** | Lint across workspace projects |
| **`nx run-many --target=build --all`** | Build the library and all Example apps |
| **`web-serial-rxjs:verify-dist`** | Post-build `dist/` artifacts and public API allowlist |
| **`web-serial-rxjs:verify-pack`** | npm pack contents, package metadata, and consumer ESM / types smoke where configured |
| **Tests** | Workspace test suite |

CI proves that **this monorepo’s current toolchain** builds. It does **not** mean every bundler version in the ecosystem is certified.

The library itself is built with **TypeScript (`tsc` for declarations) + esbuild (bundle)** inside the package scripts; that is how we produce npm artifacts, not a claim that every consumer must use esbuild.

## Framework Examples and build systems

Examples show **how to wire `SerialSession`** in each stack. Successful Example builds in CI are **smoke coverage for those apps**, not a promise that “Angular / React / Vue / Svelte / Vite / webpack are officially supported forever at every version.”

| Example | Build system used in this repo |
| --- | --- |
| `example-angular` | Angular application builder (`@angular/build:application`) |
| `example-react` | Vite via `@nx/vite:build` |
| `example-vue` | Vite via `@nx/vite:build` |
| `example-svelte` | Vite via `@nx/vite:build` |
| `example-vanilla-ts` | Vite via `@nx/vite:build` |
| `example-vanilla-js` | Vite via `@nx/vite:build` |

Start with the Examples index in the repository [README – Examples](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md#examples).

## What we do not maintain

- A **full official compatibility matrix** for Angular build, Vite, webpack, esbuild, Rollup, and every major version thereof.
- Statements that an untested bundler is **“not supported”** or **“incompatible.”** Absence from this page or from Examples only means **we do not claim continuous verification**.

If ESM resolution and the RxJS peer requirement are met, most modern bundlers that understand `package.json` `exports` should consume the package. Report concrete import / build failures via [GitHub Issues](https://github.com/gurezo/web-serial-rxjs/issues) with bundler, versions, and a minimal reproduction.

## Related

- [Quick Start – Installation and peer dependency](./quick-start.md#installation)
- [Browser support and support policy](./browser-support.md)
- [Version support and release policy](./version-support.md)
- Repository [README – Examples](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md#examples)
- Package [`package.json` exports and peers](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/package.json)

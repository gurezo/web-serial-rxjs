# Verified environment listing criteria

This page defines the **minimum verification information** required if this project later publishes hardware test results as a **Verified environment**. It is a **policy** document for adoption and maintenance decisions. It is **not** a device catalog, and it does **not** list Arduino, Raspberry Pi Pico, ESP32, or any other board as “supported.”

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#566](https://github.com/gurezo/web-serial-rxjs/issues/566) · Related: [Browser support](./browser-support.md) · [Recipes](./recipes.md) · [Hardware-free testing](./testing.md)

## Terminology

| Term | Meaning |
| --- | --- |
| **Verified environment** | A recorded hardware + OS + browser + library configuration that was exercised under the conditions below. Prefer this name over “Supported device.” |
| **Official support** | What this project tests and guarantees for **browsers** and **library versions** — see [Browser support](./browser-support.md) and [Version support](./version-support.md). Separate from hardware verification. |
| **Untested** | No published verification record. **Not** the same as “the library rejects it,” and **not** a claim of incompatibility. |
| **Historical** | A past verification that no longer meets freshness rules. Keep as context only; do **not** treat as a permanent guarantee. |

A device **name alone** is never enough to claim compatibility or “support.”

## Required fields

Any published Verified environment entry **must** include all of the following:

| Field | Required | Notes |
| --- | --- | --- |
| Device / board name | Yes | Product or board identifier used in the test |
| USB serial implementation | Yes | e.g. CDC ACM chip, FTDI, CP210x, native USB CDC on MCU |
| Firmware / sketch / software | Yes | Version **or** reproducible source (see [Recording format](#recording-format)) |
| OS | Yes | Name + version (major-only is not enough) |
| Browser name and version | Yes | Name + version (major-only is not enough) |
| `web-serial-rxjs` version | Yes | Exact package version under test (e.g. `4.0.4`) |
| baud rate | Yes | |
| data bits | Yes | |
| stop bits | Yes | |
| parity | Yes | |
| flow control | Yes | e.g. `none`, `hardware` |
| line ending | Yes | e.g. `\n`, `\r\n`, none |
| tested operations | Yes | Concrete actions (connect, write, line read, disconnect, …) |
| test date | Yes | ISO date `YYYY-MM-DD` |
| notes / known limitations | Yes | Use “none observed” if there are no caveats |
| report source | Yes | `maintainer` or `community` |

## Recording format

| Item | Format |
| --- | --- |
| **test date** | ISO calendar date: `YYYY-MM-DD` (required for freshness) |
| **OS** | `OS <name> <version>` — e.g. `macOS 15.6`, `Windows 11 24H2`. Major-only (`macOS 15`) is **not** sufficient. |
| **Browser** | `Browser <name> <version>` — e.g. `Chrome 131.0.6778.86`. Major-only (`Chrome 131`) is **not** sufficient. |
| **Firmware / software** | Either a **version string**, or a **source URL plus commit / tag** so another person can rebuild the same firmware or sketch. Prefer both when available. |

## Verified is not an official guarantee

- A Verified environment record means: **these conditions were exercised on this date**, with the fields above filled in.
- It does **not** mean perpetual hardware compatibility, vendor endorsement, or inclusion in [official browser / version support](./browser-support.md).
- It does **not** turn Recipes or Examples into a supported-device list — see [Recipes](./recipes.md) (patterns, not brands).
- Absence from any future list only means **we do not claim continuous verification** for that setup.

## Community reports

If community reports are accepted for publication:

1. Every **required field** above must be present.
2. The report must include **reproducible steps** (how to connect, what was sent/received, expected outcome).
3. Incomplete reports are **not** published.
4. The entry must set **report source** to `community` (maintainer-run tests use `maintainer`).
5. Maintainers may reject reports that cannot be reproduced or that omit firmware / version evidence.

## Stale and historical results

Verification is **time-bound**. Do **not** treat old results as a permanent guarantee.

An entry **may** be marked **historical** (annotated or removed from an active list) when **either**:

- more than **12 months** have passed since `test date`, **or**
- the library **major** version under test no longer matches the current major line (e.g. a `3.x` result after `4.x` is current).

Historical entries, if kept, must remain clearly labeled so readers do not confuse them with current verification.

## Current status

- This repository **defines criteria only** on this page.
- There is **no** published Verified environment list yet.
- **Unverified** devices and boards are **not** listed here or elsewhere as supported.
- Creating an actual Verified environment catalog is a **separate Issue** decision after these criteria exist.

## Related

- [Browser support and support policy](./browser-support.md)
- [Version support and release policy](./version-support.md)
- [Communication pattern Recipes](./recipes.md) — patterns, not device brands
- [Hardware-free testing](./testing.md) — Fake session for CI (not hardware verification)
- [Binary receive API — design decision](./binary-receive-design.md) — out of scope includes unverified hardware claims
- Parent tracking: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555)

# Binary receive API — design decision

This page records the **design review** for a possible binary receive API (for example `receiveBytes$`). It is **not** an implementation spec and does **not** ship a public `Uint8Array` receive stream in the current release.

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) · Related: [Supported data](./concepts.md#supported-data-text--binary--charset) · [Choosing receive$ / lines$ / terminalText$](./stream-selection.md) · [v1 → v2 Migration](./migration-v2.md)

## Recommendation (current)

**Do not add `receiveBytes$` (or any public wire-byte receive stream) for now.**

Revisit only when concrete product demand shows that existing text APIs and application-side Web Serial usage cannot meet the need, and the complexity cost is justified.

| Decision | Status |
| --- | --- |
| Add binary receive to the public API now | **No** (defer) |
| Document current limits clearly | Done ([Supported data](./concepts.md#supported-data-text--binary--charset), [#540](https://github.com/gurezo/web-serial-rxjs/issues/540)) |
| Preferred shape **if** revisited later | Additive opt-in (see [Preferred additive sketch](#preferred-additive-sketch-if-revisited)) |
| Implementation | Separate issue + separate PR from this design note |

This matches parent [#555](https://github.com/gurezo/web-serial-rxjs/issues/555): do not expand the core API casually; prefer Recipes and existing streams until a gap is proven.

## Current behavior

The library is **UTF-8 text–first**.

- The internal read pump reads `port.readable` (`ReadableStream<Uint8Array>`), then immediately decodes with a streaming `TextDecoder` (UTF-8, `fatal: false`, `stream: true`).
- `receive$`, `lines$`, and `terminalText$` are all `Observable<string>` derived from those decoded chunks.
- **Binary send** via `send$(Uint8Array)` is supported; **binary receive** is not. Send and receive are asymmetric for binary payloads.
- In docs and JSDoc, **“raw” on `receive$` means unframed decoded text chunks**, not wire bytes.

There is no public encoding option and no public byte stream today.

## Use-case gate

Ask whether raw bytes are **required**, or whether text streams already suffice.

| Need | Fit with current API |
| --- | --- |
| Newline / prompt text protocols, shells, logs | Use `lines$` / `receive$` / `terminalText$` |
| Custom **text** framing on decoder chunks | Compose RxJS on `receive$` ([Advanced Usage](./advanced-usage.md)) |
| Modbus RTU, COBS, SLIP, custom **binary** frames | **Not** a core concern — application-side (or outside this library) |
| Non-UTF-8 charsets (e.g. Shift_JIS) | **Not supported**; bytes-first would still need app decoding |
| Must preserve invalid UTF-8 / arbitrary octets | Requires wire bytes **before** `TextDecoder` — current pump cannot provide this |

**Gate:** add a library byte stream only when multiple real consumers need shared session lifecycle **and** cannot reasonably open Web Serial themselves or stay on decoded text.

Re-encoding decoded text (`new TextEncoder().encode(chunk)`) does **not** recover original wire bytes. It is lossy for invalid UTF-8 and binary protocols. Do not treat it as a substitute for `receiveBytes$`.

## Technical notes

### Chunk boundaries vs `ReadableStream` read sizes

Web Serial delivers `Uint8Array` chunks sized by the browser / OS, **not** by application protocol frames.

- One logical frame may span many reads.
- One read may contain multiple frames or partial frames.
- A future `receiveBytes$` would still emit **unframed byte chunks**. Framing (length prefixes, CRC, COBS, etc.) remains application responsibility — same rule as “do not depend on chunk boundaries” for `receive$` ([stream selection](./stream-selection.md#do-not-depend-on-chunk-boundaries)).

### Fan-out from one read loop

The port has a **single** `readable` stream and one active reader. Text and bytes cannot each own a separate `getReader()` without tearing down the other.

If a byte API were added later, the preferred internal shape is:

1. Read `Uint8Array` from the pump.
2. Optionally multicast a **copy** (or carefully documented ownership) to byte subscribers.
3. Only then run `TextDecoder` for the existing text pipeline (`receive$` → `lines$` / `terminalText$`).

Bytes must be taken **before** decoding. Passing binary through `TextDecoder` first and hoping to recover octets is incorrect.

### Slow subscribers and buffer growth

Today the receive path uses a multicast `Subject` for decoded text: the pump keeps reading; there is **no** Observable backpressure into Web Serial. A slow `receive$` subscriber does not pause `reader.read()`.

A byte stream would inherit the same tension:

- Defaulting to unbounded buffering to “catch up” late or slow subscribers risks memory growth.
- Pausing the read loop for one slow byte subscriber would stall **all** consumers, including text UI.

**Preferred policy if revisited:** keep pump-driven multicast with **no** unbounded replay; document that late subscribers miss past chunks (same as `receive$`); consider explicit caps / drop / error strategies only if real overload cases appear. Do not promise TCP-style backpressure through RxJS alone.

### Relationship to `receive$` / `lines$` / `terminalText$`

| Stream | Role |
| --- | --- |
| `receive$` | Unframed UTF-8 **decoded** chunks |
| `lines$` | Newline-framed strings from the text pipeline |
| `terminalText$` | Display-oriented fold of `receive$` |
| `receiveBytes$` (hypothetical) | Unframed **wire** `Uint8Array` chunks — parallel opt-in, **not** a replacement |

Do **not** replace or redefine `receive$` as bytes. Keep text streams stable; any byte API must be additive.

## Preferred additive sketch (if revisited)

Illustrative only — **not implemented**:

```typescript
interface SerialSession {
  readonly receive$: Observable<string>;
  readonly lines$: Observable<string>;
  readonly terminalText$: Observable<string>;
  /** Hypothetical — not in this release */
  readonly receiveBytes$: Observable<Uint8Array>;
}
```

Design constraints for a future implementation PR:

- **Additive / opt-in:** existing apps keep working without subscribing to bytes.
- **Not breaking:** no removal or semantic change of `receive$` / `lines$` / `terminalText$`.
- **Decode order:** bytes fan-out before `TextDecoder`.
- **No protocol helpers** in core (Modbus / COBS / SLIP stay out of scope — parent [#555](https://github.com/gurezo/web-serial-rxjs/issues/555)).
- **Separate PR** with tests; this design page alone is not an approval to merge API code.

Optional later refinements (also deferred): session option to disable text decoding when only bytes are needed; explicit buffer limits. None of these are required until go criteria are met.

## Compatibility with v1 `client.bytes$`

v1 exposed `client.bytes$`. v2+ removed it; there is still no binary receive API. See [Migrating to v2](./migration-v2.md).

| Approach | Verdict |
| --- | --- |
| Restore a drop-in `bytes$` name for compatibility | Not required; v2 migration already documents removal |
| `TextEncoder.encode` on `receive$` chunks | **Rejected** — does not restore wire bytes |
| New additive `receiveBytes$` if demand appears | Acceptable shape; not a silent revive of v1 semantics without design |

If a byte API ships later, migration notes should point here and to `migration-v2.md`, and must not claim lossless round-trip from decoded strings.

## Go / no-go checklist

Use this table when reconsidering the feature.

| Criterion | Current assessment |
| --- | --- |
| Confirmed real-world use cases that cannot use text APIs or app-owned Web Serial | **Not established** for shipping in-core |
| Clear reason `receiveBytes$` belongs in this library vs app code | **Insufficient** today |
| Responsibilities vs `receive$` / `lines$` / `terminalText$` documented | **Yes** (this page) |
| Same-loop fan-out (bytes before decode) understood | **Yes** |
| Slow-subscriber / buffer policy stated | **Yes** (no unbounded promise) |
| Additive API possible without breaking change | **Yes** |
| Value outweighs API and pump complexity | **No** for an immediate add |
| Choosing **not** to implement remains valid | **Yes — current decision** |

### Go (future)

All of the following should be true before an implementation issue is opened:

1. At least one concrete consumer need that cannot be met with `receive$` / Recipes / direct Web Serial.
2. Agreement that additive `receiveBytes$` (or equivalent) is the public shape.
3. Acceptance of multicast / no-replay semantics and framing-on-the-app rules.
4. Capacity to change the read pump with tests, without regressing text streams.

### No-go (now)

- Speculative “someone might need Modbus.”
- Implementing protocols inside the core package.
- Shipping bytes without updating Supported data / stream-selection docs and migration notes.

## Out of scope

- Implementing `receiveBytes$` in this documentation change
- Modbus RTU / COBS / SLIP / device-specific APIs
- Polyfills for browsers without Web Serial
- Claiming unverified hardware as supported

## Related guides

- [Supported data (concepts)](./concepts.md#supported-data-text--binary--charset) — current support table
- [Choosing receive$ / lines$ / terminalText$](./stream-selection.md) — text stream selection
- [Communication pattern Recipes](./recipes.md) — pattern index
- [v1 → v2 Migration](./migration-v2.md) — `client.bytes$` removal
- [Browser support and support policy](./browser-support.md) — API availability vs project support

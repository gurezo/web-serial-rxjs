# Choosing `receive$`, `lines$`, or `terminalText$`

`SerialSession` exposes three receive-side text streams. Pick by **what you want to do**, not by which name sounds “raw.” This page is the decision guide; for option tables and formal contracts, see [API concepts](./concepts.md) and the [TypeDoc API Reference](modules.html).

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#559](https://github.com/gurezo/web-serial-rxjs/issues/559)

## Quick comparison

| Goal | Recommend |
| --- | --- |
| Read newline-delimited logs | `lines$` |
| Read JSON Lines | `lines$` |
| Handle decoder chunks as they arrive | `receive$` |
| Handle display control that uses `\r` | `receive$` or `terminalText$` |
| Bind terminal-style text to a UI | `terminalText$` |
| Receive raw `Uint8Array` (wire bytes) | **Not supported** — see [Supported data](./concepts.md#supported-data-text--binary--charset) and [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) |

## Responsibilities at a glance

| Stream | Role |
| --- | --- |
| `receive$` | UTF-8 **decoded chunks** from the read pump. Not line-aligned. Preserves `\r` and other control characters. **Not** wire bytes. |
| `lines$` | Complete lines framed with `\n`, `\r\n`, and lone interior `\r`. For logs, one-line replies, and parsers. |
| `terminalText$` | Cumulative **display** text derived from `receive$`. Folds `\r` redraws; by default strips ANSI for plain-text UIs. Equivalent to `createTerminalBuffer(receive$).text$`. |

All three are driven by the same `connect$` read pump. They are **not** subscription-lazy: late subscribers see only new data (and `terminalText$` is a cumulative view of what the buffer has folded so far after you subscribe to its shared replay).

## Do not depend on chunk boundaries

`receive$` emissions follow the browser’s `ReadableStream` read sizes and the streaming `TextDecoder` — **not** your protocol’s message boundaries.

- A single logical line may arrive as several `receive$` chunks.
- One `receive$` chunk may contain several complete lines (those complete lines also appear on `lines$`).
- Never treat “one chunk == one command reply” unless you add your own framing on top of `receive$`.

For custom delimiters beyond the built-in line buffer, compose on `receive$` — see [Advanced Usage – Line framing](./advanced-usage.md#line-framing-built-in-vs-custom-framing-on-).

## When to use `lines$`

Use **`lines$`** when the device speaks a **newline-framed** text protocol:

- Log lines and status lines
- JSON Lines (`\n`-delimited JSON objects)
- Command replies that end with `\n` or `\r\n` (for example `OK`)

Incomplete tails (no terminator yet) stay in an internal buffer and are **not** emitted until a line completes. The incomplete tail is capped by `SerialSessionOptions.lineBuffer` (default `maxChars: 1_048_576`); overflow discards leading tail data and emits non-fatal `LINE_BUFFER_OVERFLOW` on `errors$` without disconnecting.

**Avoid** feeding `lines$` into a terminal widget that must preserve `\r` redraws — the line buffer may treat interior `\r` as a boundary and break progress/shell output.

## When to use `receive$`

Use **`receive$`** when you need **unframed decoded text**:

- Custom framing (non-newline delimiters, regex splits, batching)
- Prompts or terminators **without** a trailing newline
- Inspecting control characters, including `\r`, as the peer sent them
- Building your own terminal pipeline (or feeding `createTerminalBuffer` yourself)

In docs and JSDoc, **“raw” on `receive$` means unframed decoded text chunks**, not raw wire bytes and not a `Uint8Array` stream. See [What “raw” means on `receive$`](./concepts.md#what-raw-means-on-receive).

## When to use `terminalText$`

Use **`terminalText$`** when you want a **single string** suitable for a terminal-like viewport (`<textarea>`, log panel, etc.):

- Folds carriage-return redraws (`\r`) while keeping normal newline behavior
- By default strips ANSI escape sequences (`stripAnsi: true`); set `SerialSessionOptions.terminalBuffer.stripAnsi` to `false` to keep escapes in the display stream
- Bounded by `terminalBuffer` (`maxLines` / `maxChars`; defaults 10,000 lines and 1,048,576 characters)

Prefer `terminalText$` for display binding. Prefer `receive$` when you need the undecorated chunk stream (raw escapes, custom folding, or non-display consumers).

## Binary receive is not supported

There is **no** `receiveBytes$` or public `Uint8Array` receive stream. The read pump always decodes with a streaming UTF-8 `TextDecoder`.

- **Binary send** is supported via `send$(Uint8Array)`.
- **Binary receive** is not — send/receive are asymmetric for binary payloads.

Current limits and design notes: [Supported data](./concepts.md#supported-data-text--binary--charset). Future binary receive design: [#545](https://github.com/gurezo/web-serial-rxjs/issues/545).

## Related guides

- [SerialSession overview](./overview.md#serialsession-at-a-glance) — public surface map
- [Quick Start](./quick-start.md) — shortest path with `lines$`
- [Advanced Usage](./advanced-usage.md) — custom framing on `receive$`
- [Request / Response recipes](./request-response.md) — wait on `lines$` or `receive$`, then send
- [Timeout / cancel / retry](./timeout-cancel-retry.md) — deadlines around waits
- [API concepts – Supported data](./concepts.md#supported-data-text--binary--charset) — text / binary / charset scope

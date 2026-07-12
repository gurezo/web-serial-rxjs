# Svelte Example

This is a minimal Svelte example for the v2 `SerialSession` API. `useSerialSession` wraps `state$` / `errors$` into stores, derives `isConnected` from `state.status`, and binds **`receivedData`** to `session.terminalText$` for `\r`-safe terminal display.

**Using the library**: See the repository [Quick Start](../../docs/QUICK_START.md) ([日本語](../../docs/QUICK_START.ja.md)) and [SerialSession overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/OVERVIEW.ja.md)).

**Scope**: Connect, terminal display via `terminalText$`, send, disconnect. Use `lines$` only for line-delimited logging or parsing—not for primary shell output. Richer patterns: [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)).

## API Guide

### Quick Start

- `terminalText$`: terminal/CLI表示向け（`\r` を含む再描画に対応）
- `lines$`: 行単位イベント処理向け（ログ表示・簡易パーサ）
- `connect$()` / `disconnect$()`
- `send$()`

### Advanced Usage

- `receive$`: rawチャンクをそのまま扱う低レイヤー入力
- `state$` (derive `$isConnected` via `derived` store from `state.status`)
- `errors$`
- `createTerminalBuffer()`

`receive$` / `lines$` / `terminalText$` は用途が異なります。terminal 表示には `terminalText$` を使ってください。`lines$` は改行区切り処理向けであり、terminal ミラー用途には使わないでください。

## Features

- Browser support detection (`session.isBrowserSupported()`)
- Reactive session lifecycle driven by `state$` (`idle | connecting | connected | disconnecting | unsupported | error`)
- Configuration option (baud rate)
- Send data to the serial port through the library-owned FIFO send queue
- Receive terminal-oriented display text via `terminalText$`
- Unified error channel via `errors$`
- Full TypeScript type safety

## Requirements

- Modern browser with Web Serial API support (Chrome, Edge, Opera, etc.)
- Node.js and pnpm
- Nx workspace

## Installation

```bash
pnpm install
```

## Usage

### Development Server

```bash
pnpm exec nx serve example-svelte
```

The application will be available at `http://localhost:4220`.

### Build

```bash
pnpm exec nx build example-svelte
```

### Test

```bash
pnpm exec nx test example-svelte
```

### Lint

```bash
pnpm exec nx lint example-svelte
```

## How It Works

The example uses `createSerialSession` directly through `useSerialSession`:

1. **Browser support check**: `useSerialSession` calls `session.isBrowserSupported()` once at creation time and exposes the result as the `browserSupported` store.
2. **Connection**: Clicking "接続" invokes `connect$(baudRate)`; when baud rate changes, the helper creates a new `SerialSession` with the selected baud rate and connects it.
3. **State UI**: The helper subscribes to `session.state$` and derives `$isConnected` from `state.status`. `App.svelte` branches on `state.status` with `SerialSessionStatus` for status and uses `$isConnected` for button enablement.
4. **Sending**: Calling `send$(data)` enqueues the payload through the library's internal FIFO send queue, preserving call order regardless of how many concurrent subscribers run.
5. **Receiving**: The store reflects **`session.terminalText$`** in `receivedData`. **`lines$`** is for one-line-at-a-time logging or newline-only parsing; raw chunk streaming without terminal folding uses `receive$` (see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).
6. **Errors**: All connect/read/write/close failures are multiplexed through `session.errors$` and surfaced as the `errorMessage` store. No per-call try/catch wrappers are needed.

## Code Structure

- `src/main.ts`: Application entry point
- `src/App.svelte`: Main component; renders UI from the `useSerialSession` stores
- `src/stores/useSerialSession.ts`: Svelte helper wrapping `createSerialSession`
- `src/stores/useSerialSession.test.ts`: Store unit tests (Vitest)
- `src/App.test.ts`: Smoke test for the component
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration with the Svelte plugin
- `svelte.config.js`: Svelte configuration
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration

## Browser Compatibility

This example requires a browser that supports the Web Serial API on **desktop** only. Smartphones and other mobile browsers are not supported.

Supported desktop browsers:

- Chrome 89+
- Edge 89+
- Opera 75+
- Firefox 151+

Safari does not currently support the Web Serial API.

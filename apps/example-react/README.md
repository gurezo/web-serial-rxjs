# React Example

This is a minimal React example for the v2 `SerialSession` API (Web Serial). The `useSerialSession` hook maps `state$` / `errors$` into React state and binds **`receivedData`** to `session.terminalText$` so `\r` redraws (e.g. `ls -la`) stay aligned. Use **`lines$`** only for newline-delimited logs or parsers, not as the primary terminal view.

**Using the library**: See the repository [Quick Start](../../packages/web-serial-rxjs/docs/QUICK_START.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/quick-start.md)) and [SerialSession overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/overview.md)).

**Scope**: Connect, display from `terminalText$`, send, and disconnect. Use built-in `lines$` only when you need newline-delimited parsing or logging—not for interactive terminal mirrors. For richer recipes, see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/advanced-usage.md)).

## API Guide

### Quick Start

- `terminalText$`: terminal/CLI表示向け（`\r` を含む再描画に対応）
- `lines$`: 行単位イベント処理向け（ログ表示・簡易パーサ）
- `connect$()` / `disconnect$()`
- `send$()`

### Advanced Usage

- `receive$`: rawチャンクをそのまま扱う低レイヤー入力
- `state$` (derive `isConnected` from `state.status === SerialSessionStatus.Connected`)
- `errors$`
- `createTerminalBuffer()`

`receive$` / `lines$` / `terminalText$` は用途が異なります。terminal 表示には `terminalText$` を使ってください。`lines$` は改行区切り処理向けであり、terminal ミラー用途には使わないでください。

## Features

- Browser support detection (`session.isBrowserSupported()`)
- Reactive session lifecycle driven by `state$` (`idle | connecting | connected | disconnecting | unsupported | error`)
- Configuration option (baud rate)
- Send data to the serial port through the library-owned FIFO send queue
- Receive terminal-oriented display text via `terminalText$` (see `receivedData`); raw chunks remain on `receive$`
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
pnpm exec nx serve example-react
```

The application will be available at `http://localhost:4210`.

### Build

```bash
pnpm exec nx build example-react
```

### Test

```bash
pnpm exec nx test example-react
```

### Lint

```bash
pnpm exec nx lint example-react
```

## How It Works

The example uses `createSerialSession` directly through `useSerialSession`:

1. **Browser support check**: `useSerialSession` calls `session.isBrowserSupported()` once on mount and exposes the result as `browserSupported`.
2. **Connection**: Clicking "接続" invokes `connect$(baudRate)`; when baud rate changes, the hook creates a new `SerialSession` with the selected baud rate and connects it.
3. **State UI**: The hook subscribes to `session.state$` and derives `isConnected` from `state.status`. `App.tsx` branches on `state.status` with `SerialSessionStatus` for status text and uses `isConnected` for button enablement.
4. **Sending**: Calling `send$(data)` enqueues the payload through the library's internal FIFO send queue, preserving call order regardless of how many concurrent subscribers run.
5. **Receiving**: The hook subscribes to **`session.terminalText$`** and mirrors the result in `receivedData` (carriage-return safe). Use **`lines$`** for complete-line logging or simple parsers; it drops lone `\r` behavior (see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).
6. **Errors**: All connect/read/write/close failures are multiplexed through `session.errors$` and surfaced as the hook's `errorMessage` state. No per-call try/catch wrappers are needed.

## Code Structure

- `src/main.tsx`: Application entry point (React 18 `createRoot` API)
- `src/App.tsx`: Main component; renders UI from `useSerialSession` state
- `src/hooks/useSerialSession.ts`: Custom hook wrapping `createSerialSession`
- `src/hooks/useSerialSession.test.ts`: Hook unit tests (Testing Library + Vitest)
- `src/App.test.tsx`: Component-level tests
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration with React plugin
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration with JSX support

## Browser Compatibility

This example requires a browser that supports the Web Serial API on **desktop** only. Smartphones and other mobile browsers are not supported.

Supported desktop browsers:

- Chrome 89+
- Edge 89+
- Opera 75+
- Firefox 151+

Safari does not currently support the Web Serial API.

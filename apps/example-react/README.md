# React Example

This is a minimal React example for the v2 `SerialSession` API (Web Serial). The `useSerialSession` hook maps `state$` / `isConnected$` / `errors$` into React state and binds **`receivedData`** to `createTerminalBuffer(session.receive$).text$` so `\r` redraws (e.g. `ls -la`) stay aligned. Use **`lines$`** only for newline-delimited logs or parsers, not as the primary terminal view.

**Using the library**: See the repository [Quick Start](../../docs/QUICK_START.md) ([日本語](../../docs/QUICK_START.ja.md)) and [SerialSession (v2) overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/OVERVIEW.ja.md)).

**Scope**: Connect, display from `createTerminalBuffer(receive$)`, send, and disconnect. Use built-in `lines$` only when you need newline-delimited parsing or logging—not for interactive terminal mirrors. For richer recipes, see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)).

## Features

- Browser support detection (`session.isBrowserSupported()`)
- Reactive session lifecycle driven by `state$` (`idle | connecting | connected | disconnecting | unsupported | error`)
- Configuration option (baud rate)
- Send data to the serial port through the library-owned FIFO send queue
- Receive terminal-oriented display text via `createTerminalBuffer(receive$)` (see `receivedData`); raw chunks remain on `receive$`
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

The example uses the v2 `SerialSession` API directly:

1. **Browser support check**: `useSerialSession` calls `session.isBrowserSupported()` once on mount and exposes the result as `browserSupported`.
2. **Connection**: Clicking "接続" invokes `connect$(baudRate)`. When the baud rate changes between calls, the hook transparently creates a new `SerialSession` so subsequent streams reflect the new port configuration.
3. **State UI**: The hook subscribes to `session.state$` and `session.isConnected$`. `App.tsx` uses `SerialSessionState` for status text and `isConnected` for button enablement.
4. **Sending**: Calling `send$(data)` enqueues the payload through the library's internal FIFO send queue, preserving call order regardless of how many concurrent subscribers run.
5. **Receiving**: The hook subscribes to **`createTerminalBuffer(session.receive$).text$`** and mirrors the result in `receivedData` (carriage-return safe). Use **`lines$`** for complete-line logging or simple parsers; it drops lone `\r` behavior (see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).
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

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

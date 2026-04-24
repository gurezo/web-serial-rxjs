# React Example

This is a React example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with the v2 `SerialSession` API to interact with serial ports through the Web Serial API. The example exposes a thin custom hook (`useSerialSession`) that mirrors the Vue composable and the Angular service: it just reflects the library's `state$` / `receive$` / `errors$` streams into React state without reconstructing any connection state of its own.

**Using the library**: See the repository [Quick Start](../../docs/QUICK_START.md) ([日本語](../../docs/QUICK_START.ja.md)) and [SerialSession (v2) overview](../../README.md#serialsession-v2-at-a-glance) before reading this app.

## Features

- Browser support detection (`session.isBrowserSupported()`)
- Reactive session lifecycle driven by `state$` (`idle | connecting | connected | disconnecting | unsupported | error`)
- Configuration option (baud rate)
- Send data to the serial port through the library-owned FIFO send queue
- Receive decoded text from the read pump
- Unified error channel via `errors$`
- Full TypeScript type safety

## Completion criteria (Issue #208)

- `useSerialSession` hook is under 100 lines.
- The hook is implemented with `useEffect` + `subscribe` only — no BehaviorSubject reassembly, no read-loop management, no state-kind mapping.
- `App.tsx` drives its UI purely from the hook's returned React state (`state`, `receivedData`, `errorMessage`).

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
3. **State UI**: The hook subscribes to `session.state$` and mirrors it into a React `state` variable. `App.tsx` branches on the string union (`connecting`, `connected`, `disconnecting`, …) instead of maintaining its own boolean flags.
4. **Sending**: Calling `send$(data)` enqueues the payload through the library's internal FIFO send queue, preserving call order regardless of how many concurrent subscribers run.
5. **Receiving**: `session.receive$` is driven by the library's internal read pump, which is started eagerly in `connect$` — the hook simply appends each chunk to the `receivedData` string state.
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

# Vanilla JavaScript Example

This is a vanilla JavaScript example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API.

**Using the library**: See the repository [Quick Start](../../packages/web-serial-rxjs/docs/guide/en/quick-start.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/quick-start.md)) and [SerialSession overview](../../packages/web-serial-rxjs/docs/guide/en/overview.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/overview.md)).

**Scope**: Minimal smoke test—connect, display via `terminalText$` (session-following subscription), UI toggles via `state$` narrowing, send, disconnect. Use `lines$` only for line-delimited logging. Richer patterns: [Advanced Usage](../../packages/web-serial-rxjs/docs/guide/en/advanced-usage.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/advanced-usage.md)).

## API Guide

### Quick Start

- `terminalText$`: terminal/CLI表示向け（`\r` を含む再描画に対応）
- `lines$`: 行単位イベント処理向け（ログ表示・簡易パーサ）
- `connect$()` / `disconnect$()`
- `send$()`

### Advanced Usage

- `receive$`: rawチャンクをそのまま扱う低レイヤー入力
- `state$` (derive connected boolean from `state.status === SerialSessionStatus.Connected`)
- `errors$`
- `createTerminalBuffer()`

`receive$` / `lines$` / `terminalText$` は用途が異なります。terminal 表示には `terminalText$` を使ってください。`lines$` は改行区切り処理向けであり、terminal ミラー用途には使わないでください。

## Features

- Browser support detection
- Serial port connection/disconnection
- Configuration options (baud rate)
- Send data to serial port
- Receive data from serial port
- Real-time data display

## Requirements

- Modern browser with Web Serial API support (Chrome, Edge, Opera, etc.)
- Node.js and npm
- Nx workspace

## Installation

Make sure all dependencies are installed:

```bash
pnpm install
```

## Usage

### Development Server

Start the development server:

```bash
pnpm exec nx serve example-vanilla-js
```

The application will be available at `http://localhost:4230`

### Build

Build the application for production:

```bash
pnpm exec nx build example-vanilla-js
```

### Test

Run tests:

```bash
pnpm exec nx test example-vanilla-js
```

### Lint

Run linting:

```bash
pnpm exec nx lint example-vanilla-js
```

## How It Works

This example uses RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app creates a `SerialSession` with `createSerialSession()` and calls `connect$` / `disconnect$` / `send$` directly.

3. **Configuration**: Users can select the baud rate before connecting.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array`.

5. **Data Receiving**: Data is decoded as UTF-8; the app mirrors **`session.terminalText$`** into the textarea. **`lines$`** is for line-oriented logs, not raw `\r`-heavy shell output.

## Code Structure

- `src/main.js`: Application entry point
- `src/app.js`: Main application class with serial port logic
- `src/styles.css`: Styling
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration
- `project.json`: Nx project configuration

## Browser Compatibility

This example requires a browser that supports the Web Serial API on **desktop** only. Smartphones and other mobile browsers are not supported.

Supported desktop browsers:

- Chrome 89+
- Edge 89+
- Opera 75+
- Firefox 151+

Safari does not currently support the Web Serial API.

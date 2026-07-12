# Angular Example

This is an Angular example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Angular Services to encapsulate serial port communication logic.

**Using the library**: See the repository [Quick Start](../../packages/web-serial-rxjs/docs/QUICK_START.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/quick-start.md)) and [SerialSession overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/overview.md)).

**Scope**: Minimal smoke test—connect, display via `terminalText$` (`\r`-safe shells), optional line logging with `lines$`, UI via `state$` narrowing, send, disconnect. Richer patterns: [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/guide/ja/advanced-usage.md)).

## API Guide

### Quick Start

- `terminalText$`: terminal/CLI表示向け（`\r` を含む再描画に対応）
- `lines$`: 行単位イベント処理向け（ログ表示・簡易パーサ）
- `connect$()` / `disconnect$()`
- `send$()`

### Advanced Usage

- `receive$`: rawチャンクをそのまま扱う低レイヤー入力
- `state$` (derive connected boolean via `state.status === SerialSessionStatus.Connected`)
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
- Angular Services for state management
- Full TypeScript type safety

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
pnpm exec nx serve example-angular
```

The application will be available at `http://localhost:4200`

### Build

Build the application for production:

```bash
pnpm exec nx build example-angular
```

### Test

Run tests:

```bash
pnpm exec nx test example-angular
```

### Lint

Run linting:

```bash
pnpm exec nx lint example-angular
```

## How It Works

This example uses Angular Services and RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API using the `SerialClientService`.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `SerialClientService`, which internally uses `createSerialSession()` directly.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as component property.

4. **Data Sending**: Users can type text in the input field and send it to the serial port via the service's `send$` method.

5. **Data Receiving**: The service exposes **`terminalText$`** for textarea display (carriage-return redraws collapsed). **`lines$`** is for newline-delimited logging or parsers only—not for raw terminal mirrors. Raw chunks use **`receive$`** directly (see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).

## Code Structure

- `src/app/app.ts`: Main application component using the `SerialClientService`
- `src/app/app.html`: Component template with UI elements
- `src/app/app.scss`: Component styles
- `src/app/services/serial-client.service.ts`: Service for serial port communication
- `src/app/services/serial-client.service.spec.ts`: Tests for the service
- `src/styles.scss`: Global styles
- `src/main.ts`: Application entry point
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

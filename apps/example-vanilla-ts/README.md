# Vanilla TypeScript Example

This is a vanilla TypeScript example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API.

**Using the library**: See the repository [Quick Start](../../docs/QUICK_START.md) ([日本語](../../docs/QUICK_START.ja.md)) and [SerialSession (v2) overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/OVERVIEW.ja.md)).

**Scope**: Minimal smoke test—connect, display via `createTerminalBuffer(receive$)` (session-following subscription), UI toggles via `isConnected$`, send, disconnect. Use `lines$` only for line-delimited logging. Richer patterns: [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)).

## Features

- Browser support detection
- Serial port connection/disconnection
- Configuration options (baud rate)
- Send data to serial port
- Receive data from serial port
- Real-time data display
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
pnpm exec nx serve example-vanilla-ts
```

The application will be available at `http://localhost:4240`

### Build

Build the application for production:

```bash
pnpm exec nx build example-vanilla-ts
```

### Test

Run tests:

```bash
pnpm exec nx test example-vanilla-ts
```

### Lint

Run linting:

```bash
pnpm exec nx lint example-vanilla-ts
```

## How It Works

This example uses RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses `createSerialSession()` to create a session instance.

3. **Configuration**: Users can select the baud rate before connecting.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array`.

5. **Data Receiving**: Data is decoded as UTF-8; the app mirrors **`createTerminalBuffer(session.receive$).text$`** into the textarea so `\r`-based redraws (e.g. shell progress) stay aligned. Raw streaming without terminal folding uses `receive$`; **`lines$`** remains for line-oriented logs.

## Code Structure

- `src/main.ts`: Application entry point
- `src/app.ts`: Main application class with serial port logic (TypeScript with full type safety)
- `src/styles.css`: Styling
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration with strict mode enabled

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

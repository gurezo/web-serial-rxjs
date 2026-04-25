# Angular Example

This is an Angular example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Angular Services to encapsulate serial port communication logic.

**Using the library**: See the repository [Quick Start](../../docs/QUICK_START.md) ([日本語](../../docs/QUICK_START.ja.md)) and [SerialSession (v2) overview](../../packages/web-serial-rxjs/docs/OVERVIEW.md) ([日本語](../../packages/web-serial-rxjs/docs/OVERVIEW.ja.md)).

**Scope**: Minimal smoke test—connect, line-delimited receive via built-in `lines$`, connection UI via `isConnected$`, send, disconnect. Richer patterns: [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md) ([日本語](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)).

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

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `SerialClientService`, which internally wraps a v2 `SerialSession` created via `createSerialSession()`.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as component property.

4. **Data Sending**: Users can type text in the input field and send it to the serial port via the service's `send$` method.

5. **Data Receiving**: The service exposes the session's `lines$` (one string per line); the component appends each line to the textarea. The UI uses `isConnected$` for enable/disable. Raw chunks use `receive$` (see [Advanced Usage](../../packages/web-serial-rxjs/docs/ADVANCED_USAGE.md)).

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

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

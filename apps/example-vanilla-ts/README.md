# Vanilla TypeScript Example

This is a vanilla TypeScript example application demonstrating how to use the `@web-serial-rxjs/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API.

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
npm install
```

## Usage

### Development Server

Start the development server:

```bash
npx nx serve example-vanilla-ts
```

The application will be available at `http://localhost:4201`

### Build

Build the application for production:

```bash
npx nx build example-vanilla-ts
```

### Test

Run tests:

```bash
npx nx test example-vanilla-ts
```

### Lint

Run linting:

```bash
npx nx lint example-vanilla-ts
```

## How It Works

This example uses RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses `createSerialClient()` to create a client instance.

3. **Configuration**: Users can select the baud rate before connecting.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array`.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea.

## Code Structure

- `src/main.ts`: Application entry point
- `src/app.ts`: Main application class with serial port logic (TypeScript with full type safety)
- `src/styles.css`: Styling
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration with strict mode enabled

## Example Usage in Code

```typescript
import {
  createSerialClient,
  SerialClient,
} from '@web-serial-rxjs/web-serial-rxjs';

// Create a serial client
const client: SerialClient = createSerialClient({ baudRate: 115200 });

// Connect to a port
client.connect().subscribe({
  next: () => {
    console.log('Connected!');
    // Start reading
    client.getReadStream().subscribe({
      next: (data: Uint8Array) => {
        const text = new TextDecoder().decode(data);
        console.log('Received:', text);
      },
    });
  },
  error: (error: unknown) => {
    console.error('Connection error:', error);
  },
});

// Send data
const encoder = new TextEncoder();
const data = encoder.encode('Hello, Serial!');
client.write(data).subscribe({
  next: () => console.log('Data sent'),
  error: (error: unknown) => console.error('Send error:', error),
});
```

## TypeScript Features

This example demonstrates TypeScript best practices:

- **Strict Mode**: TypeScript strict mode is enabled for maximum type safety
- **Type Annotations**: All variables, parameters, and return types are explicitly typed
- **DOM Typing**: DOM elements are properly typed (e.g., `HTMLButtonElement`, `HTMLInputElement`)
- **RxJS Typing**: Observable subscriptions and operators are fully typed
- **Error Handling**: Errors are properly typed and handled

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

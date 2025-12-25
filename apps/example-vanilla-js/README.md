# Vanilla JavaScript Example

This is a vanilla JavaScript example application demonstrating how to use the `@web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API.

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

The application will be available at `http://localhost:4200`

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

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses `createSerialClient()` to create a client instance.

3. **Configuration**: Users can select the baud rate before connecting.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array`.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea.

## Code Structure

- `src/main.js`: Application entry point
- `src/app.js`: Main application class with serial port logic
- `src/styles.css`: Styling
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration
- `project.json`: Nx project configuration

## Example Usage in Code

```javascript
import { createSerialClient } from '@web-serial-rxjs';

// Create a serial client
const client = createSerialClient({ baudRate: 115200 });

// Connect to a port
client.connect().subscribe({
  next: () => {
    console.log('Connected!');
    // Start reading
    client.getReadStream().subscribe({
      next: (data) => {
        const text = new TextDecoder().decode(data);
        console.log('Received:', text);
      },
    });
  },
  error: (error) => {
    console.error('Connection error:', error);
  },
});

// Send data
const encoder = new TextEncoder();
const data = encoder.encode('Hello, Serial!');
client.write(data).subscribe({
  next: () => console.log('Data sent'),
  error: (error) => console.error('Send error:', error),
});
```

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

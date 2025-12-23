# Svelte Example

This is a Svelte example application demonstrating how to use the `@web-serial-rxjs/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Svelte stores to encapsulate serial port communication logic.

## Features

- Browser support detection
- Serial port connection/disconnection
- Configuration options (baud rate)
- Send data to serial port
- Receive data from serial port
- Real-time data display
- Svelte stores for state management
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
pnpm exec nx serve example-svelte
```

The application will be available at `http://localhost:4204`

### Build

Build the application for production:

```bash
pnpm exec nx build example-svelte
```

### Test

Run tests:

```bash
pnpm exec nx test example-svelte
```

### Lint

Run linting:

```bash
pnpm exec nx lint example-svelte
```

## How It Works

This example uses Svelte stores and RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API using the `useSerialClient` store.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `useSerialClient` store which internally uses `createSerialClient()` to create a client instance.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as Svelte component state.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array` through the store's `send` method.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea. The received data is managed as a Svelte store.

## Code Structure

- `src/main.ts`: Application entry point
- `src/App.svelte`: Main application component using the `useSerialClient` store
- `src/stores/useSerialClient.ts`: Svelte store for serial port communication
- `src/stores/useSerialClient.test.ts`: Tests for the store
- `src/App.test.ts`: Tests for the App component
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration with Svelte plugin
- `svelte.config.js`: Svelte configuration
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration

## Example Usage in Code

### Using the Store

```typescript
import { useSerialClient } from './stores/useSerialClient';
import { onMount } from 'svelte';
import { get } from 'svelte/store';

let baudRate = 9600;

const {
  browserSupported,
  connectionState,
  receivedData,
  connect,
  disconnect,
  send,
  clearReceivedData,
} = useSerialClient(baudRate);

// Subscribe to store values
let browserSupportedValue = false;
let connectionStateValue = get(connectionState);
let receivedDataValue = '';

onMount(() => {
  const unsubscribeBrowser = browserSupported.subscribe((value) => {
    browserSupportedValue = value;
  });
  const unsubscribeConnection = connectionState.subscribe((value) => {
    connectionStateValue = value;
  });
  const unsubscribeReceived = receivedData.subscribe((value) => {
    receivedDataValue = value;
  });

  return () => {
    unsubscribeBrowser();
    unsubscribeConnection();
    unsubscribeReceived();
  };
});

const handleConnect = async () => {
  try {
    await connect(baudRate);
  } catch (error) {
    console.error('Connection error:', error);
  }
};

const handleSend = async () => {
  try {
    await send('Hello, Serial!');
  } catch (error) {
    console.error('Send error:', error);
  }
};
```

### Direct API Usage (Inside Store)

```typescript
import {
  createSerialClient,
  SerialClient,
} from '@web-serial-rxjs/web-serial-rxjs';
import { writable } from 'svelte/store';
import { onDestroy } from 'svelte';

function useSerialClient(baudRate = 9600) {
  const connected = writable(false);
  let client: SerialClient | null = null;

  onDestroy(() => {
    if (client?.connected) {
      client.disconnect().subscribe();
    }
  });

  const connect = async () => {
    if (!client) {
      client = createSerialClient({ baudRate });
    }

    return new Promise<void>((resolve, reject) => {
      client?.connect().subscribe({
        next: () => {
          connected.set(true);
          resolve();
        },
        error: reject,
      });
    });
  };

  return { connected, connect };
}
```

## Svelte and TypeScript Features

This example demonstrates Svelte and TypeScript best practices:

- **Svelte 5**: Uses the latest Svelte version with modern features
- **Stores**: Encapsulates serial port logic in a reusable store
- **Type Safety**: Full TypeScript type safety with strict mode enabled
- **State Management**: Uses Svelte stores (`writable`) for reactive state management
- **RxJS Integration**: Properly manages RxJS Observable subscriptions with cleanup using `onDestroy`
- **Error Handling**: Errors are properly typed and handled with try-catch blocks
- **Testing**: Uses Svelte Testing Library for component and store testing

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

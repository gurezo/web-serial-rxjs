# React Example

This is a React example application demonstrating how to use the `@web-serial-rxjs/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses React custom hooks to encapsulate serial port communication logic.

## Features

- Browser support detection
- Serial port connection/disconnection
- Configuration options (baud rate)
- Send data to serial port
- Receive data from serial port
- Real-time data display
- React custom hooks for state management
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
npx nx serve example-react
```

The application will be available at `http://localhost:4202`

### Build

Build the application for production:

```bash
npx nx build example-react
```

### Test

Run tests:

```bash
npx nx test example-react
```

### Lint

Run linting:

```bash
npx nx lint example-react
```

## How It Works

This example uses React custom hooks and RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API using the `useSerialClient` hook.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `useSerialClient` hook which internally uses `createSerialClient()` to create a client instance.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as React state.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array` through the hook's `send` method.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea. The received data is managed as React state in the hook.

## Code Structure

- `src/main.tsx`: Application entry point (React 18 createRoot API)
- `src/App.tsx`: Main application component using the `useSerialClient` hook
- `src/hooks/useSerialClient.ts`: Custom hook for serial port communication
- `src/hooks/useSerialClient.test.ts`: Tests for the custom hook
- `src/App.test.tsx`: Tests for the App component
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration with React plugin
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration with JSX support

## Example Usage in Code

### Using the Custom Hook

```typescript
import { useSerialClient } from './hooks/useSerialClient';

function MyComponent() {
  const {
    browserSupported,
    connectionState,
    receivedData,
    connect,
    disconnect,
    send,
    clearReceivedData,
  } = useSerialClient(9600);

  const handleConnect = async () => {
    try {
      await connect();
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

  return (
    <div>
      {browserSupported && (
        <button onClick={handleConnect} disabled={connectionState.connected}>
          Connect
        </button>
      )}
      {connectionState.connected && (
        <button onClick={handleSend}>Send Data</button>
      )}
      <textarea value={receivedData} readOnly />
    </div>
  );
}
```

### Direct API Usage (Inside Custom Hook)

```typescript
import {
  createSerialClient,
  SerialClient,
} from '@web-serial-rxjs/web-serial-rxjs';
import { useEffect, useRef, useState } from 'react';

function useSerialClient(baudRate = 9600) {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<SerialClient | null>(null);

  useEffect(() => {
    clientRef.current = createSerialClient({ baudRate });

    return () => {
      if (clientRef.current?.connected) {
        clientRef.current.disconnect().subscribe();
      }
    };
  }, [baudRate]);

  const connect = async () => {
    return new Promise<void>((resolve, reject) => {
      clientRef.current?.connect().subscribe({
        next: () => {
          setConnected(true);
          resolve();
        },
        error: reject,
      });
    });
  };

  return { connected, connect };
}
```

## React and TypeScript Features

This example demonstrates React and TypeScript best practices:

- **React 18**: Uses the modern `createRoot` API for rendering
- **Custom Hooks**: Encapsulates serial port logic in a reusable hook
- **Type Safety**: Full TypeScript type safety with strict mode enabled
- **State Management**: Uses React hooks (`useState`, `useEffect`, `useRef`) for state management
- **RxJS Integration**: Properly manages RxJS Observable subscriptions with cleanup
- **Error Handling**: Errors are properly typed and handled with try-catch blocks
- **Testing**: Uses React Testing Library for component and hook testing

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

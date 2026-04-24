# Vue Example

This is a Vue example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Vue 3 Composition API and Composable functions to encapsulate serial port communication logic.

## Features

- Browser support detection
- Serial port connection/disconnection
- Configuration options (baud rate)
- Send data to serial port
- Receive data from serial port
- Real-time data display
- Vue Composition API Composable functions for state management
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
pnpm exec nx serve example-vue
```

The application will be available at `http://localhost:4250`

### Build

Build the application for production:

```bash
pnpm exec nx build example-vue
```

### Test

Run tests:

```bash
pnpm exec nx test example-vue
```

### Lint

Run linting:

```bash
pnpm exec nx lint example-vue
```

## How It Works

This example uses Vue 3 Composition API and RxJS observables to handle serial port communication reactively:

1. **Browser Support Check**: On initialization, the app checks if the browser supports the Web Serial API using the `useSerialClient` composable.

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `useSerialClient` composable, which internally wraps a v2 `SerialSession` created via `createSerialSession()`.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as Vue reactive state using `ref`.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array` through the composable's `send` method.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea. The received data is managed as Vue reactive state in the composable.

## Code Structure

- `src/main.ts`: Application entry point (Vue 3 createApp API)
- `src/app/App.vue`: Main application component using the `useSerialClient` composable
- `src/composables/useSerialClient.ts`: Composable function for serial port communication
- `src/composables/useSerialClient.test.ts`: Tests for the composable function
- `src/app/App.test.ts`: Tests for the App component
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.mts`: Vite configuration with Vue plugin
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration

## Example Usage in Code

### Using the Composable Function

```vue
<script setup lang="ts">
import { useSerialClient } from './composables/useSerialClient';

const {
  browserSupported,
  state,
  receivedData,
  errorMessage,
  connect$,
  send$,
  clearReceivedData,
} = useSerialClient(9600);

const handleConnect = () => {
  connect$().subscribe({
    error: (error) => console.error('Connection error:', error),
  });
};

const handleSend = () => {
  send$('Hello, Serial!\n').subscribe({
    error: (error) => console.error('Send error:', error),
  });
};
</script>

<template>
  <div>
    <p v-if="!browserSupported">Web Serial API is not supported.</p>
    <button
      v-if="browserSupported"
      :disabled="state === 'connected' || state === 'connecting'"
      @click="handleConnect"
    >
      Connect
    </button>
    <button
      v-if="state === 'connected'"
      @click="handleSend"
    >
      Send Data
    </button>
    <p>State: {{ state }}</p>
    <p v-if="errorMessage">Error: {{ errorMessage }}</p>
    <textarea :value="receivedData" readonly />
  </div>
</template>
```

### Direct API Usage (Inside Composable Function)

```typescript
import {
  createSerialSession,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap } from 'rxjs';
import { onUnmounted, ref } from 'vue';

export function useSerialClient(initialBaudRate = 9600) {
  const sessions$ = new ReplaySubject<SerialSession>(1);
  let current: SerialSession = createSerialSession({ baudRate: initialBaudRate });
  sessions$.next(current);

  const state = ref<SerialSessionState>('idle');
  const receivedData = ref('');

  const stateSub = sessions$
    .pipe(switchMap((s) => s.state$))
    .subscribe((next) => (state.value = next));
  const receiveSub = sessions$
    .pipe(switchMap((s) => s.receive$))
    .subscribe((chunk) => (receivedData.value += chunk));

  const connect$ = (baudRate?: number): Observable<void> => {
    if (baudRate !== undefined) {
      current = createSerialSession({ baudRate });
      sessions$.next(current);
    }
    return current.connect$();
  };

  onUnmounted(() => {
    stateSub.unsubscribe();
    receiveSub.unsubscribe();
    current.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
  });

  return { state, receivedData, connect$ };
}
```

## Vue and TypeScript Features

This example demonstrates Vue 3 and TypeScript best practices:

- **Vue 3**: Uses the modern Composition API with `<script setup>` syntax
- **Composable Functions**: Encapsulates serial port logic in a reusable composable function
- **Type Safety**: Full TypeScript type safety with strict mode enabled
- **Reactive State**: Uses Vue's `ref` and `reactive` for reactive state management
- **Lifecycle Hooks**: Uses `onMounted` and `onUnmounted` for lifecycle management
- **RxJS Integration**: Properly manages RxJS Observable subscriptions with cleanup in `onUnmounted`
- **Error Handling**: Errors are properly typed and handled with try-catch blocks
- **Testing**: Uses Vue Test Utils for component and composable testing

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

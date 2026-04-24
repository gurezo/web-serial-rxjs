# Svelte Example

This is a Svelte example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with the v2 `SerialSession` API to interact with serial ports through the Web Serial API. The example exposes a thin Svelte helper (`useSerialSession`) that mirrors the React hook, the Vue composable, and the Angular service: it just wraps the library's `state$` / `receive$` / `errors$` streams into Svelte `readable` stores without reconstructing any connection state of its own.

## Features

- Browser support detection (`session.isBrowserSupported()`)
- Reactive session lifecycle driven by `state$` (`idle | connecting | connected | disconnecting | unsupported | error`)
- Configuration option (baud rate)
- Send data to the serial port through the library-owned FIFO send queue
- Receive decoded text from the read pump
- Unified error channel via `errors$`
- Full TypeScript type safety

## Completion criteria (Issue #209)

- The Svelte example is composed of `readable` stores only — no `writable` BehaviorSubject reassembly, no read-loop management, no `state.kind` remapping.
- `App.svelte` drives its UI purely from the store subscriptions returned by `useSerialSession` via `$store` syntax.
- No imperative Web Serial plumbing (open / read / write / close) lives in the app.

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
pnpm exec nx serve example-svelte
```

The application will be available at `http://localhost:4220`.

### Build

```bash
pnpm exec nx build example-svelte
```

### Test

```bash
pnpm exec nx test example-svelte
```

### Lint

```bash
pnpm exec nx lint example-svelte
```

## How It Works

The example uses the v2 `SerialSession` API directly:

1. **Browser support check**: `useSerialSession` calls `session.isBrowserSupported()` once at creation time and exposes the result as the `browserSupported` store.
2. **Connection**: Clicking "接続" invokes `connect$(baudRate)`. When the baud rate changes between calls, the helper transparently creates a new `SerialSession` so subsequent streams reflect the new port configuration.
3. **State UI**: The helper subscribes to `session.state$` and mirrors it into a `readable<SerialSessionState>` store. `App.svelte` branches on the string union (`connecting`, `connected`, `disconnecting`, …) through the `$state` auto-subscription, without maintaining its own boolean flags.
4. **Sending**: Calling `send$(data)` enqueues the payload through the library's internal FIFO send queue, preserving call order regardless of how many concurrent subscribers run.
5. **Receiving**: `session.receive$` is driven by the library's internal read pump, which is started eagerly in `connect$` — the helper simply appends each chunk to the `receivedData` store.
6. **Errors**: All connect/read/write/close failures are multiplexed through `session.errors$` and surfaced as the `errorMessage` store. No per-call try/catch wrappers are needed.

## Code Structure

- `src/main.ts`: Application entry point
- `src/App.svelte`: Main component; renders UI from the `useSerialSession` stores
- `src/stores/useSerialSession.ts`: Svelte helper wrapping `createSerialSession`
- `src/stores/useSerialSession.test.ts`: Store unit tests (Vitest)
- `src/App.test.ts`: Smoke test for the component
- `src/styles.css`: Styling
- `src/test-setup.ts`: Test environment setup
- `index.html`: HTML structure
- `vite.config.ts`: Vite configuration with the Svelte plugin
- `svelte.config.js`: Svelte configuration
- `project.json`: Nx project configuration
- `tsconfig.json`: TypeScript configuration

## Example Usage in Code

### Using the Svelte helper

```svelte
<script lang="ts">
  import { useSerialSession } from './stores/useSerialSession';

  const {
    browserSupported,
    state,
    receivedData,
    errorMessage,
    connect$,
    disconnect$,
    send$,
    clearReceivedData,
  } = useSerialSession(9600);

  $: connected = $state === 'connected';

  const handleConnect = () => connect$(9600).subscribe();
  const handleDisconnect = () => disconnect$().subscribe();
  const handleSend = () => send$('Hello, Serial!\n').subscribe();
</script>

{#if !$browserSupported}
  <p>Web Serial API is not supported.</p>
{/if}
{#if $errorMessage}
  <p role="alert">Error: {$errorMessage}</p>
{/if}

<button on:click={handleConnect} disabled={connected}>Connect</button>
<button on:click={handleDisconnect} disabled={!connected}>Disconnect</button>
<button on:click={handleSend} disabled={!connected}>Send</button>

<textarea value={$receivedData} readonly />
<button on:click={clearReceivedData}>Clear</button>
```

### The helper at a glance

```typescript
import {
  createSerialSession,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { ReplaySubject, Subscription, switchMap } from 'rxjs';
import { onDestroy } from 'svelte';
import { readable } from 'svelte/store';

export function useSerialSession(initialBaudRate = 9600) {
  let currentSession: SerialSession = createSerialSession({
    baudRate: initialBaudRate,
  });
  const sessions$ = new ReplaySubject<SerialSession>(1);
  sessions$.next(currentSession);

  const state = readable<SerialSessionState>('idle', (set) => {
    const sub = sessions$.pipe(switchMap((s) => s.state$)).subscribe(set);
    return () => sub.unsubscribe();
  });

  // ...receivedData / errorMessage / browserSupported stores
  // ...connect$ / disconnect$ / send$ / clearReceivedData

  onDestroy(() => {
    currentSession.disconnect$().subscribe({ error: () => void 0 });
    sessions$.complete();
  });
}
```

## Svelte and TypeScript Features

- **Svelte 5**: Uses the latest Svelte version.
- **Stores**: `readable` stores are derived directly from the library's Observables — no `writable` re-composition.
- **Type safety**: Full TypeScript strict mode using library-provided types (`SerialSession`, `SerialSessionState`, `SerialError`).
- **RxJS integration**: Observable subscriptions are created lazily inside `readable` start/stop callbacks and torn down on `onDestroy`.
- **Testing**: Vitest with `BehaviorSubject` / `Subject` mocks of `createSerialSession` for deterministic state streams.

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

# Advanced Usage

## Reactive Receive Patterns

Use `text$` and `lines$` directly without manual decoding:

```typescript
import { bufferTime, filter } from 'rxjs/operators';

client
  .lines$
  .pipe(
    filter((line) => line.trim().length > 0),
    bufferTime(1000), // Collect lines for 1 second
  )
  .subscribe({
    next: (lines) => {
      console.log('Buffered lines:', lines);
    },
  });
```

## Ordered Command Execution

`send$` and `command$` are serialized internally, so concurrent calls are processed in order:

```typescript
import { from } from 'rxjs';
import { concatMap } from 'rxjs/operators';

const commands = ['help', 'status', 'version'];

from(commands)
  .pipe(concatMap((command) => client.command$(command)))
  .subscribe({
    next: ({ stdout }) => {
      console.log('Command output:', stdout);
    },
    error: (error) => {
      console.error('Command failed:', error);
    },
  });
```

## Request/Response Transactions

`transact$` wraps custom request/response parsing in one operation:

```typescript
client
  .transact$({
    payload: 'read-temp',
    prompt: /device>\s$/,
    timeout: 5000,
    collect: (stdout) => {
      const match = stdout.match(/TEMP:\s*([0-9.]+)/);
      if (!match) {
        throw new Error('Temperature field was not found');
      }
      return Number.parseFloat(match[1]);
    },
  })
  .subscribe({
    next: (temperature) => {
      console.log('Temperature:', temperature);
    },
    error: (error) => {
      console.error('Transaction failed:', error);
    },
  });
```

## State and Error Streams

Use `state$` and `errors$` to keep UI/state machines simple:

```typescript
client.state$.subscribe((state) => {
  switch (state.kind) {
    case 'connecting':
    case 'connected':
    case 'disconnecting':
      console.log('State:', state.kind);
      break;
    case 'unsupported':
      console.warn('Unsupported browser:', state.support.reason);
      break;
    case 'error':
      console.error('Serial state error:', state.error.message);
      break;
    default:
      console.log('State:', state.kind);
  }
});

client.errors$.subscribe((error) => {
  console.error('Serial error stream:', error.code, error.message);
});
```

## Port Filters

Use filters when you need to narrow selectable ports:

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

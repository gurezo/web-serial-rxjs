# Advanced Usage

## Observable Patterns

You can use RxJS operators to process serial data:

```typescript
import { map, filter, bufferTime } from 'rxjs/operators';

client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    filter((text) => text.trim().length > 0),
    bufferTime(1000), // Buffer messages for 1 second
  )
  .subscribe({
    next: (messages) => {
      console.log('Buffered messages:', messages);
    },
  });
```

## Stream Processing

Process data streams with RxJS operators:

```typescript
import { map, scan, debounceTime } from 'rxjs/operators';

// Accumulate received data
client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    scan((acc, current) => acc + current, ''),
    debounceTime(500),
  )
  .subscribe({
    next: (accumulated) => {
      console.log('Accumulated data:', accumulated);
    },
  });
```

## Custom Filters

Use port filters to limit available ports:

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

## Error Recovery

Implement error recovery patterns:

```typescript
import { retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

client
  .getReadStream()
  .pipe(
    retry({
      count: 3,
      delay: 1000,
    }),
    catchError((error) => {
      console.error('Failed after retries:', error);
      return of(null); // Return empty observable
    }),
  )
  .subscribe({
    next: (data) => {
      if (data) {
        console.log('Received:', data);
      }
    },
  });
```

## Related Documentation

- [Quick Start Guide](./QUICK_START.md) - Get started with basic examples
- [API Reference](./API_REFERENCE.md) - Detailed API documentation

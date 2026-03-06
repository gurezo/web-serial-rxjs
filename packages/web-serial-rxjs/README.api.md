# web-serial-rxjs

<p align="center">
  <img src="assets/images/web-serial-rxjs-icon.png" alt="web-serial-rxjs project icon" width="128" />
</p>

A TypeScript library that provides a reactive RxJS-based wrapper for the Web Serial API,
enabling easy serial port communication in web applications.

## Features

- **RxJS-based reactive API**: Leverage the power of RxJS Observables for reactive serial port communication
- **TypeScript support**: Full TypeScript type definitions included
- **Browser detection**: Built-in browser support detection and error handling
- **Error handling**: Comprehensive error handling with custom error classes and error codes
- **Framework agnostic**: Works with any JavaScript/TypeScript framework or vanilla JavaScript

## Browser Support

The Web Serial API is currently only supported in Chromium-based browsers:

- Chrome 89+
- Edge 89+
- Opera 75+

## Example

```typescript
import { createSerialClient, isBrowserSupported } from '@gurezo/web-serial-rxjs';

// Check browser support
if (!isBrowserSupported()) {
  console.error('Web Serial API is not supported in this browser');
  return;
}

// Create a serial client
const client = createSerialClient({ baudRate: 9600 });

// Connect to a serial port
client.connect().subscribe({
  next: () => console.log('Connected!'),
  error: (error) => console.error('Connection error:', error),
});
```

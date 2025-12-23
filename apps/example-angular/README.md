# Angular Example

This is an Angular example application demonstrating how to use the `@web-serial-rxjs/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Angular Services to encapsulate serial port communication logic.

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

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `SerialClientService` which internally uses `createSerialClient()` to create a client instance.

3. **Configuration**: Users can select the baud rate before connecting. The baud rate is managed as component property.

4. **Data Sending**: Users can type text in the input field and send it to the serial port. The text is encoded as UTF-8 and sent as `Uint8Array` through the service's `sendAsync` method.

5. **Data Receiving**: Data received from the serial port is decoded as UTF-8 and displayed in real-time in the textarea. The received data is managed as an Observable in the service.

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

## Example Usage in Code

### Using the Service

```typescript
import { Component } from '@angular/core';
import { SerialClientService } from './services/serial-client.service';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class AppComponent {
  connectionState$: Observable<SerialConnectionState>;
  receivedData$: Observable<string>;

  constructor(private serialService: SerialClientService) {
    this.connectionState$ = this.serialService.connectionState;
    this.receivedData$ = this.serialService.receivedData;
  }

  async connect() {
    try {
      await this.serialService.connectAsync(9600);
    } catch (error) {
      console.error('Connection error:', error);
    }
  }

  async send(data: string) {
    try {
      await this.serialService.sendAsync(data);
    } catch (error) {
      console.error('Send error:', error);
    }
  }
}
```

### Using in Template

```html
<button
  [disabled]="!getConnected(connectionState$ | async)"
  (click)="connect()"
>
  Connect
</button>

<div *ngIf="connectionState$ | async as state">
  <p>Connected: {{ state.connected }}</p>
</div>

<textarea [value]="receivedData$ | async" readonly></textarea>
```

### Direct API Usage (Inside Service)

```typescript
import { Injectable } from '@angular/core';
import {
  createSerialClient,
  SerialClient,
} from '@web-serial-rxjs/web-serial-rxjs';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SerialClientService {
  private client: SerialClient | null = null;
  private connectionState$ = new BehaviorSubject<SerialConnectionState>({
    connected: false,
    connecting: false,
    disconnecting: false,
    error: null,
  });

  connect(baudRate?: number): Observable<void> {
    if (!this.client) {
      this.client = createSerialClient({ baudRate: baudRate || 9600 });
    }

    return new Observable<void>((observer) => {
      this.client?.connect().subscribe({
        next: () => {
          this.connectionState$.next({
            connected: true,
            connecting: false,
            disconnecting: false,
            error: null,
          });
          observer.next();
          observer.complete();
        },
        error: (error) => {
          this.connectionState$.next({
            connected: false,
            connecting: false,
            disconnecting: false,
            error: error.message,
          });
          observer.error(error);
        },
      });
    });
  }
}
```

## Angular and TypeScript Features

This example demonstrates Angular and TypeScript best practices:

- **Angular Standalone Components**: Uses standalone components (no NgModules)
- **Services**: Encapsulates serial port logic in a reusable service with `@Injectable({ providedIn: 'root' })`
- **RxJS Observables**: Uses BehaviorSubject and Observables for reactive state management
- **Type Safety**: Full TypeScript type safety with strict mode enabled
- **Async/Await**: Provides async helper methods for easier usage in components
- **Error Handling**: Errors are properly typed and handled with try-catch blocks
- **Testing**: Uses Angular TestBed for service testing

## Browser Compatibility

This example requires a browser that supports the Web Serial API:

- Chrome 89+
- Edge 89+
- Opera 75+
- Chrome Android 89+

Safari and Firefox do not currently support the Web Serial API.

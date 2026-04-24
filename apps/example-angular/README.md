# Angular Example

This is an Angular example application demonstrating how to use the `@gurezo/web-serial-rxjs` library with RxJS to interact with serial ports through the Web Serial API. This example uses Angular Services to encapsulate serial port communication logic.

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

2. **Connection**: Users can connect to a serial port by clicking the "接続" (Connect) button. The app uses the `SerialClientService`, which internally wraps a v2 `SerialSession` created via `createSerialSession()`.

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
import type { SerialSessionState } from '@gurezo/web-serial-rxjs';
import { Observable } from 'rxjs';
import { SerialClientService } from './services/serial-client.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
})
export class AppComponent {
  readonly state$: Observable<SerialSessionState>;
  readonly receivedData$: Observable<string>;

  constructor(private readonly serialService: SerialClientService) {
    this.state$ = this.serialService.state$;
    this.receivedData$ = this.serialService.receive$;
  }

  connect(): void {
    this.serialService.connect$(9600).subscribe({
      error: (error) => console.error('Connection error:', error),
    });
  }

  send(data: string): void {
    this.serialService.send$(data).subscribe({
      error: (error) => console.error('Send error:', error),
    });
  }
}
```

### Using in Template

```html
<button
  [disabled]="(state$ | async) === 'connected'"
  (click)="connect()"
>
  Connect
</button>

<p>State: {{ state$ | async }}</p>

<textarea [value]="receivedData$ | async" readonly></textarea>
```

### Direct API Usage (Inside Service)

```typescript
import { Injectable, OnDestroy } from '@angular/core';
import {
  createSerialSession,
  SerialError,
  SerialSession,
  SerialSessionState,
} from '@gurezo/web-serial-rxjs';
import { Observable, ReplaySubject, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SerialClientService implements OnDestroy {
  private readonly sessions$ = new ReplaySubject<SerialSession>(1);
  private currentSession: SerialSession = createSerialSession({
    baudRate: 9600,
  });

  readonly state$: Observable<SerialSessionState>;
  readonly receive$: Observable<string>;
  readonly errors$: Observable<SerialError>;

  constructor() {
    this.sessions$.next(this.currentSession);
    this.state$ = this.sessions$.pipe(switchMap((s) => s.state$));
    this.receive$ = this.sessions$.pipe(switchMap((s) => s.receive$));
    this.errors$ = this.sessions$.pipe(switchMap((s) => s.errors$));
  }

  ngOnDestroy(): void {
    this.currentSession.disconnect$().subscribe({ error: () => void 0 });
    this.sessions$.complete();
  }

  connect$(baudRate: number): Observable<void> {
    this.currentSession = createSerialSession({ baudRate });
    this.sessions$.next(this.currentSession);
    return this.currentSession.connect$();
  }

  send$(data: string | Uint8Array): Observable<void> {
    return this.currentSession.send$(data);
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

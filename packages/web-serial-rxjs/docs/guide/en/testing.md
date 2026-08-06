# Hardware-free testing with a Fake SerialSession

USB serial hardware is inconvenient for automated tests: CI cannot attach devices, and failures such as permission denial, late receive, or sudden unplug are hard to reproduce on demand. This recipe shows how to test **application** code that depends on `SerialSession` without calling the Web Serial API.

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#537](https://github.com/gurezo/web-serial-rxjs/issues/537) · Contract: [Swappable public contract (Decision #536)](./concepts.md#swappable-public-contract-decision-536)

## Scope and packaging decision

| Item | Decision |
| --- | --- |
| Fake purpose | Drive the `SerialSession` surface (`state$`, `errors$`, `receive$`, `lines$`, `send$`, …) for app tests |
| Web Serial API | **Not** mocked or emulated |
| npm package | **Not included** — Fake is **not** an export of `@gurezo/web-serial-rxjs` |
| How to use | Copy the helper below into your test tree, or keep an equivalent local Fake |
| Repo reference | [`tests/helpers/fake-serial-session.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/fake-serial-session.ts) (CI examples only; not published) |

A future `@gurezo/web-serial-rxjs/testing` entry may be considered if shared helpers across [Request / Response](./request-response.md) and timeout recipes (#539) prove worth maintaining. Until then, keep the public surface small.

## Dependency injection pattern

Type application code against `SerialSession`. Create `createSerialSession()` only at composition roots. In tests, pass `fake.session` instead.

```typescript
import {
  createSerialSession,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';

// App layer: depend on SerialSession only
function createSerialUi(session: SerialSession) {
  return session.state$.subscribe((state) => {
    // update UI from state.status
  });
}

// Production boundary
createSerialUi(createSerialSession({ baudRate: 115200 }));

// Test boundary
// createSerialUi(fake.session);
```

## Controllable Fake helper (copy-paste)

```typescript
import {
  BehaviorSubject,
  Observable,
  Subject,
  defer,
  of,
  throwError,
} from 'rxjs';
import {
  SerialError,
  SerialErrorCode,
  SerialSessionStatus,
  type SerialPayload,
  type SerialSession,
  type SerialSessionState,
} from '@gurezo/web-serial-rxjs';

const DEFAULT_PORT_INFO: SerialPortInfo = {
  usbVendorId: 0x1234,
  usbProductId: 0x5678,
};

export type FakeSerialSessionHandle = {
  session: SerialSession;
  readonly sent: readonly SerialPayload[];
  setState(state: SerialSessionState): void;
  emitReceive(chunk: string): void;
  emitLine(line: string): void;
  emitError(error: SerialError): void;
  failNextConnect(error?: SerialError): void;
  failNextSend(error?: SerialError): void;
  simulateDeviceDisconnect(error?: SerialError): void;
};

export function createFakeSerialSession(): FakeSerialSessionHandle {
  const stateSubject = new BehaviorSubject<SerialSessionState>({
    status: SerialSessionStatus.Idle,
  });
  const errorsSubject = new Subject<SerialError>();
  const receiveSubject = new Subject<string>();
  const linesSubject = new Subject<string>();
  const terminalTextSubject = new BehaviorSubject<string>('');

  const sent: SerialPayload[] = [];
  let nextConnectError: SerialError | undefined;
  let nextSendError: SerialError | undefined;

  const session: SerialSession = {
    state$: stateSubject.asObservable(),
    errors$: errorsSubject.asObservable(),
    receive$: receiveSubject.asObservable(),
    lines$: linesSubject.asObservable(),
    terminalText$: terminalTextSubject.asObservable(),

    connect$: (): Observable<void> =>
      defer(() => {
        if (nextConnectError !== undefined) {
          const error = nextConnectError;
          nextConnectError = undefined;
          stateSubject.next({ status: SerialSessionStatus.Connecting });
          stateSubject.next({ status: SerialSessionStatus.Idle });
          errorsSubject.next(error);
          return throwError(() => error);
        }
        stateSubject.next({ status: SerialSessionStatus.Connecting });
        stateSubject.next({
          status: SerialSessionStatus.Connected,
          portInfo: DEFAULT_PORT_INFO,
        });
        return of(undefined);
      }),

    disconnect$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disconnecting });
        stateSubject.next({ status: SerialSessionStatus.Idle });
        return of(undefined);
      }),

    dispose$: (): Observable<void> =>
      defer(() => {
        stateSubject.next({ status: SerialSessionStatus.Disposed });
        return of(undefined);
      }),

    send$: (data: SerialPayload): Observable<void> =>
      defer(() => {
        sent.push(data);
        if (nextSendError !== undefined) {
          const error = nextSendError;
          nextSendError = undefined;
          errorsSubject.next(error);
          return throwError(() => error);
        }
        return of(undefined);
      }),
  };

  return {
    session,
    get sent() {
      return sent;
    },
    setState(state) {
      stateSubject.next(state);
    },
    emitReceive(chunk) {
      receiveSubject.next(chunk);
      terminalTextSubject.next(terminalTextSubject.value + chunk);
    },
    emitLine(line) {
      linesSubject.next(line);
    },
    emitError(error) {
      errorsSubject.next(error);
    },
    failNextConnect(
      error = new SerialError(
        SerialErrorCode.PORT_OPEN_FAILED,
        'Fake connect failed',
      ),
    ) {
      nextConnectError = error;
    },
    failNextSend(
      error = new SerialError(SerialErrorCode.WRITE_FAILED, 'Fake send failed'),
    ) {
      nextSendError = error;
    },
    simulateDeviceDisconnect(
      error = new SerialError(
        SerialErrorCode.CONNECTION_LOST,
        'Fake device disconnected',
      ),
    ) {
      stateSubject.next({ status: SerialSessionStatus.Idle });
      errorsSubject.next(error);
    },
  };
}
```

### Control API

| Method / field | Use it to |
| --- | --- |
| `session` | Inject into app code typed as `SerialSession` |
| `sent` | Assert payloads passed to `send$` |
| `setState` | Force an arbitrary lifecycle state |
| `emitReceive` / `emitLine` | Push chunks / lines (independent streams) |
| `emitError` | Push a `SerialError` on `errors$` |
| `failNextConnect` / `failNextSend` | Make the next `connect$` / `send$` fail |
| `simulateDeviceDisconnect` | Drop to `idle` and emit `CONNECTION_LOST` (by default) |

## Framework-agnostic Vitest examples

```typescript
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { createFakeSerialSession } from './fake-serial-session';

describe('app serial flow (no hardware)', () => {
  it('connects', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.connect$());
    await expect(firstValueFrom(fake.session.state$)).resolves.toMatchObject({
      status: SerialSessionStatus.Connected,
    });
  });

  it('records send payloads', async () => {
    const fake = createFakeSerialSession();
    await firstValueFrom(fake.session.send$('AT\r\n'));
    expect(fake.sent).toEqual(['AT\r\n']);
  });

  it('feeds receive data into UI logic', async () => {
    const fake = createFakeSerialSession();
    const chunks: string[] = [];
    fake.session.receive$.subscribe((c) => chunks.push(c));
    fake.emitReceive('OK\r\n');
    expect(chunks).toEqual(['OK\r\n']);
  });
});
```

CI-runnable coverage of all Fake scenarios lives in the library repo:

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/fake-serial-session.test.ts
```

## Angular: inject `SerialSession`

```typescript
import { InjectionToken, Injectable, inject } from '@angular/core';
import { createSerialSession, type SerialSession } from '@gurezo/web-serial-rxjs';

export const SERIAL_SESSION = new InjectionToken<SerialSession>('SERIAL_SESSION');

export const serialSessionProvider = {
  provide: SERIAL_SESSION,
  useFactory: () => createSerialSession({ baudRate: 115200 }),
};

@Injectable()
export class SerialClientService {
  private readonly session = inject(SERIAL_SESSION);

  connect() {
    return this.session.connect$();
  }

  readonly state$ = this.session.state$;
}
```

Minimal Vitest-style test:

```typescript
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { SERIAL_SESSION, SerialClientService } from './serial-client.service';
import { createFakeSerialSession } from './fake-serial-session';

it('exposes connected state without hardware', async () => {
  const fake = createFakeSerialSession();
  TestBed.configureTestingModule({
    providers: [
      SerialClientService,
      { provide: SERIAL_SESSION, useValue: fake.session },
    ],
  });
  const service = TestBed.inject(SerialClientService);
  await firstValueFrom(service.connect());
  await expect(firstValueFrom(service.state$)).resolves.toMatchObject({
    status: SerialSessionStatus.Connected,
  });
});
```

## React: Context typed as `SerialSession`

```tsx
import { createContext, useContext, type ReactNode } from 'react';
import {
  createSerialSession,
  type SerialSession,
} from '@gurezo/web-serial-rxjs';

const SerialSessionContext = createContext<SerialSession | null>(null);

export function SerialSessionProvider({ children }: { children: ReactNode }) {
  // Prefer useRef/useState so the session is created once per mount
  const session = createSerialSession({ baudRate: 115200 });
  return (
    <SerialSessionContext.Provider value={session}>
      {children}
    </SerialSessionContext.Provider>
  );
}

export function useSerialSession(): SerialSession {
  const session = useContext(SerialSessionContext);
  if (!session) {
    throw new Error('SerialSessionProvider is required');
  }
  return session;
}
```

Minimal test (inject Fake via Provider):

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { firstValueFrom } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { createFakeSerialSession } from './fake-serial-session';
import { SerialSessionContext, useSerialSession } from './serial-session-context';

it('reads connected state from Fake', async () => {
  const fake = createFakeSerialSession();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SerialSessionContext.Provider value={fake.session}>
      {children}
    </SerialSessionContext.Provider>
  );
  const { result } = renderHook(() => useSerialSession(), { wrapper });
  await firstValueFrom(result.current.connect$());
  await waitFor(async () => {
    const state = await firstValueFrom(result.current.state$);
    expect(state.status).toBe(SerialSessionStatus.Connected);
  });
});
```

## Related

- [Swappable public contract](./concepts.md#swappable-public-contract-decision-536)
- [Advanced Usage](./advanced-usage.md) — compose RxJS on top of `receive$` / `send$`
- [Request / Response recipes](./request-response.md) — command + matching reply (#538)
- Follow-up: timeout / cancel / retry (#539)

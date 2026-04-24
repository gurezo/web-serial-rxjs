# Advanced Usage

The v2 `SerialSession` intentionally exposes a small surface. Most "advanced" workflows are expressed by composing plain RxJS operators over `receive$` and `send$`.

## Line Framing

`receive$` emits UTF-8 decoded chunks as they arrive from the underlying `TextDecoder`. Combine it with `scan` to frame by newline:

```typescript
import { filter, map, scan } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
session.connect$().subscribe();

const lines$ = session.receive$.pipe(
  scan(
    (acc, chunk) => {
      const combined = acc.buffer + chunk;
      const parts = combined.split('\n');
      return { buffer: parts.pop() ?? '', lines: parts };
    },
    { buffer: '', lines: [] as string[] },
  ),
  filter((s) => s.lines.length > 0),
  map((s) => s.lines),
);

lines$.subscribe((lines) => lines.forEach((line) => console.log('line:', line)));
```

## Ordered Writes

`send$` is already serialised by an internal FIFO queue, so concurrent subscribers are delivered in call order:

```typescript
import { from, concatMap } from 'rxjs';

const commands = ['help\n', 'status\n', 'version\n'];
from(commands)
  .pipe(concatMap((cmd) => session.send$(cmd)))
  .subscribe({
    error: (error) => console.error('Command failed:', error),
  });
```

If you need one-shot request / response pairs, compose `send$` with a bounded read of `receive$`:

```typescript
import { firstValueFrom, scan, filter, map, timeout } from 'rxjs';

async function query(cmd: string, prompt = /device>\s$/): Promise<string> {
  const response$ = session.receive$.pipe(
    scan((buffer, chunk) => buffer + chunk, ''),
    filter((buffer) => prompt.test(buffer)),
    map((buffer) => buffer),
    timeout(5000),
  );
  await firstValueFrom(session.send$(cmd));
  return firstValueFrom(response$);
}
```

## State-Driven UI

Drive every UI transition from `state$` rather than tracking a boolean:

```typescript
session.state$.subscribe((state) => {
  switch (state) {
    case 'idle':
      showConnectButton();
      break;
    case 'connecting':
    case 'disconnecting':
      showSpinner();
      break;
    case 'connected':
      showSendUi();
      break;
    case 'error':
      showErrorBanner();
      break;
    case 'unsupported':
      showUnsupportedBanner();
      break;
  }
});
```

## Unified Error Handling

`errors$` is the primary error channel; `connect$().subscribe({ error })` receives the same `SerialError` instance.

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.code === SerialErrorCode.READ_FAILED) {
    // fatal — session is already in 'error' and the port is torn down
    session.disconnect$().subscribe();
  }
});
```

## Reconnect On Fatal Error

Because fatal failures drive `state$` to `'error'`, a reconnect policy is straightforward:

```typescript
import { filter, concatMap } from 'rxjs';

session.state$
  .pipe(
    filter((state) => state === 'error'),
    concatMap(() => session.disconnect$()),
    concatMap(() => session.connect$()),
  )
  .subscribe({
    error: (error) => console.error('Reconnect failed:', error),
  });
```

## Framework Integration

Each example application in this repository demonstrates one idiomatic integration:

- Angular: thin service that exposes `state$` / `receive$` / `errors$` through `switchMap` over a `ReplaySubject<SerialSession>`
- Vue 3: composable that mirrors the same streams into `ref`s
- React: hook that stores the session in a `ref` and mirrors the streams into `useState`
- Svelte: store that wraps the session with `derived` stores
- Vanilla JS/TS: direct subscriptions

# Request / Response recipes

Serial devices often expect a **command**, then a **matching reply** (a line, a prompt, or a terminator). This recipe shows how to build that flow with plain RxJS on top of `SerialSession` — **without** adding a core `request$()` API.

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#538](https://github.com/gurezo/web-serial-rxjs/issues/538) · Related: [Hardware-free testing](./testing.md) · Follow-up: timeout / cancel / retry ([#539](https://github.com/gurezo/web-serial-rxjs/issues/539))

## Scope decision

| Item | Decision |
| --- | --- |
| Core API | **No** dedicated `request$()` (compose RxJS yourself) |
| npm package | Helpers below are **not** published exports |
| How to use | Copy the patterns into your app, or keep a local helper |
| Repo reference | [`tests/helpers/request-response-recipes.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/request-response-recipes.ts) (CI examples only) |

RxJS composition is enough for common command/reply protocols. A future core helper would only be justified if many apps need the same correlation / framing rules.

## Choose `lines$` or `receive$`

| Stream | Use when |
| --- | --- |
| `lines$` | Newline-delimited replies (`OK`, status lines, parsers) |
| `receive$` | Prompts / terminators **without** a trailing newline, terminals, `\r` redraws |

## Critical ordering: wait, then send

`lines$` and `receive$` are **hot** and do not replay past emissions. If the device replies immediately, **start the wait subscription before `send$`**.

```typescript
import { filter, firstValueFrom, take, timeout } from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function requestOk(session: SerialSession, cmd: string): Promise<string> {
  const waitForOk$ = session.lines$.pipe(
    filter((line) => line === 'OK'),
    take(1),
    timeout({ first: 3000 }),
  );

  // 1) Start waiting (subscription via firstValueFrom)
  const replyPromise = firstValueFrom(waitForOk$);
  // 2) Then send
  await firstValueFrom(session.send$(cmd));
  return replyPromise;
}
```

Sending first and waiting afterward can miss a fast reply.

## Line-oriented patterns (`lines$`)

### Exact line, substring, RegExp

```typescript
import { filter, take, timeout } from 'rxjs';

// Exact
const waitExact$ = session.lines$.pipe(
  filter((line) => line === 'OK'),
  take(1),
  timeout({ first: 3000 }),
);

// Substring
const waitContains$ = session.lines$.pipe(
  filter((line) => line.includes('ready')),
  take(1),
  timeout({ first: 3000 }),
);

// RegExp
const waitRegex$ = session.lines$.pipe(
  filter((line) => /^VERSION=\d+$/.test(line)),
  take(1),
  timeout({ first: 3000 }),
);
```

`take(1)` completes the subscription after the first match — no leftover listeners.

### Copy-paste helper: `requestLine$`

```typescript
import {
  Observable,
  filter,
  take,
  timeout,
} from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';
import type { SerialPayload } from '@gurezo/web-serial-rxjs';

type LineMatcher = string | RegExp | ((line: string) => boolean);

function matchesLine(matcher: LineMatcher, line: string): boolean {
  if (typeof matcher === 'function') return matcher(line);
  if (typeof matcher === 'string') return line === matcher;
  return matcher.test(line);
}

function waitForLine$(
  session: SerialSession,
  matcher: LineMatcher,
  timeoutMs = 3000,
): Observable<string> {
  return session.lines$.pipe(
    filter((line) => matchesLine(matcher, line)),
    take(1),
    timeout({ first: timeoutMs }),
  );
}

function requestLine$(
  session: SerialSession,
  payload: SerialPayload,
  matcher: LineMatcher,
  timeoutMs = 3000,
): Observable<string> {
  return new Observable<string>((subscriber) => {
    const waitSub = waitForLine$(session, matcher, timeoutMs).subscribe({
      next: (value) => {
        subscriber.next(value);
        subscriber.complete();
      },
      error: (error) => subscriber.error(error),
    });

    const sendSub = session.send$(payload).subscribe({
      error: (error) => {
        waitSub.unsubscribe();
        subscriber.error(error);
      },
    });

    return () => {
      waitSub.unsubscribe();
      sendSub.unsubscribe();
    };
  });
}
```

## Chunk / prompt patterns (`receive$`)

Accumulate chunks until a prompt or terminator appears:

```typescript
import { filter, scan, take, timeout } from 'rxjs';

const waitPrompt$ = session.receive$.pipe(
  scan((buffer, chunk) => buffer + chunk, ''),
  filter((buffer) => /device>\s*$/.test(buffer)),
  take(1),
  timeout({ first: 5000 }),
);
```

Same wait-then-send rule as `lines$`. See also [Advanced Usage – readUntil](./advanced-usage.md#readuntil-pattern-readuntil--prompt-style-reads).

## Send failure vs response timeout

| Failure | Type | Typical cause |
| --- | --- | --- |
| Write / `send$` | `SerialError` | Port closed, write failed |
| No matching reply | RxJS `TimeoutError` | Device silent or matcher wrong |

```typescript
import { TimeoutError, firstValueFrom } from 'rxjs';
import { SerialError } from '@gurezo/web-serial-rxjs';

try {
  await firstValueFrom(requestLine$(session, 'AT\r\n', 'OK'));
} catch (error) {
  if (error instanceof SerialError) {
    // send failed — do not treat as "device did not answer"
  } else if (error instanceof TimeoutError) {
    // waited, but no matching line
  } else {
    throw error;
  }
}
```

Cancel / retry / backoff policies belong in [#539](https://github.com/gurezo/web-serial-rxjs/issues/539).

## Serialize multiple commands: `concatMap` vs `switchMap`

Protocols **without** correlation IDs should run requests **one at a time**. Prefer `concatMap`. `switchMap` cancels the previous wait when a new command starts and can lose replies.

```typescript
import { concatMap, from } from 'rxjs';

from([
  { payload: 'CMD1\r\n', matcher: 'R1' },
  { payload: 'CMD2\r\n', matcher: 'R2' },
]).pipe(
  concatMap(({ payload, matcher }) =>
    requestLine$(session, payload, matcher),
  ),
);
```

If the same reply string can arrive as an unsolicited event, decide correlation in your app (sequence numbers, exclusive ownership of the port, etc.).

## Vitest coverage (no hardware)

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/request-response-recipes.test.ts
```

Drive replies with the Fake from [Hardware-free testing](./testing.md) (`emitLine` / `emitReceive` / `failNextSend`).

## Related

- [Advanced Usage](./advanced-usage.md) — line framing, `readUntil`, ordered writes
- [Hardware-free testing](./testing.md) — Fake `SerialSession`
- Follow-up: [#539](https://github.com/gurezo/web-serial-rxjs/issues/539) timeout / cancel / retry

# Timeout, cancel, and retry recipes

`connect$()`, `send$()`, and response waits often need **timeouts**, **cancellation**, and **bounded retries**. This recipe shows how to place those policies in **application code** with plain RxJS — **without** a core auto-reconnect or auto-retry API.

Parent: [#535](https://github.com/gurezo/web-serial-rxjs/issues/535) · Issue: [#539](https://github.com/gurezo/web-serial-rxjs/issues/539) · Related: [Request / Response](./request-response.md) · [Choosing receive$ / lines$ / terminalText$](./stream-selection.md) · [Hardware-free testing](./testing.md)

## Scope decision

| Item | Decision |
| --- | --- |
| Core API | **No** built-in auto-reconnect / auto-retry |
| npm package | Helpers below are **not** published exports |
| How to use | Copy the patterns into your app, or keep a local helper |
| Repo reference | [`tests/helpers/timeout-cancel-retry-recipes.ts`](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/tests/helpers/timeout-cancel-retry-recipes.ts) (CI examples only) |

Unconditional retry can re-open the port picker, treat user cancel as a failure worth looping, duplicate commands, run non-idempotent device actions more than once, or spin forever while USB is unplugged. Keep the policy in the app so you can decide per operation.

## Separate responsibilities

| Concern | Meaning | Typical RxJS tools |
| --- | --- | --- |
| **Timeout** | Stop waiting after a deadline | `timeout({ first })` |
| **Cancel** | Stop because the user or UI tore down work | `takeUntil(destroy$)`, unsubscribe |
| **Retry** | Attempt again after a failure — only when safe | `retry({ count, delay })` |

Do not collapse these into one “keep trying” loop. A cancelled port picker is not a transient network blip.

## Recommended policy by operation

| Operation | Recommended policy |
| --- | --- |
| Port picker | Start from a user gesture; do **not** auto-reopen on cancel |
| Connect failure | Manual retry or a **limited** count, depending on the cause |
| Read stopped | Distinguish device unplug from app teardown |
| Response timeout | Retry only after confirming the command is **idempotent** |
| Send failure | Decide in the app whether the same payload may be resent |
| After `dispose$` | **Do not** retry — create a new `SerialSession` |

## Connect timeout

```typescript
import { firstValueFrom, timeout } from 'rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function connectWithTimeout(
  session: SerialSession,
  timeoutMs = 10_000,
): Promise<void> {
  await firstValueFrom(session.connect$().pipe(timeout({ first: timeoutMs })));
}
```

`timeout` here bounds how long you wait for `connect$` to complete (including the browser port picker). It is **not** a library-level connection lease.

## Response-wait timeout

Prefer the wait-then-send patterns in [Request / Response](./request-response.md). Distinguish write failures (`SerialError`) from wait timeouts (RxJS `TimeoutError`):

```typescript
import { TimeoutError, firstValueFrom, filter, take, timeout } from 'rxjs';
import { SerialError } from '@gurezo/web-serial-rxjs';
import type { SerialSession } from '@gurezo/web-serial-rxjs';

async function requestOk(session: SerialSession, cmd: string): Promise<string> {
  const wait$ = session.lines$.pipe(
    filter((line) => line === 'OK'),
    take(1),
    timeout({ first: 3000 }),
  );
  const replyPromise = firstValueFrom(wait$);
  await firstValueFrom(session.send$(cmd));
  return replyPromise;
}

try {
  await requestOk(session, 'AT\r\n');
} catch (error) {
  if (error instanceof SerialError) {
    // send failed
  } else if (error instanceof TimeoutError) {
    // no matching reply in time
  } else {
    throw error;
  }
}
```

## Cancel with `takeUntil`

```typescript
import { Subject, takeUntil } from 'rxjs';

const destroy$ = new Subject<void>();

const sub = session.lines$
  .pipe(takeUntil(destroy$))
  .subscribe((line) => console.log(line));

// Later: user navigates away or presses Cancel
destroy$.next();
destroy$.complete();
// sub completes; no further lines are delivered
```

Cancellation should **complete** the pipeline (or unsubscribe), not feed into an infinite `retry`.

## Cancel on Component / Hook teardown

Framework-agnostic pattern: own a `destroy$` Subject and complete it in cleanup.

**React**

```typescript
import { useEffect, useRef } from 'react';
import { Subject, takeUntil } from 'rxjs';

function useSerialLines(session: SerialSession, onLine: (line: string) => void) {
  const destroyRef = useRef(new Subject<void>());

  useEffect(() => {
    const destroy$ = destroyRef.current;
    const sub = session.lines$.pipe(takeUntil(destroy$)).subscribe(onLine);
    return () => {
      destroy$.next();
      destroy$.complete();
      sub.unsubscribe();
    };
  }, [session, onLine]);
}
```

**Angular** (`DestroyRef` / `takeUntilDestroyed`)

```typescript
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const destroyRef = inject(DestroyRef);
session.lines$
  .pipe(takeUntilDestroyed(destroyRef))
  .subscribe((line) => console.log(line));
```

## What to retry — and what to avoid

| Safe to consider with a **limit** | Avoid automatic retry |
| --- | --- |
| Transient `PORT_OPEN_FAILED` after a previous disconnect | `OPERATION_CANCELLED` (user closed the picker) |
| Idempotent read-only queries after a response timeout | Non-idempotent commands (`MOTOR_START`, `WRITE_FLASH`, …) |
| Bounded reconnect after a fatal error (see below) | Anything after `dispose$` / `SESSION_DISPOSED` |
| | Infinite reconnect while the cable is unplugged |

```typescript
import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';

function shouldRetryConnect(error: unknown): boolean {
  if (
    error instanceof SerialError &&
    (error.is(SerialErrorCode.OPERATION_CANCELLED) ||
      error.is(SerialErrorCode.SESSION_DISPOSED))
  ) {
    return false;
  }
  if (
    error instanceof SerialError &&
    (error.is(SerialErrorCode.PORT_OPEN_FAILED) ||
      error.is(SerialErrorCode.CONNECTION_LOST))
  ) {
    return true;
  }
  return false;
}
```

## Limited retry (no infinite loop)

```typescript
import { retry, throwError, timeout, timer } from 'rxjs';

session
  .connect$()
  .pipe(
    timeout({ first: 10_000 }),
    retry({
      count: 2, // two retries after the first failure → at most 3 attempts
      delay: (error, retryCount) => {
        if (!shouldRetryConnect(error)) {
          return throwError(() => error);
        }
        return timer(200 * 2 ** (retryCount - 1)); // exponential backoff
      },
    }),
  )
  .subscribe({
    error: (error) => console.error('connect failed after limited retries', error),
  });
```

## Exponential backoff

`retryCount` in RxJS `retry({ delay })` is **1-based** for the first retry:

| Retry # | Delay with `base = 200` |
| --- | --- |
| 1 | 200 ms |
| 2 | 400 ms |
| 3 | 800 ms |

```typescript
const delayMs = baseDelayMs * 2 ** (retryCount - 1);
```

## Do not retry user cancel

When the user dismisses the port picker, Chromium surfaces a `DOMException` that this library maps to `SerialErrorCode.OPERATION_CANCELLED`. Treat it as intentional UI, not a flaky device:

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
    // Show idle UI — do not call connect$() again automatically
    return;
  }
});
```

## Do not reconnect after `disposed`

After `dispose$()`, the session is terminal. `connect$` / `send$` fail with `SESSION_DISPOSED`. Create a **new** `SerialSession` if you need another connection (for example after a baud-rate change).

```typescript
import { firstValueFrom, take } from 'rxjs';
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

async function reconnectIfAlive(session: SerialSession): Promise<void> {
  const state = await firstValueFrom(session.state$.pipe(take(1)));
  if (state.status === SerialSessionStatus.Disposed) {
    throw new Error('Session disposed — create a new SerialSession');
  }
  await firstValueFrom(session.connect$());
}
```

## Do not auto-resend non-idempotent commands

A write may have reached the device even when your wait timed out. Resending `MOTOR_START` or a flash write can duplicate side effects.

```typescript
// Prefer a single attempt + operator decision
session.send$('MOTOR_START\r\n').subscribe({
  error: (error) => {
    // Ask the user or inspect device state before sending again
    console.error(error);
  },
});

// Only retry when re-send is known-safe (read-only status, etc.)
// and you pass an explicit idempotent: true style guard in your helper.
```

## Vitest coverage (no hardware)

```bash
pnpm --filter @gurezo/web-serial-rxjs exec vitest run tests/session/timeout-cancel-retry-recipes.test.ts
```

Drive failures with the Fake from [Hardware-free testing](./testing.md) (`failNextConnect`, `failConnectTimes`, `hangNextConnect`, `failNextSend`, `dispose$`).

## Related

- [Request / Response](./request-response.md) — wait-then-send, send vs timeout errors
- [Advanced Usage](./advanced-usage.md) — recovery / reconnect (prefer **limited** retry from this page)
- [Hardware-free testing](./testing.md) — Fake `SerialSession`
- [Troubleshooting](./troubleshooting.md) — port picker cancel and common failures

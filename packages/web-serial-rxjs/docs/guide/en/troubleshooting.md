# Troubleshooting

Common Web Serial and `@gurezo/web-serial-rxjs` problems, with check steps and fixes. Start with [Quick Start](./quick-start.md) requirements if you have not connected yet. For error code tables, see [API concepts and design notes](./concepts.md#serialerror-serialerrorcode).

## Port picker does not open / device missing

**Symptoms:** Clicking Connect does nothing, or the browser dialog opens but your device is not listed.

**Check:**

1. Call `connect$()` from a **user gesture** (button click). The browser blocks the picker otherwise — see [Quick Start – Requirements](./quick-start.md#requirements).
2. Confirm the page is a [secure context](#secure-context-https--localhost) (HTTPS or localhost).
3. Confirm Web Serial is available — see [Web Serial not supported](#web-serial-not-supported).
4. Try another USB cable / port, and close other apps that might hold the serial device (Arduino IDE, screen, minicom, another browser tab).
5. On the OS, confirm the device appears and drivers are installed.

**Fix:** Wire Connect to a click handler, fix secure context / browser support, free the port, then call `connect$()` again and subscribe.

## Web Serial not supported

**Symptoms:** `state$` stays at `unsupported`, or `connect$` fails with `SerialErrorCode.BROWSER_NOT_SUPPORTED`.

**Check:**

```typescript
import { isWebSerialSupported } from '@gurezo/web-serial-rxjs';

if (!isWebSerialSupported()) {
  console.error('Web Serial API is not available in this browser');
}
```

**Fix:** Use a desktop Chromium-based browser or Firefox with Web Serial (Chrome 89+, Edge 89+, Opera 75+, Firefox 151+). Safari and mobile browsers are not supported. See the [Examples requirements](https://gurezo.net/web-serial-rxjs/examples/) and repository README browser support notes.

## Secure context (HTTPS / localhost)

**Symptoms:** `navigator.serial` is missing, or Examples show an insecure-context message.

**Check:** The origin must be HTTPS or `http://localhost` / `http://127.0.0.1`. Plain `http://` on a LAN IP or hostname will not expose Web Serial.

**Fix:** Serve over HTTPS, use localhost for local development, or tunnel with a tool that terminates TLS. Details: [Quick Start – Requirements](./quick-start.md#requirements).

## Forgot to subscribe

**Symptoms:** Nothing happens after calling `connect$()`, `send$()`, `disconnect$()`, or `dispose$()` — no dialog, no send, no teardown.

**Check:** These methods return **cold** Observables. They only run when you **subscribe**.

```typescript
// Does nothing until subscribed
session.connect$();

// Runs the connection flow
session.connect$().subscribe({
  error: (e) => console.error(e),
});
```

**Fix:** Always subscribe (or use an operator that subscribes, such as converting to a Promise carefully). The same rule applies to `send$`, `disconnect$`, and `dispose$`. See [Quick Start](./quick-start.md).

## Line ending mismatch

**Symptoms:** Sends appear ignored, replies never arrive on `lines$`, or the terminal looks broken.

**Check:**

1. Many shells expect `\r\n` on send. Prefer `session.send$(`${line}\r\n`)` or a small `sendLine` helper — see [Advanced Usage – Send line](./advanced-usage.md#send-line-pattern).
2. Prefer **`lines$`** for newline-delimited logs/parsers. Prefer **`receive$`** (or `terminalText$`) for terminal-style `\r` redraw.
3. Interactive Examples expose a line-ending control; match it to your device.

**Fix:** Align send endings with the device, and pick `lines$` vs `receive$` for the consumer. Recipes: [Advanced Usage – Line framing](./advanced-usage.md#line-framing-built-in-vs-custom-framing-on-).

## Port already in use (conflict)

**Symptoms:** Picker shows the device but open fails, or `PORT_OPEN_FAILED` / related errors appear on `errors$`.

**Check:** Another process or browser tab may hold the port. Only one opener can own a serial port at a time on most OSes.

**Fix:** Close other serial tools and tabs, unplug/replug if needed, then connect again from a user gesture. Inspect `errors$` — see [Inspecting SerialError](#inspecting-serialerror).

## Reconnect fails

**Symptoms:** After disconnect or an error, Connect does nothing useful, or you get `SESSION_DISPOSED` / `PORT_ALREADY_OPEN`.

**Check:**

1. After **`disconnect$`**, the same session is reusable from `'idle'` (or recovered from `'error'`). Subscribe to `disconnect$`, wait for idle on `state$`, then `connect$()` again.
2. After **`dispose$`**, the session is permanent. Create a **new** `createSerialSession()` — do not reuse the disposed instance.
3. Do not call `connect$` while already `'connecting'` or `'connected'` (`PORT_ALREADY_OPEN`).

**Fix:** Drive UI from `state$`. For baud-rate changes or full teardown, `dispose$` then create a new session. See [Quick Start – Disconnect / Dispose](./quick-start.md#disconnect) and [Advanced Usage – recovery](./advanced-usage.md).

## Inspecting SerialError

**Symptoms:** Failures are hard to classify from `Error.message` alone.

**Check:** Subscribe to **`errors$`** and narrow with `error.is(SerialErrorCode.*)`. For cause-bearing codes, read **`error.context.cause`**.

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.OPERATION_CANCELLED)) {
    console.info('User cancelled the port picker');
    return;
  }
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error('Read failed:', error.context.cause);
    return;
  }
  console.error(error.code, error.message, error.context);
});
```

Also handle `error` on `connect$().subscribe({ error })` and `send$().subscribe({ error })` — the same `SerialError` is multiplexed on `errors$`.

**Fix:** Branch on codes; full tables live in [SerialError / SerialErrorCode](./concepts.md#serialerror-serialerrorcode).

## What to include when reporting

If you still cannot resolve the issue, open a [GitHub Discussion](https://github.com/gurezo/web-serial-rxjs/discussions) for usage questions, or a bug report via the [English](https://github.com/gurezo/web-serial-rxjs/issues/new?template=bug_report.yml) / [Japanese](https://github.com/gurezo/web-serial-rxjs/issues/new?template=bug_report.ja.yml) issue forms.

Please include:

- Browser name and version, OS
- Whether the page is HTTPS or localhost
- `@gurezo/web-serial-rxjs` and `rxjs` versions
- `SerialSessionStatus` / `SerialErrorCode` (and `context` if present)
- Minimal steps or a short code snippet (omit secrets / proprietary firmware dumps)

## Related links

- [Quick Start](./quick-start.md)
- [API concepts and design notes](./concepts.md)
- [Advanced Usage](./advanced-usage.md)
- [English Guide index](./README.md) · [日本語 Guide 索引](../ja/README.md)
- [Documentation home](https://gurezo.net/web-serial-rxjs/)
- [Examples](https://gurezo.net/web-serial-rxjs/examples/)

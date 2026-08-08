# Browser support and support policy

Web Serial **API availability** (what the browser implements) is not the same as this project's **official support** (what we test and guarantee). This page keeps those apart.

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#561](https://github.com/gurezo/web-serial-rxjs/issues/561) · Related: [Troubleshooting](./troubleshooting.md)

## Terminology

| Term | Meaning |
| --- | --- |
| Web Serial API availability | Whether `navigator.serial` exists in the browser |
| Official support / tested | Environments this project tests and treats as supported |
| Untested / out of official support | Not verified; behavior is not guaranteed — **not** the same as “the library rejects it” |
| Not available (API) | The browser does not implement Web Serial |

## Web Serial API availability

Where `navigator.serial` exists, this library can use the Web Serial API. Typical **desktop** availability:

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** does not currently **implement** the Web Serial API. Many **mobile** browsers also lack `navigator.serial`; when the API is missing, `isWebSerialSupported()` returns `false`.

## Project support policy

**Official support** covers the desktop browsers listed above (Chrome 89+, Edge 89+, Opera 75+, Firefox 151+).

**Mobile** browsers are **untested** and **out of official support**. Untested does **not** mean the library rejects them — if a mobile browser exposes Web Serial and the page is in a secure context, feature detection may succeed, but we do not guarantee behavior.

This Guide does **not** maintain a full browser matrix; version floors above reflect known Web Serial availability, not a claim of exhaustive CI coverage for every minor release.

## `isWebSerialSupported()`

`isWebSerialSupported()` is top-level **feature detection**: it returns whether `navigator.serial` is present. Prefer it **before** creating a session or calling `connect$`.

It is **not** a compatibility guarantee and **not** a statement of official support. Secure context (HTTPS or localhost) is a **separate** requirement — see [Quick Start – Requirements](./quick-start.md#requirements) and [Troubleshooting – Secure context](./troubleshooting.md#secure-context-https--localhost).

After a session exists, drive unsupported UI from `state$` with `SerialSessionStatus.Unsupported`. Details: [API concepts – isWebSerialSupported](./concepts.md#iswebserialsupported-boolean).

## Related

- Repository [README – Browser Support](https://github.com/gurezo/web-serial-rxjs/blob/main/README.md#browser-support)
- Package [README – Browser support](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/README.md#browser-support)
- [Verified environment listing criteria](./verified-environment.md) — hardware results are not a “supported device” list
- [Troubleshooting](./troubleshooting.md)
- [Quick Start](./quick-start.md)

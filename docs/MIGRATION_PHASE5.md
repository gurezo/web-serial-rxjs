# Migration Guide (Phase5 cleanup)

This guide explains how to migrate from legacy stream/event APIs to the current session-oriented API.

## Removed APIs

- `getReadStream()`
- `writeStream()`
- `connectionEvents$`

## Replacements

- Receive bytes/text/lines:
  - `getReadStream()` -> `bytes$` or `text$`
- Ordered send:
  - `writeStream()` -> `send$(...)` (internally queued)
- Connection lifecycle:
  - `connectionEvents$` -> `state$`

## Before / After

```ts
// Before
client.getReadStream().subscribe((chunk) => {
  console.log(new TextDecoder().decode(chunk));
});

client.writeStream(payload$).subscribe();
client.connectionEvents$.subscribe((event) => console.log(event));
```

```ts
// After
client.text$.subscribe((text) => {
  console.log(text);
});

client.send$('AT\r\n').subscribe();
client.state$.subscribe((state) => console.log(state.kind));
```

## Notes

- `send$` serializes concurrent writes safely in call order.
- Use `lines$` when your protocol is line-oriented.
- Use `command$` / `transact$` for request/response workflows.

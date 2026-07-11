# Migrating to v3 (`SerialErrorCode` const object)

v3 changes how `SerialErrorCode` is declared in TypeScript. **Runtime values and member names are unchanged** — `SerialErrorCode.READ_FAILED` is still the string `'READ_FAILED'`.

This guide covers what changed and what (if anything) you need to update.

## TL;DR

```typescript
// v2 and v3 — no change required for typical usage
import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error(error.context.cause);
  }
});
```

## What changed

| v2 | v3 |
| --- | --- |
| `export enum SerialErrorCode { ... }` | `export const SerialErrorCode = { ... } as const` + `export type SerialErrorCode` |
| TypeDoc: `enums/SerialErrorCode.html` | TypeDoc: `variables/SerialErrorCode.html` |

`SerialError`, `SerialErrorContextMap`, and `SerialSessionState` are not affected by this change.

## No migration needed (typical patterns)

These patterns work the same in v2 and v3:

- `SerialErrorCode.BROWSER_NOT_SUPPORTED` (and any other member)
- `error.code === SerialErrorCode.WRITE_FAILED`
- `error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)` with narrowed `context`
- `switch (error.code) { case SerialErrorCode.READ_FAILED: ... }`
- `Object.values(SerialErrorCode)` (returns string values only)

## When you may need to update

### Type-only imports

If you import `SerialErrorCode` as a type only, continue using:

```typescript
import type { SerialErrorCode } from '@gurezo/web-serial-rxjs';
```

The type is now a string literal union instead of an enum type. For most apps this is a drop-in replacement.

### Code that depended on enum-specific behaviour

Update if you relied on:

- **Enum reverse mapping** — string enums never had reverse mapping; const object behaves the same.
- **Assigning arbitrary strings** — `const code: SerialErrorCode = someString` still requires the string to match a known code.
- **TypeDoc deep links** — update bookmarks from `enums/SerialErrorCode.html` to `variables/SerialErrorCode.html`.

### Declaration shape in `.d.ts`

Published types change from `enum SerialErrorCode` to:

```typescript
export declare const SerialErrorCode: {
  readonly BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED';
  // ...
};
export type SerialErrorCode =
  (typeof SerialErrorCode)[keyof typeof SerialErrorCode];
```

Tools that parse `.d.ts` and expect an `enum` declaration may need adjustment. Runtime bundles are equivalent.

## Alignment with `SerialSessionState`

v3 applies the same pattern already used by `SerialSessionState`:

```typescript
export const SerialErrorCode = {
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  READ_FAILED: 'READ_FAILED',
  // ...
} as const;

export type SerialErrorCode =
  (typeof SerialErrorCode)[keyof typeof SerialErrorCode];
```

Member names stay `SCREAMING_SNAKE_CASE` (unlike `SerialSessionState`'s PascalCase keys) so existing `SerialErrorCode.X` references remain valid.

## See also

- [Migrating from v1 to v2](./MIGRATION_V2.md)
- [API Reference – SerialError / SerialErrorCode](./API_REFERENCE.md#serialerror--serialerrorcode)

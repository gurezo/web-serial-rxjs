# v3 への移行（`SerialErrorCode` const object）

v3 では `SerialErrorCode` の TypeScript 上の宣言方法が変わります。**ランタイムの値とメンバー名は不変**です — `SerialErrorCode.READ_FAILED` は引き続き文字列 `'READ_FAILED'` です。

本ガイドでは変更点と、必要に応じて更新すべき箇所を説明します。

## TL;DR

```typescript
// v2 も v3 も — 典型的な使い方は変更不要
import { SerialError, SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error(error.context.cause);
  }
});
```

## 変更内容

| v2 | v3 |
| --- | --- |
| `export enum SerialErrorCode { ... }` | `export const SerialErrorCode = { ... } as const` + `export type SerialErrorCode` |
| TypeDoc: `enums/SerialErrorCode.html` | TypeDoc: `variables/SerialErrorCode.html` |

`SerialError`、`SerialErrorContextMap`、`SerialSessionState` は本変更の対象外です。

## 移行不要（典型的なパターン）

以下は v2 と v3 で同じように動作します:

- `SerialErrorCode.BROWSER_NOT_SUPPORTED`（他のメンバーも同様）
- `error.code === SerialErrorCode.WRITE_FAILED`
- `error.is(SerialErrorCode.LINE_BUFFER_OVERFLOW)` による `context` の narrowing
- `switch (error.code) { case SerialErrorCode.READ_FAILED: ... }`
- `Object.values(SerialErrorCode)`（文字列値のみを返す）

## 更新が必要な場合

### 型のみの import

型だけ import する場合は従来どおり:

```typescript
import type { SerialErrorCode } from '@gurezo/web-serial-rxjs';
```

型は enum 型から string literal union へ変わりますが、多くのアプリではそのまま置き換え可能です。

### enum 固有の挙動に依存していたコード

以下に依存している場合は見直しが必要です:

- **enum の reverse mapping** — string enum には reverse mapping はなく、const object も同様です。
- **任意の文字列の代入** — `const code: SerialErrorCode = someString` は引き続き既知のコード文字列である必要があります。
- **TypeDoc の深いリンク** — ブックマークを `enums/SerialErrorCode.html` から `variables/SerialErrorCode.html` へ更新してください。

### `.d.ts` の宣言形

公開型は `enum SerialErrorCode` から次の形へ変わります:

```typescript
export declare const SerialErrorCode: {
  readonly BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED';
  // ...
};
export type SerialErrorCode =
  (typeof SerialErrorCode)[keyof typeof SerialErrorCode];
```

`.d.ts` を解析して `enum` 宣言を期待するツールは調整が必要な場合があります。ランタイムのバンドルは同等です。

## `SerialSessionState` との統一

v3 では、すでに `SerialSessionState` で採用しているパターンを `SerialErrorCode` にも適用します:

```typescript
export const SerialErrorCode = {
  BROWSER_NOT_SUPPORTED: 'BROWSER_NOT_SUPPORTED',
  READ_FAILED: 'READ_FAILED',
  // ...
} as const;

export type SerialErrorCode =
  (typeof SerialErrorCode)[keyof typeof SerialErrorCode];
```

メンバー名は `SCREAMING_SNAKE_CASE` のままです（`SerialSessionState` の PascalCase キーとは意図的に異なります）。既存の `SerialErrorCode.X` 参照を壊しません。

## 関連ドキュメント

- [v1 から v2 への移行](./MIGRATION_V2.ja.md)
- [API リファレンス – SerialError / SerialErrorCode](./API_REFERENCE.ja.md#serialerror--serialerrorcode)

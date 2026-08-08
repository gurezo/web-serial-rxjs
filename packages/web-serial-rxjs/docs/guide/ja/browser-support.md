# ブラウザサポートと公式サポート方針

Web Serial の **API 実装状況**（ブラウザが提供するもの）と、本プロジェクトの **公式サポート**（動作確認・保証の範囲）は別です。このページでは両者を分けて記載します。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#561](https://github.com/gurezo/web-serial-rxjs/issues/561) · Related: [トラブルシューティング](./troubleshooting.md)

## 用語

| 用語 | 意味 |
| --- | --- |
| Web Serial API の実装状況 | ブラウザに `navigator.serial` があるか |
| 公式サポート / 検証済み | 本プロジェクトが動作確認し、サポート対象とする環境 |
| 未検証 / 公式サポート対象外 | 未確認であり動作を保証しない。**「ライブラリが拒否する」こととは異なる** |
| API 未実装 | ブラウザが Web Serial を実装していない |

## Web Serial API の実装状況

`navigator.serial` が存在する環境では、本ライブラリは Web Serial API を利用できます。**デスクトップ**での典型的な対応は次のとおりです。

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+
- **Firefox** 151+

**Safari** は現時点で Web Serial API を**実装していません**。多くの**モバイル**ブラウザにも `navigator.serial` がなく、API が無い場合は `isWebSerialSupported()` が `false` を返します。

## プロジェクトの公式サポート方針

**公式サポート**の対象は、上記のデスクトップブラウザ（Chrome 89+、Edge 89+、Opera 75+、Firefox 151+）です。

**モバイル**ブラウザは**未検証**であり、**公式サポート対象外**です。未検証は「ライブラリが拒否する」ことと同一ではありません。モバイルで Web Serial が公開され、セキュアコンテキストであれば feature detection が成功する場合もありますが、動作は保証しません。

本 Guide では詳細なブラウザマトリクスは維持しません。上記のバージョン下限は Web Serial の既知の実装状況を示すものであり、すべてのマイナー版を CI で網羅検証しているという意味ではありません。

## `isWebSerialSupported()`

`isWebSerialSupported()` はトップレベルの **feature detection** です。`navigator.serial` の有無を返します。セッション生成や `connect$` の**前**に使うことを推奨します。

これは**互換性の保証ではなく**、**公式サポートの宣言でもありません**。セキュアコンテキスト（HTTPS または localhost）は**別条件**です — [クイックスタート – 利用条件](./quick-start.md#利用条件) と [トラブルシューティング – セキュアコンテキスト](./troubleshooting.md#セキュアコンテキストhttps--localhost) を参照してください。

セッション生成後は、`state$` の `SerialSessionStatus.Unsupported` で非対応 UI を駆動してください。詳細: [API の概念 – isWebSerialSupported](./concepts.md#iswebserialsupported-boolean)。

## 関連

- リポジトリ [README – ブラウザサポート](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md#ブラウザサポート)
- パッケージ [README – ブラウザサポート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/README.ja.md#ブラウザサポート)
- [トラブルシューティング](./troubleshooting.md)
- [クイックスタート](./quick-start.md)

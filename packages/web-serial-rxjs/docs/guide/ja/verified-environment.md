# Verified environment 掲載基準

このページは、将来このプロジェクトが実機の動作確認結果を **Verified environment** として公開する場合に必要な**最低限の検証情報**を定義します。**採用・保守判断**のための方針文書です。デバイスカタログではなく、Arduino / Raspberry Pi Pico / ESP32 などを「対応」として列挙するものでもありません。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#566](https://github.com/gurezo/web-serial-rxjs/issues/566) · Related: [ブラウザサポート](./browser-support.md) · [Recipes](./recipes.md) · [実機なしテスト](./testing.md)

## 用語

| 用語 | 意味 |
| --- | --- |
| **Verified environment** | 下記条件のもとで実機 + OS + ブラウザ + ライブラリ構成を記録した検証結果。「Supported device」という名称は使わない |
| **公式サポート** | 本プロジェクトが**ブラウザ**および**ライブラリ版**について検証・保証する範囲 — [ブラウザサポート](./browser-support.md) と [バージョンサポート](./version-support.md) を参照。ハードウェア検証とは別 |
| **未検証** | 公開された検証記録がないこと。**「ライブラリが拒否する」ことや非互換の断定とは異なる** |
| **Historical** | 鮮度ルールを満たさなくなった過去の検証。文脈として残す場合もあるが、**永久保証として扱わない** |

デバイス**名だけ**で互換や「対応」を主張してはいけません。

## 必須項目

公開する Verified environment のエントリには、次を**すべて**含めます。

| 項目 | 必須 | 補足 |
| --- | --- | --- |
| Device / board name | はい | 試験に用いた製品名・ボード名 |
| USB serial implementation | はい | 例: CDC ACM チップ、FTDI、CP210x、MCU の native USB CDC |
| Firmware / sketch / software | はい | 版、または再現可能なソース（[記録形式](#記録形式) 参照） |
| OS | はい | 名称 + 版（メジャーのみは不可） |
| Browser name and version | はい | 名称 + 版（メジャーのみは不可） |
| `web-serial-rxjs` version | はい | 試験対象の正確なパッケージ版（例: `4.0.4`） |
| baud rate | はい | |
| data bits | はい | |
| stop bits | はい | |
| parity | はい | |
| flow control | はい | 例: `none`, `hardware` |
| line ending | はい | 例: `\n`, `\r\n`, なし |
| tested operations | はい | 具体的な操作（connect、write、行読み取り、disconnect など） |
| test date | はい | ISO 日付 `YYYY-MM-DD` |
| notes / known limitations | はい | 特記事項がなければ「特になし」と書く |
| report source | はい | `maintainer` または `community` |

## 記録形式

| 項目 | 形式 |
| --- | --- |
| **test date** | ISO 暦日: `YYYY-MM-DD`（鮮度判断のため必須） |
| **OS** | `OS <name> <version>` — 例: `macOS 15.6`, `Windows 11 24H2`。メジャーのみ（`macOS 15`）は**不可** |
| **Browser** | `Browser <name> <version>` — 例: `Chrome 131.0.6778.86`。メジャーのみ（`Chrome 131`）は**不可** |
| **Firmware / software** | **版文字列**、または **ソース URL + コミット／タグ** のいずれか必須（再現可能にすること）。可能なら両方 |

## 「検証済み」は公式保証ではない

- Verified environment の記録は、「**この日付・この条件で試験した**」という意味です。
- ハードウェア互換の永続保証、ベンダー認定、[公式のブラウザ／バージョンサポート](./browser-support.md) への編入を意味しません。
- Recipes や Examples を対応デバイス一覧にするものでもありません — [Recipes](./recipes.md)（ブランドではなく通信パターン）を参照。
- 将来の一覧に無いことは、その構成について**継続検証を主張しない**という意味に留めます。

## Community report

コミュニティ報告を掲載する場合:

1. 上記の**必須項目**をすべて満たすこと。
2. **再現手順**（接続方法、送受信内容、期待結果）を含めること。
3. 不足のある報告は**掲載しない**。
4. **report source** を `community` とする（メンテナ実施は `maintainer`）。
5. 再現できない、または firmware／版の根拠が欠ける報告はメンテナが却下してよい。

## 古い結果（Stale / historical）

検証は**時点付き**です。古い結果を永久保証として扱ってはいけません。

次の**いずれか**に該当する場合、エントリを **historical** として注記するか、現行一覧から外してよいです。

- `test date` から **12 か月超**経過した、**または**
- 試験時のライブラリ **major** が、現行 major と一致しなくなった（例: 現行が `4.x` なのに `3.x` の結果）

残す場合は、読者が現行の検証と混同しないよう明示します。

## 現状

- 本リポジトリでは**このページで基準のみ**を定義します。
- Verified environment の**一覧はまだ公開していません**。
- **未検証**のデバイス／ボードを「対応」としてここにも他ページにも掲載しません。
- 実際の一覧ページ作成は、本基準が存在する前提で**別 Issue** として判断します。

## Related

- [ブラウザサポートと公式サポート方針](./browser-support.md)
- [バージョンサポートとリリース方針](./version-support.md)
- [通信パターン別 Recipes](./recipes.md) — デバイスブランドではなくパターン
- [実機なしテスト](./testing.md) — CI 向け Fake（ハードウェア検証ではない）
- [バイナリ受信 API — 設計判断](./binary-receive-design.md) — 未検証ハードウェアの対応主張は対象外
- 親トラッキング: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555)

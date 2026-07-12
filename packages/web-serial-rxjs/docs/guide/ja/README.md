# 日本語 Guide

`@gurezo/web-serial-rxjs` の利用方法を説明する手書き Markdown Guide です。公開 API の型・引数・戻り値の網羅的な仕様は [英語 TypeDoc API Reference](../../api/modules.html) を参照してください。

canonical なドキュメント構成は [ARCHITECTURE.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ARCHITECTURE.ja.md) を参照してください。

## Getting Started（推奨する読み順）

1. **[概要](./overview.md)** — `SerialSession` の公開面、`state$` / `errors$` の位置付け、最小サンプル
2. **[クイックスタート](./quick-start.md)** — インストール、接続、受信・送信、切断・破棄、エラーハンドリング
3. **[高度な使用方法](./advanced-usage.md)** — 行フレーミング、擬似リクエスト／レスポンス、リカバリ
4. **[API の概念と設計メモ](./concepts.md)** — オプション表、`SerialError`、型の補足（TypeDoc の代替ではありません）

既存コードから移行する場合:

- **[v2 → v3 マイグレーション](./migration-v3.md)** — `state$` discriminated union、`SerialSessionStatus`、`context.cause`
- **[v1 → v2 マイグレーション](./migration-v2.md)** — 削除された v1 API の対応表

## ドキュメント一覧

| ドキュメント | 用途 |
| --- | --- |
| **[概要](./overview.md)** | 公開面の早見表、機能概要、最小サンプル |
| **[クイックスタート](./quick-start.md)** | インストールから切断までの基本フロー |
| **[高度な使用方法](./advanced-usage.md)** | 応用パターンと RxJS レシピ |
| **[API の概念と設計メモ](./concepts.md)** | オプション・エラーコード・型の表形式補足 |
| **[v2 → v3 マイグレーション](./migration-v3.md)** | v3 canonical API への移行手順 |
| **[v1 → v2 マイグレーション](./migration-v2.md)** | v1 廃止 API の置き換え |
| **[Phase 5（アーカイブ）](./archive/migration-phase5.md)** | 旧 v1 ドキュメントの参照用 |

## 関連リンク

- **モノレポ [README.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** — サンプルアプリ索引、貢献、ブラウザサポート
- **English Guide** — [English Guide 索引](../en/README.md)
- **ドキュメントトップ** — [../../index.html](../../index.html)
- **英語 TypeDoc API Reference** — [../../api/modules.html](../../api/modules.html)
- **親 Issue** — [#453](https://github.com/gurezo/web-serial-rxjs/issues/453)（ドキュメント構成整備）

## v3 canonical API の要点

- **`state$`** — 接続ライフサイクルの canonical source。`state.status` と `SerialSessionStatus` で分岐し、connected 時は `state.portInfo` を利用する
- **`errors$`** — fatal / non-fatal エラーの canonical event channel。`SerialError.is(SerialErrorCode.*)` で分岐する
- **非推奨 convenience** — `isConnected$`、`portInfo$`、`getPortInfo()` は v3.x で残存するが、新規コードでは `state$` narrowing を優先する

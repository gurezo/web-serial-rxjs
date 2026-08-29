# 日本語 Guide

`@gurezo/web-serial-rxjs` の利用方法を説明する手書き Markdown Guide です。公開 API の型・引数・戻り値の網羅的な仕様は [英語 TypeDoc API Reference](../../api/modules.html) を参照してください。

canonical なドキュメント構成は [ARCHITECTURE.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ARCHITECTURE.ja.md) を参照してください。

## Getting Started（推奨する読み順）

1. **[概要](./overview.md)** — `SerialSession` の公開面、`state$` / `errors$` の位置付け、最小サンプル
2. **[クイックスタート](./quick-start.md)** — インストール、接続、受信・送信、切断・破棄、エラーハンドリング
3. **[Framework 別 session ライフサイクル](./framework-session-lifecycle.md)** — `disconnect$` / `dispose$` のタイミングと subscription 解除（Angular / React / Vue / Svelte / Vanilla TS）
4. **[ブラウザサポートと公式サポート方針](./browser-support.md)** — Web Serial API 実装状況と公式サポートの分離
5. **[バージョンサポートとリリース方針](./version-support.md)** — SemVer、非推奨、サポート範囲（LTS なし）
6. **[Bundler / framework 互換性の検証方針](./bundler-compatibility.md)** — CI と Example build の区別、ESM / RxJS / 型の最低要件（全 matrix なし）
7. **[Bundle size と tree-shaking](./bundle-size.md)** — 再現可能な library-only サイズのスナップショットと測定手順
8. **[Verified environment 掲載基準](./verified-environment.md)** — 実機結果を掲載する場合の最低項目（デバイスカタログではない）
9. **[receive$ / lines$ / terminalText$ の選び方](./stream-selection.md)** — 用途から受信ストリームを選ぶ
10. **[通信パターン別 Recipes](./recipes.md)** — 通信目的から Guide / Recipe を探す（行プロトコル、コマンド／応答、タイムアウトなど）
11. **[高度な使用方法](./advanced-usage.md)** — 行フレーミング、派生ストリーム、リカバリ
12. **[Request / Response](./request-response.md)** — `lines$` / `receive$` で応答待ち、コマンドの直列化
13. **[タイムアウト・キャンセル・再試行](./timeout-cancel-retry.md)** — 期限、破棄時キャンセル、回数制限付き再試行（コア自動再試行なし）
14. **[API の概念と設計メモ](./concepts.md)** — オプション表、`SerialError`、型の補足、差し替え可能な `SerialSession` 契約、[対応範囲（テキスト / バイナリ / 文字コード）](./concepts.md#対応範囲テキスト--バイナリ--文字コード)（TypeDoc の代替ではありません）
15. **[バイナリ受信 API — 設計判断](./binary-receive-design.md)** — 将来の `receiveBytes$` の go / no-go（未実装）
16. **[実機なしテスト](./testing.md)** — Fake `SerialSession`、Vitest 例、DI 注入（npm 非同梱）
17. **[トラブルシューティング](./troubleshooting.md)** — Web Serial / セッションのよくある問題、自己解決手順、エラー Recovery Matrix

既存コードから移行する場合:

- **[v3 → v4 マイグレーション](./migration-v4.md)** — Phase 1+2 の削除（`receiveReplay$`、`isBrowserSupported()`、オプション整理）
- **[v2 → v3 マイグレーション](./migration-v3.md)** — `state$` discriminated union、`SerialSessionStatus`、`context.cause`
- **[v1 → v2 マイグレーション](./migration-v2.md)** — 削除された v1 API の対応表

## ドキュメント一覧

| ドキュメント | 用途 |
| --- | --- |
| **[概要](./overview.md)** | 公開面の早見表、機能概要、最小サンプル |
| **[クイックスタート](./quick-start.md)** | インストールから切断までの基本フロー |
| **[Framework 別 session ライフサイクル](./framework-session-lifecycle.md)** | framework 別の `disconnect$` / `dispose$` タイミングと subscription 解除 |
| **[ブラウザサポートと公式サポート方針](./browser-support.md)** | API 実装状況と公式サポート / 未検証の区別 |
| **[バージョンサポートとリリース方針](./version-support.md)** | SemVer、非推奨、サポート範囲（LTS なし） |
| **[Bundler / framework 互換性の検証方針](./bundler-compatibility.md)** | CI と Examples の区別、ESM / RxJS / 型（全 bundler matrix なし） |
| **[Bundle size と tree-shaking](./bundle-size.md)** | library-only サイズのスナップショットと再現可能な測定 |
| **[Verified environment 掲載基準](./verified-environment.md)** | 実機結果掲載時の最低検証項目（デバイスカタログなし） |
| **[receive$ / lines$ / terminalText$ の選び方](./stream-selection.md)** | 3 系統の受信ストリームの判断ガイド |
| **[通信パターン別 Recipes](./recipes.md)** | パターン → Guide / Recipe 索引（デバイス互換の保証ではない） |
| **[高度な使用方法](./advanced-usage.md)** | 応用パターンと RxJS レシピ |
| **[Request / Response](./request-response.md)** | コマンド送信後の応答待ち（コア `request$` なし） |
| **[タイムアウト・キャンセル・再試行](./timeout-cancel-retry.md)** | タイムアウト、破棄時キャンセル、回数制限付き再試行（コア自動再試行なし） |
| **[API の概念と設計メモ](./concepts.md)** | オプション・エラーコード・型の表形式補足、差し替え可能な `SerialSession` 契約、[対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード) |
| **[バイナリ受信 API — 設計判断](./binary-receive-design.md)** | 設計検討: `receiveBytes$` は当面追加しない。go / no-go 条件 |
| **[実機なしテスト](./testing.md)** | 制御可能な Fake `SerialSession`、Vitest / Angular / React 例（npm 非同梱） |
| **[トラブルシューティング](./troubleshooting.md)** | よくある問題の確認手順、Recovery Matrix、報告時の情報 |
| **[v3 → v4 マイグレーション](./migration-v4.md)** | Phase 1+2 公開 API 整理の統合ガイド |
| **[v2 → v3 マイグレーション](./migration-v3.md)** | v3 canonical API への移行手順 |
| **[v1 → v2 マイグレーション](./migration-v2.md)** | v1 廃止 API の置き換え |
| **[Phase 5（アーカイブ）](./archive/migration-phase5.md)** | 旧 v1 ドキュメントの参照用 |

## 関連リンク

- **モノレポ [README.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** — サンプルアプリ索引、貢献、ブラウザサポート
- **English Guide** — [English Guide 索引](../en/README.md)
- **ドキュメントトップ** — [../../index.html](../../index.html)
- **英語 TypeDoc API Reference** — [../../api/modules.html](../../api/modules.html)
- **親 Issue** — [#453](https://github.com/gurezo/web-serial-rxjs/issues/453)（ドキュメント構成整備）

## Canonical API の要点

- **`state$`** — 接続ライフサイクルの canonical source。`state.status` と `SerialSessionStatus` で分岐し、connected 時は `state.portInfo` を利用する
- **`errors$`** — fatal / non-fatal エラーの canonical event channel。`SerialError.is(SerialErrorCode.*)` で分岐する
- **`dispose$()`** — セッション破棄の唯一の API（購読により実行）
- **`isWebSerialSupported()`** — トップレベルの同期 feature detection（セッションメソッドではない。サポート保証ではない）— [ブラウザサポート](./browser-support.md) を参照
- Phase 1+2 で削除された API（`destroy$`、`isConnected$`、`portInfo$`、`getPortInfo()`、`getCurrentPort()`、`receiveReplay$`、`isBrowserSupported()`）は [v4 への移行](./migration-v4.md) を参照

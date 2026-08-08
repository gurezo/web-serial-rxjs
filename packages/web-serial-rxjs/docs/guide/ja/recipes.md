# 通信パターン別 Recipes

この索引は、**やりたいシリアル通信の目的**から既存の Guide / Recipe ページへ辿るためのハブです。通信パターンが分かっているときに使ってください。フレームワーク別の配線例は [Examples](../../examples/) を参照してください。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#558](https://github.com/gurezo/web-serial-rxjs/issues/558)

## スコープ

| 項目 | 判断 |
| --- | --- |
| 軸 | **通信パターン**（デバイスブランドではない） |
| デバイス名 | 製品名を互換性の保証として扱わない |
| 新規の長文ページ | 既存 Guide / Recipe への **リンク**を優先 |
| バイナリ受信 | **未対応** — [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) と [対応範囲](./concepts.md#対応範囲（テキスト-バイナリ--文字コード）) を参照 |

## カタログ

| パターン | 主な API | 詳細 |
| --- | --- | --- |
| [基本のテキスト送受信](#基本のテキスト送受信) | `connect$`, `lines$`, `send$`, `disconnect$` / `dispose$` | [クイックスタート](./quick-start.md) |
| [行指向プロトコル](#行指向プロトコル) | `lines$`、必要に応じて `receive$` | [高度な使用方法 – 行フレーミング](./advanced-usage.md#行単位のフレーミング（組み込み-と--上のカスタム分割）) · [ストリームの選び方](./stream-selection.md) |
| [ターミナル / CR 処理](#ターミナル--cr-処理) | `terminalText$`, `receive$` | [ストリームの選び方](./stream-selection.md) · [高度な使用方法](./advanced-usage.md) |
| [Command / Response](#command--response) | `lines$` / `receive$`, `send$` | [Request / Response](./request-response.md) |
| [タイムアウト](#タイムアウト) | `connect$` / 待機への RxJS `timeout` | [タイムアウト・キャンセル・再試行 – 接続](./timeout-cancel-retry.md#接続のタイムアウト) |
| [キャンセル](#キャンセル) | `takeUntil`、購読解除、破棄時 teardown | [タイムアウト・キャンセル・再試行 – キャンセル](./timeout-cancel-retry.md#によるキャンセル) |
| [再接続ポリシー](#再接続ポリシー) | `state$`, `connect$`、`dispose$` 後は新セッション | [disposed では再接続しない](./timeout-cancel-retry.md#では再接続しない) · [致命的エラー時の再接続](./advanced-usage.md#致命的エラー時の再接続) |
| [Fake SerialSession テスト](#fake-serialsession-テスト) | `SerialSession` 契約を満たす Fake | [実機なしテスト](./testing.md) |
| [バイナリ送信（`Uint8Array`）](#バイナリ送信uint8array) | `send$(Uint8Array)` | [対応範囲](./concepts.md#対応範囲（テキスト-バイナリ--文字コード）) |

---

### 基本のテキスト送受信

| | |
| --- | --- |
| **対象 API** | `createSerialSession`, `connect$`, `lines$`, `send$`, `disconnect$` / `dispose$`, `state$`, `errors$` |
| **適している用途** | 初回接続、ログ風の行受信、単純な文字列送信 |
| **適していない用途** | カスタムフレーミング、コマンド／応答の対応付け、バイナリ線上プロトコル |
| **詳細** | [クイックスタート](./quick-start.md) · ストリーム選択は [選び方](./stream-selection.md) |

### 行指向プロトコル

| | |
| --- | --- |
| **対象 API** | `lines$`（既定）。組み込みフレーミングで足りないときだけ `receive$` + RxJS |
| **適している用途** | 改行区切りログ、JSON Lines、1 行のステータス応答 |
| **適していない用途** | 改行のないプロンプト、`\r` 再描画ターミナル（`receive$` / `terminalText$` を優先） |
| **詳細** | [高度な使用方法 – 行フレーミング](./advanced-usage.md#行単位のフレーミング（組み込み-と--上のカスタム分割）) · [ストリームの選び方](./stream-selection.md) |

### ターミナル / CR 処理

| | |
| --- | --- |
| **対象 API** | `terminalText$`, `receive$`（および `SerialSessionOptions.terminalBuffer`） |
| **適している用途** | ターミナル風 UI へのバインド、`\r` 再描画の折りたたみ、任意の ANSI 除去 |
| **適していない用途** | 厳密な行パーサ（`lines$` を使う）；ワイヤ `Uint8Array` 受信の期待 |
| **詳細** | [ストリームの選び方](./stream-selection.md) · [高度な使用方法](./advanced-usage.md) · [`createTerminalBuffer`](./concepts.md#createterminalbufferreceive-options) |

### Command / Response

| | |
| --- | --- |
| **対象 API** | `lines$` または `receive$`、`send$`（待ち→送信を組み立てる。コア `request$` は**ない**） |
| **適している用途** | コマンド送信後に一致する行／プロンプトを待つ、`concatMap` で直列化 |
| **適していない用途** | 送信のみのログ；遅れて購読しても過去の emit が再生されると期待すること |
| **詳細** | [Request / Response レシピ](./request-response.md) |

### タイムアウト

| | |
| --- | --- |
| **対象 API** | `connect$` や応答待ちまわりの RxJS `timeout`（アプリ方針。コアの接続リースではない） |
| **適している用途** | ポート選択／接続待ちや応答待ちの上限 |
| **適していない用途** | タイムアウト＝非冪等コマンドの「安全な再送」とみなすこと |
| **詳細** | [接続のタイムアウト](./timeout-cancel-retry.md#接続のタイムアウト) · [応答待機のタイムアウト](./timeout-cancel-retry.md#応答待機のタイムアウト) |

### キャンセル

| | |
| --- | --- |
| **対象 API** | `takeUntil`、購読解除、Component / Hook の破棄 |
| **適している用途** | UI 破棄時に処理を止める；ユーザーキャンセルとデバイス障害の区別 |
| **適していない用途** | `OPERATION_CANCELLED` のあとポート選択を自動で開き直すこと |
| **詳細** | [`takeUntil` によるキャンセル](./timeout-cancel-retry.md#によるキャンセル) · [破棄時のキャンセル](./timeout-cancel-retry.md#component-hook-破棄時のキャンセル) |

### 再接続ポリシー

| | |
| --- | --- |
| **対象 API** | `state$`, `connect$`, `errors$`；`dispose$` 後は**新しい** `SerialSession` |
| **適している用途** | アプリ側の回数制限付き再試行／復旧可能な失敗後の手動再接続 |
| **適していない用途** | コア自動再接続；disposed セッションへの再接続；無限再試行 |
| **詳細** | [`disposed` では再接続しない](./timeout-cancel-retry.md#では再接続しない) · [致命的エラー時の再接続](./advanced-usage.md#致命的エラー時の再接続) · [再試行してよい処理](./timeout-cancel-retry.md#してよい処理-避けるべき処理) |

### Fake `SerialSession` テスト

| | |
| --- | --- |
| **対象 API** | 差し替え可能な `SerialSession` 契約を満たす Fake（npm 非同梱） |
| **適している用途** | USB 実機なしの単体／結合テスト、CI での失敗注入 |
| **適していない用途** | 本番で本物の Web Serial スタックを置き換えること |
| **詳細** | [実機なしテスト](./testing.md) · [差し替え可能な公開契約](./concepts.md#差し替え可能な公開契約（decision-536）) |

### バイナリ送信（`Uint8Array`）

| | |
| --- | --- |
| **対象 API** | `send$(Uint8Array)` — バイト列をそのまま書き込む |
| **適している用途** | 対向が既に理解している不透明なバイナリペイロードの送信 |
| **適していない用途** | バイナリ**受信**（`receiveBytes$` / `Uint8Array` 受信ストリームなし）；Modbus RTU / COBS / SLIP をライブラリ機能として期待すること |
| **詳細** | [対応範囲](./concepts.md#対応範囲（テキスト-バイナリ--文字コード）) · 設計検討 [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) |

短い例（送信のみ。受信は引き続き UTF-8 テキスト）:

```typescript
import { firstValueFrom } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });
await firstValueFrom(session.connect$());

const payload = new Uint8Array([0x01, 0x02, 0x03]);
await firstValueFrom(session.send$(payload));
```

---

## 関連

- [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) — 迷ったら先に受信ストリームを選ぶ
- [トラブルシューティング](./troubleshooting.md) — ポート選択、改行、再接続の症状
- [Examples](../../examples/) — Angular / React / Vue / Svelte / Vanilla
- [English Recipes](../en/recipes.md)

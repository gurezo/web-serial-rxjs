# SerialSession の概要

<p align="center">
  <img src="../../../assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

このページは公開 API の**考え方**をまとめたものです。各 `SerialSession` 面の役割、`SerialSessionState` と `state$` の対応、`receive$` と `lines$` の使い分け。**`state$`** が canonical lifecycle source、**`errors$`** が canonical error event channel です。オプション、エラーコード、型の詳細は [API リファレンス](https://gurezo.github.io/web-serial-rxjs/modules.html) を参照してください。

## 目次

- [ドキュメント](#ドキュメント)
- [機能](#機能)
- [対応フレームワーク](#対応フレームワーク)
- [SerialSession の全体像](#serialsessionの全体像)
- [ドキュメント索引](#ドキュメント索引)

## ドキュメント

TypeDoc のトップページから、まず以下を参照してください。

- [クイックスタート](./QUICK_START.ja.md)
- [高度な使用方法](./ADVANCED_USAGE.ja.md)
- [API の概念と設計メモ](./API_REFERENCE.ja.md)
- [v2 から v3 への移行ガイド](./MIGRATION_V3.ja.md)
- [v1 から v2 への移行ガイド](./MIGRATION_V2.ja.md)

## 機能

- **Session 指向のリアクティブ API**: 1 つの `SerialSession` が `state$`（canonical lifecycle discriminated union）/ `errors$`（error event channel）/ `receive$` / `lines$` と convenience stream の `isConnected$`、`connect$` / `disconnect$` / `dispose$` / `send$` を公開
- **UTF-8 テキストストリーム**: `receive$` は内部でストリーミング `TextDecoder` を用いてデコード済み。マルチバイト文字がチャンクにまたがっても正しく結合されます
- **順序保証された送信キュー**: 並行する `send$` 呼び出しも内部キューで FIFO 処理され、呼び出し順に書き込まれます
- **統一エラーチャネル**: すべての I/O エラーは `SerialError` に正規化され `errors$` に多重化されます
- **明示的なライフサイクル**: `state$` は `status` を持つ discriminated union（`idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` / `disposed`）を emit するので、`state.status` で narrowing できます
- **TypeScript サポート**: 完全な TypeScript 型定義を同梱
- **フレームワーク非依存**: 任意の JavaScript/TypeScript フレームワークまたはバニラ JavaScript で利用可能

## 対応フレームワーク

このライブラリはフレームワーク非依存で、以下の環境で利用できます。

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## SerialSession の全体像

`createSerialSession` が返す **SerialSession** だけを使います。公開 API は意図的に小さく、**ターミナルにそのまま出す出力**は **`receive$`**、**改行区切りのログや解析**は **`lines$`** が担当します。ライフサイクル UI には **`state$`** の `state.status` narrowing を優先してください。

| 公開面 | 役割 |
| --- | --- |
| `state$` | **Canonical 接続ライフサイクル** — discriminated union（`status` + 必要に応じ `portInfo` / `error`）。購読時に現在値をリプレイ。分岐は **`SerialSessionStatus`** との比較を推奨。 |
| `SerialSessionStatus` | **状態定数** — エクスポートされる const object（例: `SerialSessionStatus.Connected` → `'connected'`）。`state$.status` と比較する。 |
| `SerialSessionState` | **`state$` の payload 型** — discriminated union。 |
| `isConnected$` | **接続中フラグ（convenience）** — `state$.status` が `SerialSessionStatus.Connected` のときだけ `true`。フル lifecycle UI には `state$` を優先。 |
| `receive$` | **生のデコードチャンク** — UTF-8 テキストを read pump が返すとおりに受け取る（行揃えではない。マルチバイト安全）。`\r` 等も保持。**ターミナル風の表示**や `\r` による上書き表示向け。 |
| `terminalText$` | **ターミナル表示向けの累積テキスト** — `receive$` 由来の表示用テキスト。`\r` による上書きを折りたたみつつ通常の改行挙動は維持します。既定ではプレーンテキスト UI 向けに ANSI エスケープを除去します（生データは `receive$`）。ターミナル風ビューへ 1 つの文字列をそのままバインドしたい場合に使います。既定では完了行 10,000 行・文字数 1,048,576 文字まで保持します（`SerialSessionOptions.terminalBuffer` で変更可能）。 |
| `lines$` | **行単位の受信** — `\n` / `\r\n` / 内部の `\r` など実装に従い 1 行ずつ emit。**ログ・1 行ごとの解析**向け。`\r` をそのまま残す必要がある raw ターミナル表示には向かない。 |
| `errors$` | **Canonical error event channel** — 接続・読み取り・書き込み・クローズのすべての `SerialError`（fatal / non-fatal）。 |
| `connect$()` | ポート選択 → オープン → 内部 read pump 開始。 |
| `disconnect$()` | ポートを閉じ、pump を停止。セッションは `idle` に戻り再利用可能。 |
| `dispose$()` / `destroy$()` | セッションを**永久破棄**。接続を閉じ、すべての Observable を complete し、再利用不可にする。`dispose$` を優先し、`destroy$` はエイリアス。 |
| `send$(string \| Uint8Array)` | 送信を **FIFO** で直列化（並行 `send$` も呼び出し順）。 |
| `isBrowserSupported()` | `connect$` の前に使う、Web Serial 利用可否の同期的な `boolean`。 |

### SerialSessionStatus（早見表）

`state$` の各 variant は `status` フィールドを持ちます。コードでは **const オブジェクト**（例: `SerialSessionStatus.Connected` → `'connected'`）での比較を推奨します。

| 定数 | 値 | 意味 |
| --- | --- | --- |
| `SerialSessionStatus.Idle` | `'idle'` | ポート未接続。Web Serial 利用可能な場合の初期値。 |
| `SerialSessionStatus.Connecting` | `'connecting'` | `connect$` 実行中。 |
| `SerialSessionStatus.Connected` | `'connected'` | ポートが開き、内部 read pump が動作中。`portInfo` 付き。 |
| `SerialSessionStatus.Disconnecting` | `'disconnecting'` | `disconnect$` 実行中。 |
| `SerialSessionStatus.Unsupported` | `'unsupported'` | セッション生成時点で Web Serial が利用できない。 |
| `SerialSessionStatus.Error` | `'error'` | 接続まわりの致命エラー。`error` 付き。 |
| `SerialSessionStatus.Disposed` | `'disposed'` | `dispose$` により永久破棄。すべての Observable が complete。 |

**`receive$` と `lines$`:** 機器から来たバイト列を**そのまま**画面に反映する（シェル、`ls` のプログレス、`\r` で行を描き直す出力など）ときは **`receive$`** を使います。**改行区切りのログ**や**1 行ずつ処理するプロトコル**では **`lines$`** が適しています。ターミナル表示に **`lines$`** を繋ぐと、内部で `\r` を行境界として扱うため **上書き表示が壊れる**ことがあります。独自区切りは **`receive$` 上で RxJS を合成**します（[高度な使用方法 — 行単位のフレーミング](./ADVANCED_USAGE.ja.md)）。

**`isConnected$`（convenience）** — 読み取り専用の `Observable<boolean>` です。boolean だけ欲しい UI 分岐に使います。スピナー、エラーバナー、port info には **`state$`** の `state.status` narrowing を優先してください。

**`lines$`（行区切り）** — 組み込みの行分割。ターミナルのミラーや `\r` を保持したいときは **`receive$`** を購読します（[高度な使用方法 — 行単位のフレーミング](./ADVANCED_USAGE.ja.md)）。

### 最小サンプル

```typescript
import { createSerialSession, SerialSessionStatus } from '@gurezo/web-serial-rxjs';
import { filter } from 'rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  throw new Error('このブラウザでは Web Serial を利用できません');
}

session.lines$.subscribe(console.log);
session.errors$.subscribe(console.error);
session.state$
  .pipe(filter((s) => s.status === SerialSessionStatus.Connected))
  .subscribe((state) => {
    console.log(state.portInfo);
  });
session.connect$().subscribe();
session.send$('hello\r\n').subscribe();
```

実アプリでは `connect$` / `send$` の `subscribe` で `error` も扱ってください（`errors$` にも流れます）。手順の全体は [クイックスタート](./QUICK_START.ja.md) を参照してください。

## ドキュメント索引

| ドキュメント | 用途 |
| --- | --- |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポ全体の目次、サンプル索引、貢献の導線。 |
| **[クイックスタート](./QUICK_START.ja.md)** | 最短でポートを開いて購読するところまで。 |
| **[高度な使用方法](./ADVANCED_USAGE.ja.md)** | 行フレーミング、擬似リクエスト／レスポンス、リカバリ。 |
| **[API リファレンス](https://gurezo.github.io/web-serial-rxjs/modules.html)** | オプション、`SerialSessionState`、`SerialError` の詳細（TypeDoc）。表・図は [GitHub](./API_REFERENCE.ja.md) も参照。 |
| **[v2 → v3 マイグレーション](./MIGRATION_V3.ja.md)**（[English](./MIGRATION_V3.md)） | `state$` discriminated union、`SerialSessionStatus`、`context.cause`。 |
| **[v1 → v2 マイグレーション](./MIGRATION_V2.ja.md)**（[English](./MIGRATION_V2.md)） | 削除された v1 API からの対応表。 |
| **[Phase 5（アーカイブ）](./archive/MIGRATION_PHASE5.ja.md)** | 旧 v1 ドキュメントの参照用。 |

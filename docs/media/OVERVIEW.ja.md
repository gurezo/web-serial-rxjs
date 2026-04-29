# SerialSession（v2）の概要

<p align="center">
  <img src="../../assets/icon/web-serial-rxjs-icon.png" alt="web-serial-rxjs プロジェクトアイコン" width="512" />
</p>

このページは v2 公開 API の**考え方**をまとめたものです。各 `SerialSession` 面の役割、`SerialSessionState` と `state$` の対応、`receive$` と `lines$` の使い分け。オプション、エラーコード、型の詳細は [API リファレンス](https://gurezo.github.io/web-serial-rxjs/modules.html) を参照してください。

## 目次

- [機能](#機能)
- [対応フレームワーク](#対応フレームワーク)
- [SerialSession（v2）の全体像](#serialsessionv2の全体像)
- [ドキュメント索引](#ドキュメント索引)

## 機能

- **Session 指向のリアクティブ API**: 1 つの `SerialSession` が `state$` / `isConnected$` / `receive$` / `lines$` / `errors$` と `connect$` / `disconnect$` / `send$` を公開
- **UTF-8 テキストストリーム**: `receive$` は内部でストリーミング `TextDecoder` を用いてデコード済み。マルチバイト文字がチャンクにまたがっても正しく結合されます
- **順序保証された送信キュー**: 並行する `send$` 呼び出しも内部キューで FIFO 処理され、呼び出し順に書き込まれます
- **統一エラーチャネル**: すべての I/O エラーは `SerialError` に正規化され `errors$` に多重化されます
- **明示的なライフサイクル**: `state$` は `idle` / `connecting` / `connected` / `disconnecting` / `unsupported` / `error` を emit するので UI から直接駆動できます
- **TypeScript サポート**: 完全な TypeScript 型定義を同梱
- **フレームワーク非依存**: 任意の JavaScript/TypeScript フレームワークまたはバニラ JavaScript で利用可能

## 対応フレームワーク

このライブラリはフレームワーク非依存で、以下の環境で利用できます。

- Angular
- React
- Svelte
- Vanilla JavaScript / TypeScript

## SerialSession（v2）の全体像

`createSerialSession` が返す **SerialSession** だけを使います。公開 API は意図的に小さく、**ターミナルにそのまま出す出力**は **`receive$`**、**改行区切りのログや解析**は **`lines$`** が担当します。独自区切りが必要なときは **`receive$`** 上に RxJS で組み立てます（[高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)）。接続真偽は `isConnected$` も利用できます。

| 公開面 | 役割 |
| --- | --- |
| `state$` | **接続ライフサイクル** — `idle` / `connecting` / `connected` / `disconnecting` / `error` / `unsupported`。購読時に現在値をリプレイ。分岐は文字列直書きではなく **`SerialSessionState`** との比較を推奨。 |
| `SerialSessionState` | **状態定数** — エクスポートされる const object（例: `SerialSessionState.Connected`, `SerialSessionState.Idle`）。`state$` が emit する値と同じ。 |
| `isConnected$` | **接続中かどうか** — `state$` が `SerialSessionState.Connected` のときだけ `true`、それ以外は `false`（`state$` から `distinctUntilChanged` 付きで派生）。 |
| `receive$` | **生のデコードチャンク** — UTF-8 テキストを read pump が返すとおりに受け取る（行揃えではない。マルチバイト安全）。`\r` 等も保持。**ターミナル風の表示**や `\r` による上書き表示向け。 |
| `terminalText$` | **ターミナル表示向けの累積テキスト** — `receive$` 由来の表示用テキスト。`\r` による上書きを折りたたみつつ通常の改行挙動は維持するため、ターミナル風ビューへ 1 つの文字列をそのままバインドしたい場合に使います。 |
| `lines$` | **行単位の受信** — `\n` / `\r\n` / 内部の `\r` など実装に従い 1 行ずつ emit。**ログ・1 行ごとの解析**向け。`\r` をそのまま残す必要がある raw ターミナル表示には向かない。 |
| `errors$` | **すべての `SerialError`**（接続・読み取り・書き込み・クローズ）の主チャネル。 |
| `connect$()` | ポート選択 → オープン → 内部 read pump 開始。 |
| `disconnect$()` | ポートを閉じ、pump を停止。 |
| `send$(string \| Uint8Array)` | 送信を **FIFO** で直列化（並行 `send$` も呼び出し順）。 |
| `isBrowserSupported()` | `connect$` の前に使う、Web Serial 利用可否の同期的な `boolean`。 |

### SerialSessionState（早見表）

`state$` が emit する文字列のユニオンです。コードでは **const オブジェクト**（例: `SerialSessionState.Connected` → `'connected'`）での比較を推奨します。有効な遷移・例外系の扱いの詳細は [API リファレンスの SerialSessionState](https://gurezo.github.io/web-serial-rxjs/variables/SerialSessionState.html) および [GitHub 上の表・図](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.ja.md#serialsessionstate) を参照してください。

| 定数 | 値 | 意味 |
| --- | --- | --- |
| `SerialSessionState.Idle` | `'idle'` | ポート未接続。Web Serial 利用可能な場合の初期値。 |
| `SerialSessionState.Connecting` | `'connecting'` | `connect$` 実行中。 |
| `SerialSessionState.Connected` | `'connected'` | ポートが開き、内部 read pump が動作中。 |
| `SerialSessionState.Disconnecting` | `'disconnecting'` | `disconnect$` 実行中。 |
| `SerialSessionState.Unsupported` | `'unsupported'` | セッション生成時点で Web Serial が利用できない。 |
| `SerialSessionState.Error` | `'error'` | 接続まわりの致命エラー。`disconnect$` か新しいセッションで復帰。 |

**`receive$` と `lines$`:** 機器から来たバイト列を**そのまま**画面に反映する（シェル、`ls` のプログレス、`\r` で行を描き直す出力など）ときは **`receive$`** を使います。**改行区切りのログ**や**1 行ずつ処理するプロトコル**では **`lines$`** が適しています。ターミナル表示に **`lines$`** を繋ぐと、内部で `\r` を行境界として扱うため **上書き表示が壊れる**ことがあります。独自区切りは **`receive$` 上で RxJS を合成**します（[高度な使用方法 — 行単位のフレーミング](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)）。

**`isConnected$`（UI 用）** — 読み取り専用の `Observable<boolean>` です。`state$` を `SerialSessionState.Connected` と毎回比較しなくても接続有無の UI 分岐に使えます。独自ルールが必要な場合は、従来どおり `state$` から `map` で派生しても構いません。

**`lines$`（行区切り）** — 組み込みの行分割。ターミナルのミラーや `\r` を保持したいときは **`receive$`** を購読します（[高度な使用方法 — 行単位のフレーミング](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)）。

### 最小サンプル

```typescript
import { createSerialSession, SerialSessionState } from '@gurezo/web-serial-rxjs';
import { filter } from 'rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!session.isBrowserSupported()) {
  throw new Error('このブラウザでは Web Serial を利用できません');
}

session.lines$.subscribe(console.log);
session.errors$.subscribe(console.error);
session.state$
  .pipe(filter((s) => s === SerialSessionState.Connected))
  .subscribe(() => {
    /* 例: ポートが開いてから有効化する UI */
  });
session.connect$().subscribe();
session.send$('hello\r\n').subscribe();
```

実アプリでは `connect$` / `send$` の `subscribe` で `error` も扱ってください（`errors$` にも流れます）。手順の全体は [クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md) を参照してください。

## ドキュメント索引

| ドキュメント | 用途 |
| --- | --- |
| **リポジトリ [README](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md)** | モノレポ全体の目次、サンプル索引、貢献の導線。 |
| **[クイックスタート](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/QUICK_START.ja.md)** | 最短でポートを開いて購読するところまで。 |
| **[高度な使用方法](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/ADVANCED_USAGE.ja.md)** | 行フレーミング、擬似リクエスト／レスポンス、リカバリ。 |
| **[API リファレンス](https://gurezo.github.io/web-serial-rxjs/modules.html)** | オプション、`SerialSessionState`、`SerialError` の詳細（TypeDoc）。表・図は [GitHub](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/API_REFERENCE.ja.md) も参照。 |
| **[v1 → v2 マイグレーション](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.ja.md)**（[English](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/MIGRATION_V2.md)） | 削除された v1 API からの対応表。 |
| **[Phase 5（アーカイブ）](https://github.com/gurezo/web-serial-rxjs/blob/main/packages/web-serial-rxjs/docs/archive/MIGRATION_PHASE5.ja.md)** | 旧 v1 ドキュメントの参照用。 |

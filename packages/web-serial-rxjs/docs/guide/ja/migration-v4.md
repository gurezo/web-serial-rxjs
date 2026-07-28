# v4 への移行

v4 は Phase 1（[#472](https://github.com/gurezo/web-serial-rxjs/issues/472)）と Phase 2（[#485](https://github.com/gurezo/web-serial-rxjs/issues/485)）の公開 API 整理を、ひとつのメジャーアップグレードにまとめます。本ガイドは両フェーズを扱い、一度の移行で完了できるようにします。

v3 で導入された TypeScript 向けの変更（`SerialErrorCode` の const object、discriminated union の `state$`）は、引き続き [v3 への移行](./migration-v3.md) を参照してください。

## TL;DR

```typescript
import {
  createSerialSession,
  isWebSerialSupported,
  SerialSessionStatus,
} from '@gurezo/web-serial-rxjs';
import { shareReplay } from 'rxjs';

if (!isWebSerialSupported()) {
  // セッション生成前の fallback UI
}

const session = createSerialSession({ baudRate: 9600 });

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    // セッション生成後の unsupported UI
  }
});

// 用途に合ったストリームを選ぶ:
session.receive$.subscribe(/* デコード済みチャンク */);
session.lines$.subscribe(/* 完了した行 */);
session.terminalText$.subscribe(/* ターミナル表示用テキスト */);

// 以前 receiveReplay$ を使っていた場合は、operator を自分で組み合わせる。
// 削除された API のドロップイン置換ではない。
const replayedReceive$ = session.receive$.pipe(
  shareReplay({
    bufferSize: 1,
    refCount: true,
  }),
);
```

---

## Phase 1 API 削除

[#472](https://github.com/gurezo/web-serial-rxjs/issues/472) の Phase 1 では、重複・escape hatch な API を削除し、ライフサイクルと破棄の正規情報源を `state$` と `dispose$()` に統一しました。ドキュメント整備は [#478](https://github.com/gurezo/web-serial-rxjs/issues/478) です。

| 削除 API | 移行先 |
| --- | --- |
| `destroy$()` | `dispose$()` |
| `isConnected$` | `state$` の `state.status`（または `state$` から boolean を derive） |
| `portInfo$` | `state.status === SerialSessionStatus.Connected` 時の `state.portInfo` |
| `getPortInfo()` | 同上（Connected 時の `state.portInfo`） |
| `getCurrentPort()` | 直接の代替なし。識別は `state.portInfo`。生の `SerialPort` は公開しない |

詳細な例とチェックリスト: [v3 への移行 – Phase 1 API 削除](./migration-v3.md#phase-1-api-削除)。

---

## Phase 2 API 削除

[#485](https://github.com/gurezo/web-serial-rxjs/issues/485) の Phase 2 では、名前と挙動が一致しない派生 API や、セッション責務に属さないオプションを削除します。実装: [#486](https://github.com/gurezo/web-serial-rxjs/issues/486)、[#487](https://github.com/gurezo/web-serial-rxjs/issues/487)、[#488](https://github.com/gurezo/web-serial-rxjs/issues/488)。ドキュメント: [#490](https://github.com/gurezo/web-serial-rxjs/issues/490)。

| v3 以前 | v4 |
| --- | --- |
| `session.receiveReplay$` | `session.receive$` に必要な RxJS operator を明示的に組み合わせる |
| `options.receiveReplay` | 削除 |
| `session.isBrowserSupported()` | トップレベル `isWebSerialSupported()`、または `state$` の `Unsupported` |
| 混在・分かりにくい公開オプション | `SerialConnectionOptions` + `SerialSessionFeatureOptions` の構成へ |

### `receiveReplay$` と `receiveReplay` オプション

`receiveReplay$` は、セッション生成時に `receiveReplay.enabled` が有効な場合のみ過去チャンクを再通知しました。無効時は `receive$` と同じ非リプレイ動作になり、API 名と挙動が一致しませんでした。リプレイ対象はデコード済み受信チャンクのみで、`lines$` / `terminalText$` には適用されず、`bufferSize` と `maxChars` の両方を理解する必要がありました。

**v4 ではストリームとオプションの両方を削除します。** アプリ側でリプレイ相当が必要な場合は、`receive$` に operator を自分で組み合わせてください。

```typescript
import { shareReplay } from 'rxjs';

const replayedReceive$ = session.receive$.pipe(
  shareReplay({
    bufferSize: 1,
    refCount: true,
  }),
);
```

#### 完全互換ではない

このパターンは、削除された `receiveReplay$` API との **完全互換を保証しません**。

- `shareReplay` の `bufferSize` は **イベント数**であり、文字数ではない。旧オプションには `maxChars` もあった
- この例には **`maxChars` 相当の文字数上限は含まれない**
- 接続切替・切断・破棄をまたぐキャッシュ寿命はアプリ側で設計する必要がある
- エラーと complete の再通知（`shareReplay` の reset / refCount）は旧セッション所有バッファと異なる

`shareReplay` を削除機能の完全な代替として案内しないでください。

### ブラウザー対応判定

Web Serial の利用可否はセッションごとの状態ではありません。対応確認のためだけに `createSerialSession()` を呼ぶ形は責務が分かりにくくなっていました。

**セッション生成前**（同期的な feature detection）:

```typescript
import { isWebSerialSupported } from '@gurezo/web-serial-rxjs';

if (!isWebSerialSupported()) {
  // fallback UI
}
```

**セッション生成後**の UI では、ライフサイクルに沿う `state$` を推奨します。

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    // unsupported UI
  }
});
```

`session.isBrowserSupported()` は削除されています。関連: [API concepts – SerialSession / `isWebSerialSupported`](./concepts.md#serialsession)。

### セッションオプションの整理

`SerialSessionOptions` は引き続き単一の factory 引数ですが、責務の境界を明確にしています。

```text
SerialConnectionOptions     = port.open 向けの W3C 接続パラメータ
SerialSessionFeatureOptions = ライブラリ固有のセッション機能
SerialSessionOptions        = Partial<SerialConnectionOptions> & SerialSessionFeatureOptions
```

- **接続:** `baudRate`, `dataBits`, `stopBits`, `parity`, `bufferSize`, `flowControl`
- **機能:** `filters`, `terminalBuffer`, `lineBuffer`（`receiveReplay` は削除済み）

境界セマンティクス（バッファ上限のみ `0` = 無制限、接続フィールドは `> 0` 必須）は [API concepts – SerialSessionOptions](./concepts.md#serialsessionoptions) を参照してください。

---

## v4 で維持するストリーム

これらは重複ではなく、用途の異なる抽象化です。

| API | 用途 |
| --- | --- |
| `receive$` | 読み取りポンプからのデコード済み UTF-8 **チャンク** |
| `lines$` | 改行で区切られた **完了行**（ログ / プロトコル） |
| `terminalText$` | **ターミナル表示**向けの累積テキスト（`\r` 再描画を含む） |

フレーミング・未完成行・ターミナルバッファ上限を利用者が再実装しなくて済むよう、`SerialSession` 上に残します。詳細: [API concepts – SerialSession](./concepts.md#serialsession)。

---

## Phase 2 で変更しない仕様

次は v3 / Phase 1 完了時点の仕様を維持します。

- 操作 Observable（`connect$`、`send$`、`disconnect$`、`dispose$`）は **購読により実行**される（cold）
- Promise 形式の重複 API は追加しない
- `errors$` と操作 Observable のエラー通知仕様は維持する
- `lines$` / `terminalText$` を利用者側 operator へ移動しない
- Phase 2 で新しい selector / 便利 API は追加しない

目標とする公開形:

```typescript
export interface SerialSession {
  readonly state$: Observable<SerialSessionState>;
  readonly errors$: Observable<SerialError>;

  readonly receive$: Observable<string>;
  readonly lines$: Observable<string>;
  readonly terminalText$: Observable<string>;

  connect$(): Observable<void>;
  disconnect$(): Observable<void>;
  send$(data: SerialPayload): Observable<void>;
  dispose$(): Observable<void>;
}
```

加えてトップレベルヘルパー:

```typescript
export function isWebSerialSupported(): boolean;
```

---

## 移行チェックリスト

- [ ] `destroy$()` を `dispose$()` に置き換え、ライフサイクル UI は `state$` から駆動する
- [ ] `isConnected$` / `portInfo$` / `getPortInfo()` / `getCurrentPort()` を `state$` / `state.portInfo` に置き換える
- [ ] `receiveReplay$` の購読と `receiveReplay` オプションを削除する
- [ ] リプレイが必要なら `receive$` に RxJS operator を組み合わせ、上記の差異を受け入れる
- [ ] `session.isBrowserSupported()` を `isWebSerialSupported()` または `state$` の `Unsupported` に置き換える
- [ ] 削除された receive-replay エラーコード（`INVALID_RECEIVE_REPLAY_OPTIONS`、`RECEIVE_REPLAY_BUFFER_OVERFLOW`）の分岐をやめる
- [ ] `receive$` / `lines$` / `terminalText$` を用途で選び、互換エイリアスとして扱わない

---

## リリースノート（Phase 2）

- `SerialSession.receiveReplay$` と `SerialSessionOptions.receiveReplay` を削除
- 関連する receive-replay エラーコードと内部バッファ実装を削除
- `SerialSession.isBrowserSupported()` を削除し、トップレベル `isWebSerialSupported()` に統一
- `SerialSessionOptions` を接続フィールド + 機能オプション（`filters`、`terminalBuffer`、`lineBuffer`）として整理
- 公開 API 境界を回帰テストで固定（[#489](https://github.com/gurezo/web-serial-rxjs/issues/489)）

---

## 関連リンク

- [v3 への移行](./migration-v3.md) — `SerialErrorCode`、discriminated union の `state$`、Phase 1 の詳細節
- [v1 から v2 への移行](./migration-v2.md) — `SerialClient` → `SerialSession`（注: v4 のブラウザ判定は再びトップレベル）
- [API concepts and design notes](./concepts.md)
- 親 Issue [#485](https://github.com/gurezo/web-serial-rxjs/issues/485)

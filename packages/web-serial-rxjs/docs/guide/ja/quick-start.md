# クイックスタート

**最短で**シリアルポートを開き、行単位で受信し、送信・切断するところまで進む手順です。`state$` / `errors$` / `receive$` / `lines$` と各メソッドの一覧は、先に [SerialSession の概要](./overview.md#serialsessionの全体像)を参照してください。

標準的な改行区切り（`\n` / `\r\n`）には **`lines$`** を使います。**`receive$`** はデコーダが返す**未フレーミングの UTF-8 チャンク**（デコード済みテキスト。ワイヤ上の生バイトではない）です。ライフサイクル UI には **`state$`** の `state.status` narrowing を優先してください。boolean だけ必要な場合は `state$` から derive してください。**`connect$()`**、**`send$()`**、**`disconnect$()`**、**`dispose$()`** の実行タイミングは [命令メソッドの実行（cold Observable）](#命令メソッドの実行cold-observable) を参照してください — 購読したときだけ実行されます。

`receive$` / `lines$` / `terminalText$` の選び方は [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) を参照してください。

## 利用条件

- ページは **HTTPS** または **localhost**（[セキュアコンテキスト](https://developer.mozilla.org/ja/docs/Web/Security/Secure_Contexts)）で配信してください。localhost 以外の平文 `http://` では Web Serial は使えません。
- **`connect$()`** は **ユーザー操作**（ボタンクリックなど）から呼び出してください。そうでないとブラウザはポート選択ダイアログを開きません。

それでも失敗する場合（非対応ブラウザ、subscribe 漏れ、改行不一致、再接続など）は [トラブルシューティング](./troubleshooting.md) を参照してください。

## インストール

npm または pnpm でパッケージを導入します。

```bash
npm install @gurezo/web-serial-rxjs
# または
pnpm add @gurezo/web-serial-rxjs
```

### ピア依存関係

**RxJS** `^7.8.0` をピア依存関係として必要とします。

```bash
npm install rxjs
# または
pnpm add rxjs
```

パッケージは **ESM のみ**です。CI で検証していること、Examples と互換性の関係、TypeScript の扱いは [Bundler / framework 互換性の検証方針](./bundler-compatibility.md) を参照してください。

ブラウザの **API 実装状況**と本プロジェクトの **公式サポート**（および未検証のモバイル）の区別は [ブラウザサポートと公式サポート方針](./browser-support.md) を参照してください。モノレポ [README.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md) にもブラウザサポートの要約とサンプルアプリ索引があります。

## 命令メソッドの実行（cold Observable）

**`connect$()`**、**`send$()`**、**`disconnect$()`**、**`dispose$()`** は **cold** な Observable を返します。呼び出すだけでは Observable が組み立てられるだけで、**subscribe されるまで処理は開始されません**（subscribe を伴うオペレータを使う場合も同様です）。

**`state$`**、**`lines$`**、**`errors$`** などのセッションストリームとは異なります。それらは必要なタイミングで早めに購読し、命令的な操作は以下のメソッド経由で実行してください。

### やってはいけない例

```typescript
// NG: ダイアログも送信も破棄も起きない — この行だけでは何も実行されない
session.connect$();
session.send$('AT\r\n');
session.disconnect$();
session.dispose$();
```

### パターン 1 — subscribe（fire-and-forget）

ボタンハンドラなどから `.subscribe()` します。本番では必ず `error` を処理してください。

```typescript
document.getElementById('connect')?.addEventListener('click', () => {
  session.connect$().subscribe({
    error: (e) => console.error('接続エラー:', e),
  });
});

document.getElementById('disconnect')?.addEventListener('click', () => {
  session.disconnect$().subscribe({
    error: (e) => console.error('切断エラー:', e),
  });
});
```

### パターン 2 — `firstValueFrom()` と async/await

1 回きりの Observable を Promise に変換し、`async`/`await` で直列に書く場合に使います。

```typescript
import { firstValueFrom } from 'rxjs';
import { createSerialSession } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

async function runOnce(): Promise<void> {
  try {
    await firstValueFrom(session.connect$());
    await firstValueFrom(session.send$('AT\r\n'));
    await firstValueFrom(session.disconnect$());
  } catch (e) {
    console.error('シリアル操作失敗:', e);
  }
}
```

`firstValueFrom` は最初の emission で完了します（エラー時は throw）。すべての命令メソッドに同じルールが適用されます。

### パターン 3 — RxJS パイプライン内

`switchMap` や `concatMap` などで命令ステップをチェーンし、購読を 1 か所にまとめます。

```typescript
import { concatMap, from, of } from 'rxjs';

from(['AT\r\n', 'ATI\r\n']).pipe(
  concatMap((cmd) => session.send$(cmd)),
).subscribe({
  error: (e) => console.error('送信エラー:', e),
});

// 接続してから 1 回送信
of(undefined).pipe(
  concatMap(() => session.connect$()),
  concatMap(() => session.send$('hello\r\n')),
).subscribe({
  error: (e) => console.error('パイプラインエラー:', e),
});
```

より複雑なパイプライン（要求/応答、タイムアウト、リトライ）は [高度な使用方法](./advanced-usage.md) と [要求 / 応答](./request-response.md) を参照してください。

## 接続・受信・送信

### SerialSessionStatus（早見表）

| 定数 | 値 | 意味 |
| --- | --- | --- |
| `SerialSessionStatus.Idle` | `'idle'` | ポート未接続。Web Serial 利用可能な場合の初期値。 |
| `SerialSessionStatus.Connecting` | `'connecting'` | `connect$` 実行中。 |
| `SerialSessionStatus.Connected` | `'connected'` | ポートが開き、read pump が動作中（`portInfo` 付き）。 |
| `SerialSessionStatus.Disconnecting` | `'disconnecting'` | `disconnect$` 実行中。 |
| `SerialSessionStatus.Unsupported` | `'unsupported'` | セッション生成時点で Web Serial が利用できない。 |
| `SerialSessionStatus.Error` | `'error'` | 致命的な失敗（`error` 付き）。 |
| `SerialSessionStatus.Disposed` | `'disposed'` | `dispose$` により永久破棄。すべての Observable が complete。 |

詳細は [概念と設計メモ](./concepts.md#serialsessionstate--serialsessionstatus) と [v3 移行ガイド](./migration-v3.md) を参照してください。

```typescript
import { createSerialSession, isWebSerialSupported } from '@gurezo/web-serial-rxjs';

const session = createSerialSession({ baudRate: 115200 });

if (!isWebSerialSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
}

session.lines$.subscribe((line) => console.log('行:', line));

// 本番では errors$ を購読して SerialError を扱うことを推奨します
session.errors$.subscribe((err) => console.error('シリアルエラー:', err));

session.connect$().subscribe({
  next: () => {
    session.send$('ls\r\n').subscribe({
      error: (e) => console.error('送信エラー:', e),
    });
  },
  error: (e) => console.error('接続エラー:', e),
});
```

## ライフサイクル監視（`state$`）

`state$` の分岐は **`state.status`** を **`SerialSessionStatus`** の定数と比較します。connected 時は TypeScript narrowing により **`state.portInfo`** に型安全にアクセスできます。

```typescript
import { SerialSessionStatus } from '@gurezo/web-serial-rxjs';

session.state$.subscribe((state) => {
  if (state.status === SerialSessionStatus.Unsupported) {
    console.warn('このブラウザでは Web Serial を利用できません');
  }
  if (state.status === SerialSessionStatus.Connected) {
    console.log(state.portInfo);
  }
});
```

## エラーハンドリング（`errors$`）

**`errors$`** は接続・読み取り・書き込み・クローズで発生するすべての `SerialError` を流す **canonical error event channel** です。`connect$().subscribe({ error })` で受け取るエラーは `errors$` に流れるものと同一インスタンスです。

- **fatal** — read pump の停止やポート teardown を伴う。`state$` が `{ status: 'error', error }` に遷移する
- **non-fatal** — セッションは継続する（例: `WRITE_FAILED`、`LINE_BUFFER_OVERFLOW`）

```typescript
import { SerialErrorCode } from '@gurezo/web-serial-rxjs';

session.errors$.subscribe((error) => {
  if (error.is(SerialErrorCode.READ_FAILED)) {
    console.error('読み取り失敗:', error.context.cause);
  }
  if (error.is(SerialErrorCode.WRITE_FAILED)) {
    console.warn('送信失敗（セッションは継続）:', error.context.cause);
  }
});
```

エラーコード一覧と `context` の形は [概念と設計メモ](./concepts.md#serialerror--serialerrorcode) を参照してください。

## 切断する

ポートを閉じつつセッションを再利用可能なままにしたいときは `disconnect$` を呼びます。

```typescript
session.disconnect$().subscribe({
  error: (e) => console.error('切断エラー:', e),
});
```

## 破棄する（リソース解放）

baud rate 変更で session を作り替えるなど、セッション自体を完全に手放すときは `dispose$` を呼びます。アクティブな接続を閉じ、すべての Observable を complete します。

```typescript
session.dispose$().subscribe({
  error: (e) => console.error('破棄エラー:', e),
});
```

破棄後は古いインスタンスを再利用せず、新しい `createSerialSession()` を作成してください。

## 次のステップ

- 公開メソッドとストリームの一覧は [概念と設計メモ](./concepts.md) を参照してください。
- チャンク単位の受信、送信の順序制御、エラー分岐の詳細、ポートフィルタなどは [高度な使用方法](./advanced-usage.md) を参照してください。
- 接続や送受信の問題は [トラブルシューティング](./troubleshooting.md) を参照してください。
- v2 型モデルからの移行は [v2 → v3 マイグレーション](./migration-v3.md) を参照してください。
- v1 からの移行は [v1 → v2 マイグレーション](./migration-v2.md) を参照してください。

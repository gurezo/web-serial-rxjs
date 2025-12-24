# web-serial-rxjs

Web Serial API を RxJS ベースのリアクティブなラッパーで提供する TypeScript ライブラリです。Web アプリケーションでシリアルポート通信を簡単に実現できます。

## 目次

- [機能](#機能)
- [ブラウザサポート](#ブラウザサポート)
- [インストール](#インストール)
- [クイックスタート](#クイックスタート)
- [使用例](#使用例)
- [API リファレンス](#api-リファレンス)
- [フレームワーク別の例](#フレームワーク別の例)
- [高度な使用方法](#高度な使用方法)
- [貢献](#貢献)
- [ライセンス](#ライセンス)
- [リンク](#リンク)

## 機能

- **RxJS ベースのリアクティブ API**: RxJS Observables を活用したリアクティブなシリアルポート通信
- **TypeScript サポート**: 完全な TypeScript 型定義を含む
- **ブラウザ検出**: ブラウザサポートの検出とエラーハンドリング機能を内蔵
- **エラーハンドリング**: カスタムエラークラスとエラーコードによる包括的なエラーハンドリング
- **フレームワーク非依存**: 任意の JavaScript/TypeScript フレームワークまたはバニラ JavaScript で使用可能

## ブラウザサポート

Web Serial API は現在、Chromium ベースのブラウザでのみサポートされています：

- **Chrome** 89+
- **Edge** 89+
- **Opera** 75+

このライブラリには、使用前に Web Serial API のサポートを確認するためのブラウザ検出ユーティリティが含まれています。

## インストール

npm または pnpm を使用してパッケージをインストールします：

```bash
npm install @web-serial-rxjs/web-serial-rxjs
# または
pnpm add @web-serial-rxjs/web-serial-rxjs
```

### ピア依存関係

このライブラリは RxJS をピア依存関係として必要とします：

```bash
npm install rxjs
# または
pnpm add rxjs
```

**最小要件バージョン**: RxJS ^7.8.0

## クイックスタート

簡単な使用例：

```typescript
import {
  createSerialClient,
  isBrowserSupported,
} from '@web-serial-rxjs/web-serial-rxjs';

// ブラウザサポートをチェック
if (!isBrowserSupported()) {
  console.error('このブラウザは Web Serial API をサポートしていません');
  return;
}

// シリアルクライアントを作成
const client = createSerialClient({ baudRate: 9600 });

// シリアルポートに接続
client.connect().subscribe({
  next: () => {
    console.log('シリアルポートに接続しました');

    // シリアルポートからデータを読み取る
    client.getReadStream().subscribe({
      next: (data: Uint8Array) => {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        console.log('受信:', text);
      },
      error: (error) => {
        console.error('読み取りエラー:', error);
      },
    });

    // シリアルポートにデータを書き込む
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello, Serial Port!\n');
    client.write(data).subscribe({
      next: () => console.log('データを書き込みました'),
      error: (error) => console.error('書き込みエラー:', error),
    });
  },
  error: (error) => {
    console.error('接続エラー:', error);
  },
});
```

## 使用例

### 基本的な接続

```typescript
import { createSerialClient } from '@web-serial-rxjs/web-serial-rxjs';

const client = createSerialClient({
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});

// 接続（ユーザーにポート選択を促す）
client.connect().subscribe({
  next: () => console.log('接続しました'),
  error: (error) => console.error('接続に失敗しました:', error),
});
```

### データの読み取り

```typescript
import { createSerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import { map } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // データを読み取ってデコード
    client
      .getReadStream()
      .pipe(
        map((data: Uint8Array) => {
          const decoder = new TextDecoder('utf-8');
          return decoder.decode(data);
        }),
      )
      .subscribe({
        next: (text) => console.log('受信:', text),
        error: (error) => console.error('読み取りエラー:', error),
      });
  },
});
```

### データの書き込み

```typescript
import { createSerialClient } from '@web-serial-rxjs/web-serial-rxjs';
import { from } from 'rxjs';
import { map } from 'rxjs/operators';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => {
    // 単一のチャンクを書き込む
    const encoder = new TextEncoder();
    const data = encoder.encode('Hello\n');
    client.write(data).subscribe({
      next: () => console.log('書き込みました'),
      error: (error) => console.error('書き込みエラー:', error),
    });

    // Observable ストリームから書き込む
    const messages = ['メッセージ 1\n', 'メッセージ 2\n', 'メッセージ 3\n'];
    const dataStream$ = from(messages).pipe(
      map((msg) => new TextEncoder().encode(msg)),
    );
    client.writeStream(dataStream$).subscribe({
      next: () => console.log('すべてのメッセージを書き込みました'),
      error: (error) => console.error('ストリーム書き込みエラー:', error),
    });
  },
});
```

### エラーハンドリング

```typescript
import {
  createSerialClient,
  SerialError,
  SerialErrorCode,
} from '@web-serial-rxjs/web-serial-rxjs';

const client = createSerialClient({ baudRate: 9600 });

client.connect().subscribe({
  next: () => console.log('接続しました'),
  error: (error) => {
    if (error instanceof SerialError) {
      switch (error.code) {
        case SerialErrorCode.BROWSER_NOT_SUPPORTED:
          console.error('ブラウザが Web Serial API をサポートしていません');
          break;
        case SerialErrorCode.PORT_NOT_AVAILABLE:
          console.error('シリアルポートが利用できません');
          break;
        case SerialErrorCode.CONNECTION_LOST:
          console.error('接続が切断されました');
          break;
        default:
          console.error('シリアルエラー:', error.message);
      }
    } else {
      console.error('不明なエラー:', error);
    }
  },
});
```

### ポートフィルタリング

```typescript
import { createSerialClient } from '@web-serial-rxjs/web-serial-rxjs';

// USB ベンダー ID でポートをフィルタリング
const client = createSerialClient({
  baudRate: 9600,
  filters: [{ usbVendorId: 0x1234 }, { usbVendorId: 0x5678 }],
});

// 特定のポートをリクエスト
client.requestPort().subscribe({
  next: (port) => {
    console.log('ポートが選択されました:', port);
    // 選択されたポートに接続
    client.connect(port).subscribe({
      next: () => console.log('フィルタリングされたポートに接続しました'),
      error: (error) => console.error('接続エラー:', error),
    });
  },
  error: (error) => console.error('ポートリクエストエラー:', error),
});
```

## API リファレンス

### `createSerialClient(options?)`

新しい `SerialClient` インスタンスを作成します。

**パラメータ:**

- `options?` (オプション): `SerialClientOptions` - シリアルクライアントの設定オプション

**戻り値:** `SerialClient` - 新しい SerialClient インスタンス

**例:**

```typescript
const client = createSerialClient({
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
});
```

### `SerialClient` インターフェース

シリアルポートと対話するためのメインインターフェースです。

#### メソッド

##### `requestPort(): Observable<SerialPort>`

ユーザーからシリアルポートをリクエストします。ポート選択のためのブラウザダイアログを開きます。

**戻り値:** `Observable<SerialPort>` - 選択された `SerialPort` インスタンスを発行

##### `getPorts(): Observable<SerialPort[]>`

ユーザーが以前にアクセスを許可したすべての利用可能なシリアルポートを取得します。

**戻り値:** `Observable<SerialPort[]>` - 利用可能な `SerialPort` インスタンスの配列を発行

##### `connect(port?: SerialPort): Observable<void>`

シリアルポートに接続します。ポートが提供されない場合、ユーザーにリクエストします。

**パラメータ:**

- `port?` (オプション): `SerialPort` - 接続するポート

**戻り値:** `Observable<void>` - ポートが開かれたときに完了

##### `disconnect(): Observable<void>`

シリアルポートから切断します。

**戻り値:** `Observable<void>` - ポートが閉じられたときに完了

##### `getReadStream(): Observable<Uint8Array>`

シリアルポートから読み取ったデータを発行する Observable を取得します。

**戻り値:** `Observable<Uint8Array>` - データが受信されると `Uint8Array` チャンクを発行

##### `writeStream(data$: Observable<Uint8Array>): Observable<void>`

Observable ストリームからシリアルポートにデータを書き込みます。

**パラメータ:**

- `data$`: `Observable<Uint8Array>` - 書き込む `Uint8Array` チャンクを発行する Observable

**戻り値:** `Observable<void>` - 書き込みが完了したときに完了

##### `write(data: Uint8Array): Observable<void>`

シリアルポートに単一のデータチャンクを書き込みます。

**パラメータ:**

- `data`: `Uint8Array` - 書き込むデータ

**戻り値:** `Observable<void>` - データが書き込まれたときに完了

#### プロパティ

- `connected: boolean` - ポートが現在開いているかどうかを示す読み取り専用プロパティ
- `currentPort: SerialPort | null` - 現在の `SerialPort` インスタンス、または接続されていない場合は `null` の読み取り専用プロパティ

### `SerialClientOptions` インターフェース

`SerialClient` を作成するための設定オプションです。

```typescript
interface SerialClientOptions {
  baudRate?: number; // デフォルト: 9600
  dataBits?: 7 | 8; // デフォルト: 8
  stopBits?: 1 | 2; // デフォルト: 1
  parity?: 'none' | 'even' | 'odd'; // デフォルト: 'none'
  bufferSize?: number; // デフォルト: 255
  flowControl?: 'none' | 'hardware'; // デフォルト: 'none'
  filters?: SerialPortFilter[]; // オプションのポートフィルター
}
```

**オプション:**

- `baudRate` (オプション): 通信速度（ビット/秒）。デフォルト: `9600`
- `dataBits` (オプション): 文字あたりのデータビット数。`7` または `8`。デフォルト: `8`
- `stopBits` (オプション): ストップビット数。`1` または `2`。デフォルト: `1`
- `parity` (オプション): パリティチェックモード。`'none'`、`'even'`、または `'odd'`。デフォルト: `'none'`
- `bufferSize` (オプション): 読み取りバッファのサイズ。デフォルト: `255`
- `flowControl` (オプション): フロー制御モード。`'none'` または `'hardware'`。デフォルト: `'none'`
- `filters` (オプション): 利用可能なポートをフィルタリングする `SerialPortFilter` オブジェクトの配列

### エラーハンドリング

#### `SerialError` クラス

シリアルポート操作のためのカスタムエラークラスです。

```typescript
class SerialError extends Error {
  readonly code: SerialErrorCode;
  readonly originalError?: Error;

  is(code: SerialErrorCode): boolean;
}
```

**プロパティ:**

- `code`: `SerialErrorCode` - エラーコード
- `originalError?`: `Error` - このエラーを引き起こした元のエラー（存在する場合）

**メソッド:**

- `is(code: SerialErrorCode): boolean` - エラーが特定のエラーコードと一致するかチェック

#### `SerialErrorCode` 列挙型

さまざまなタイプのシリアルポートエラーのエラーコード：

- `BROWSER_NOT_SUPPORTED` - ブラウザが Web Serial API をサポートしていない
- `PORT_NOT_AVAILABLE` - シリアルポートが利用できない
- `PORT_OPEN_FAILED` - シリアルポートを開くのに失敗した
- `PORT_ALREADY_OPEN` - シリアルポートは既に開いている
- `PORT_NOT_OPEN` - シリアルポートが開いていない
- `READ_FAILED` - シリアルポートからの読み取りに失敗した
- `WRITE_FAILED` - シリアルポートへの書き込みに失敗した
- `CONNECTION_LOST` - シリアルポート接続が切断された
- `INVALID_FILTER_OPTIONS` - 無効なフィルターオプション
- `OPERATION_CANCELLED` - 操作がキャンセルされた
- `UNKNOWN` - 不明なエラー

### ブラウザ検出ユーティリティ

#### `isBrowserSupported(): boolean`

ブラウザが Web Serial API をサポートしているかチェックします（例外を投げないバージョン）。

**戻り値:** `boolean` - サポートされている場合は `true`、それ以外は `false`

#### `checkBrowserSupport(): void`

ブラウザが Web Serial API をサポートしているかチェックします。サポートされていない場合は `SerialError` を投げます。

**例外:** Web Serial API をサポートしていない場合、`BROWSER_NOT_SUPPORTED` コードを持つ `SerialError` を投げます

#### `detectBrowserType(): BrowserType`

ユーザーエージェントからブラウザタイプを検出します。

**戻り値:** `BrowserType` - `CHROME`、`EDGE`、`OPERA`、または `UNKNOWN` のいずれか

#### `hasWebSerialSupport(): boolean`

機能検出を使用してブラウザが Web Serial API サポートを持っているかチェックします。

**戻り値:** `boolean` - Web Serial API が利用可能な場合は `true`、それ以外は `false`

### I/O ユーティリティ

#### `readableToObservable(stream: ReadableStream<Uint8Array>): Observable<Uint8Array>`

`ReadableStream` を RxJS `Observable` に変換します。

**パラメータ:**

- `stream`: `ReadableStream<Uint8Array>` - 変換するストリーム

**戻り値:** `Observable<Uint8Array>` - データチャンクを発行する Observable

#### `observableToWritable(observable: Observable<Uint8Array>): WritableStream<Uint8Array>`

RxJS `Observable` を `WritableStream` に変換します。

**パラメータ:**

- `observable`: `Observable<Uint8Array>` - 変換する observable

**戻り値:** `WritableStream<Uint8Array>` - observable からデータを書き込む書き込み可能なストリーム

#### `subscribeToWritable(observable: Observable<Uint8Array>, stream: WritableStream<Uint8Array>): { unsubscribe: () => void }`

Observable を購読し、その値を WritableStream に書き込みます。

**パラメータ:**

- `observable`: `Observable<Uint8Array>` - 購読する observable
- `stream`: `WritableStream<Uint8Array>` - 書き込むストリーム

**戻り値:** `unsubscribe()` メソッドを持つ購読オブジェクト

## フレームワーク別の例

このリポジトリには、さまざまなフレームワークで web-serial-rxjs を使用する方法を示すサンプルアプリケーションが含まれています：

- **[Vanilla JavaScript](apps/example-vanilla-js/)** - バニラ JavaScript での基本的な使用方法
- **[Vanilla TypeScript](apps/example-vanilla-ts/)** - RxJS を使用した TypeScript の例
- **[React](apps/example-react/)** - カスタムフック（`useSerialClient`）を使用した React の例
- **[Vue](apps/example-vue/)** - Composition API を使用した Vue 3 の例
- **[Svelte](apps/example-svelte/)** - Svelte Store を使用した Svelte の例
- **[Angular](apps/example-angular/)** - Service を使用した Angular の例

各例には、セットアップと使用方法の説明を含む README が含まれています。

## 高度な使用方法

### Observable パターン

RxJS オペレーターを使用してシリアルデータを処理できます：

```typescript
import { map, filter, bufferTime } from 'rxjs/operators';

client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    filter((text) => text.trim().length > 0),
    bufferTime(1000), // 1 秒間メッセージをバッファリング
  )
  .subscribe({
    next: (messages) => {
      console.log('バッファリングされたメッセージ:', messages);
    },
  });
```

### ストリーム処理

RxJS オペレーターでデータストリームを処理：

```typescript
import { map, scan, debounceTime } from 'rxjs/operators';

// 受信データを累積
client
  .getReadStream()
  .pipe(
    map((data: Uint8Array) => {
      const decoder = new TextDecoder('utf-8');
      return decoder.decode(data);
    }),
    scan((acc, current) => acc + current, ''),
    debounceTime(500),
  )
  .subscribe({
    next: (accumulated) => {
      console.log('累積データ:', accumulated);
    },
  });
```

### カスタムフィルター

ポートフィルターを使用して利用可能なポートを制限：

```typescript
const client = createSerialClient({
  baudRate: 9600,
  filters: [
    { usbVendorId: 0x1234, usbProductId: 0x5678 },
    { usbVendorId: 0xabcd },
  ],
});
```

### エラー回復

エラー回復パターンを実装：

```typescript
import { retry, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

client
  .getReadStream()
  .pipe(
    retry({
      count: 3,
      delay: 1000,
    }),
    catchError((error) => {
      console.error('リトライ後も失敗:', error);
      return of(null); // 空の observable を返す
    }),
  )
  .subscribe({
    next: (data) => {
      if (data) {
        console.log('受信:', data);
      }
    },
  });
```

## 貢献

貢献を歓迎します！詳細については、[貢献ガイド](CONTRIBUTING.ja.md)を参照してください：

- 開発環境のセットアップ
- コードスタイルガイドライン
- コミットメッセージの規約
- プルリクエストのプロセス

英語版の貢献ガイドは [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス

このプロジェクトは MIT ライセンスの下で公開されています。詳細は [LICENSE](LICENSE) ファイルを参照してください。

## リンク

- **GitHub リポジトリ**: [https://github.com/gurezo/web-serial-rxjs](https://github.com/gurezo/web-serial-rxjs)
- **イシュー**: [https://github.com/gurezo/web-serial-rxjs/issues](https://github.com/gurezo/web-serial-rxjs/issues)
- **Web Serial API 仕様**: [https://wicg.github.io/serial/](https://wicg.github.io/serial/)

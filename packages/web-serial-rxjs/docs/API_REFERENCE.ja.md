# API リファレンス

## `createSerialClient(options?)`

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

## `SerialClient` インターフェース

シリアルポートと対話するためのメインインターフェースです。

### メソッド

#### `requestPort(): Observable<SerialPort>`

ユーザーからシリアルポートをリクエストします。ポート選択のためのブラウザダイアログを開きます。

**戻り値:** `Observable<SerialPort>` - 選択された `SerialPort` インスタンスを発行

#### `getPorts(): Observable<SerialPort[]>`

ユーザーが以前にアクセスを許可したすべての利用可能なシリアルポートを取得します。

**戻り値:** `Observable<SerialPort[]>` - 利用可能な `SerialPort` インスタンスの配列を発行

#### `connect(port?: SerialPort): Observable<void>`

シリアルポートに接続します。ポートが提供されない場合、ユーザーにリクエストします。

**パラメータ:**

- `port?` (オプション): `SerialPort` - 接続するポート

**戻り値:** `Observable<void>` - ポートが開かれたときに完了

#### `disconnect(): Observable<void>`

シリアルポートから切断します。

**戻り値:** `Observable<void>` - ポートが閉じられたときに完了

#### `getReadStream(): Observable<Uint8Array>`

シリアルポートから読み取ったデータを発行する Observable を取得します。

**戻り値:** `Observable<Uint8Array>` - データが受信されると `Uint8Array` チャンクを発行

#### `writeStream(data$: Observable<Uint8Array>): Observable<void>`

Observable ストリームからシリアルポートにデータを書き込みます。

**パラメータ:**

- `data$`: `Observable<Uint8Array>` - 書き込む `Uint8Array` チャンクを発行する Observable

**戻り値:** `Observable<void>` - 書き込みが完了したときに完了

#### `write(data: Uint8Array): Observable<void>`

シリアルポートに単一のデータチャンクを書き込みます。

**パラメータ:**

- `data`: `Uint8Array` - 書き込むデータ

**戻り値:** `Observable<void>` - データが書き込まれたときに完了

### プロパティ

- `connected: boolean` - ポートが現在開いているかどうかを示す読み取り専用プロパティ
- `currentPort: SerialPort | null` - 現在の `SerialPort` インスタンス、または接続されていない場合は `null` の読み取り専用プロパティ

## `SerialClientOptions` インターフェース

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

## エラーハンドリング

### `SerialError` クラス

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

### `SerialErrorCode` 列挙型

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

## ブラウザ検出ユーティリティ

### `isBrowserSupported(): boolean`

ブラウザが Web Serial API をサポートしているかチェックします（例外を投げないバージョン）。

**戻り値:** `boolean` - サポートされている場合は `true`、それ以外は `false`

### `checkBrowserSupport(): void`

ブラウザが Web Serial API をサポートしているかチェックします。サポートされていない場合は `SerialError` を投げます。

**例外:** Web Serial API をサポートしていない場合、`BROWSER_NOT_SUPPORTED` コードを持つ `SerialError` を投げます

### `detectBrowserType(): BrowserType`

ユーザーエージェントからブラウザタイプを検出します。

**戻り値:** `BrowserType` - `CHROME`、`EDGE`、`OPERA`、または `UNKNOWN` のいずれか

### `hasWebSerialSupport(): boolean`

機能検出を使用してブラウザが Web Serial API サポートを持っているかチェックします。

**戻り値:** `boolean` - Web Serial API が利用可能な場合は `true`、それ以外は `false`

## I/O ユーティリティ

### `readableToObservable(stream: ReadableStream<Uint8Array>): Observable<Uint8Array>`

`ReadableStream` を RxJS `Observable` に変換します。

**パラメータ:**

- `stream`: `ReadableStream<Uint8Array>` - 変換するストリーム

**戻り値:** `Observable<Uint8Array>` - データチャンクを発行する Observable

### `observableToWritable(observable: Observable<Uint8Array>): WritableStream<Uint8Array>`

RxJS `Observable` を `WritableStream` に変換します。

**パラメータ:**

- `observable`: `Observable<Uint8Array>` - 変換する observable

**戻り値:** `WritableStream<Uint8Array>` - observable からデータを書き込む書き込み可能なストリーム

### `subscribeToWritable(observable: Observable<Uint8Array>, stream: WritableStream<Uint8Array>): { unsubscribe: () => void }`

Observable を購読し、その値を WritableStream に書き込みます。

**パラメータ:**

- `observable`: `Observable<Uint8Array>` - 購読する observable
- `stream`: `WritableStream<Uint8Array>` - 書き込むストリーム

**戻り値:** `unsubscribe()` メソッドを持つ購読オブジェクト

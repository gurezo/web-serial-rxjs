# バイナリ受信 API — 設計判断

本ページは、将来のバイナリ受信 API（例: `receiveBytes$`）に関する**設計検討**の記録です。実装仕様ではなく、現行リリースで公開の `Uint8Array` 受信ストリームを追加するものでもありません。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#545](https://github.com/gurezo/web-serial-rxjs/issues/545) · 関連: [対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード) · [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) · [v1 → v2 マイグレーション](./migration-v2.md)

## 推奨判断（現状）

**当面、`receiveBytes$`（および公開のワイヤバイト受信ストリーム）は追加しない。**

既存のテキスト API や、利用側での Web Serial 直接利用では足りないという具体的な需要が確認され、複雑性の増加に見合う価値がある場合にのみ再検討する。

| 判断 | 状態 |
| --- | --- |
| いま公開 API にバイナリ受信を追加する | **しない**（defer） |
| 現行の対応範囲を明文化する | 済み（[対応範囲](./concepts.md#対応範囲テキスト--バイナリ--文字コード)、[#540](https://github.com/gurezo/web-serial-rxjs/issues/540)） |
| 将来再検討時の preferred 形状 | 加算的 opt-in（[加算的スケッチ](#将来再検討時の加算的スケッチ)） |
| 実装 | 本設計メモとは**別 Issue・別 PR** |

親 Issue [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) の方針（コア API を安易に増やさない。ギャップが証明されるまで既存ストリームと Recipes を優先）と整合します。

## 現状の挙動

本ライブラリは **UTF-8 テキスト中心**です。

- 内部の read pump は `port.readable`（`ReadableStream<Uint8Array>`）を読み、直後にストリーミング `TextDecoder`（UTF-8、`fatal: false`、`stream: true`）でデコードする
- `receive$` / `lines$` / `terminalText$` はいずれも、そのデコード済みチャンク由来の `Observable<string>`
- バイナリ**送信**（`send$(Uint8Array)`）は対応、バイナリ**受信**は非対応。バイナリについては送受信が非対称
- ドキュメントや JSDoc で言う `receive$` の **「raw」は行未分割のデコード済みテキスト**であり、ワイヤ上の生バイトではない

公開のエンコーディングオプションやバイトストリームは、現状ありません。

## ユースケース判定

生バイトが**必須**か、テキストストリームで足りるかを切り分けます。

| 要件 | 現行 API との適合 |
| --- | --- |
| 改行／プロンプトのテキストプロトコル、シェル、ログ | `lines$` / `receive$` / `terminalText$` を使う |
| デコード済みチャンク上のカスタム**テキスト**フレーミング | `receive$` 上で RxJS を合成（[高度な使用方法](./advanced-usage.md)） |
| Modbus RTU、COBS、SLIP、独自**バイナリ**フレーム | **コアの対象外** — 利用側（または本ライブラリ外）で扱う |
| UTF-8 以外の文字コード（例: Shift_JIS） | **非対応**。バイト先行でもアプリ側デコードが必要 |
| 不正な UTF-8 / 任意オクテットを保持する必要がある | `TextDecoder` **より前**のワイヤバイトが必要 — 現行 pump では不可 |

**ゲート:** 共有セッションのライフサイクルが複数の実利用者に必要で、かつ Web Serial を自前で開く／デコード済みテキストでは合理的に足りない場合にのみ、ライブラリのバイトストリーム追加を検討する。

デコード済み文字列の再エンコード（`new TextEncoder().encode(chunk)`）は、元のワイヤバイトを**復元しない**。不正 UTF-8 やバイナリプロトコルでは損失がある。`receiveBytes$` の代替にしてはいけません。

## 技術論点

### チャンク境界と `ReadableStream` の read サイズ

Web Serial が渡す `Uint8Array` のサイズはブラウザ／OS 側の都合であり、**アプリプロトコルのフレーム境界ではない**。

- 1 論理フレームが多数の read にまたがることがある
- 1 回の read に複数フレームや途中フレームが含まれることがある
- 将来の `receiveBytes$` も **未フレーミングのバイトチャンク** を emit する。長さ前置・CRC・COBS などのフレーミングは利用側の責務 — `receive$` の「チャンク境界に依存しない」と同じ（[選び方](./stream-selection.md#チャンク境界に依存しない)）

### 同一 read loop からの fan-out

ポートの `readable` は**1 本**で、アクティブな reader も実質 1 つです。テキスト用とバイト用で別々に `getReader()` を持つことはできません。

バイト API を将来追加する場合の preferred 内部形状:

1. pump で `Uint8Array` を読む
2. バイト購読者へ（コピー、または所有権を明記した）multicast
3. **その後**に既存テキスト経路用の `TextDecoder` を実行（`receive$` → `lines$` / `terminalText$`）

バイトはデコード**前**に取る必要があります。バイナリを先に `TextDecoder` へ通し、あとからオクテットを復元しようとするのは誤りです。

### 遅い購読者とバッファ増大

現行の受信経路はデコード済みテキストを multicast `Subject` で流します。pump は読み続け、Web Serial への Observable バックプレッシャーはありません。遅い `receive$` 購読者が `reader.read()` を止めません。

バイトストリームも同じ緊張関係を継承します。

- 遅い／遅い購読者に追いつかせるための無制限バッファはメモリ増大のリスクがある
- 1 人の遅いバイト購読者のために read loop を止めると、テキスト UI を含む**全** consumer が停滞する

**将来再検討時の preferred 方針:** pump 駆動の multicast を維持し、**無制限 replay は約束しない**。遅れて購読した consumer は過去チャンクを見逃す（`receive$` と同じ）。過負荷の実例が出てから明示的な上限／破棄／エラー方針を検討する。RxJS だけで TCP 風バックプレッシャーを約束しない。

### `receive$` / `lines$` / `terminalText$` との関係

| ストリーム | 役割 |
| --- | --- |
| `receive$` | 未フレーミングの UTF-8 **デコード済み**チャンク |
| `lines$` | テキスト経路由来の改行区切り文字列 |
| `terminalText$` | `receive$` の表示向け畳み込み |
| `receiveBytes$`（仮） | 未フレーミングの**ワイヤ** `Uint8Array` — 並列の opt-in。**置換ではない** |

`receive$` をバイトへ置き換えたり意味を変えたりしない。テキストストリームは安定に保ち、バイト API は加算的であること。

## 将来再検討時の加算的スケッチ

例示のみ — **未実装**:

```typescript
interface SerialSession {
  readonly receive$: Observable<string>;
  readonly lines$: Observable<string>;
  readonly terminalText$: Observable<string>;
  /** 仮 — 本リリースには存在しない */
  readonly receiveBytes$: Observable<Uint8Array>;
}
```

将来の実装 PR 向け制約:

- **加算的 / opt-in:** 既存アプリはバイトを購読しなくても動作する
- **非破壊:** `receive$` / `lines$` / `terminalText$` の削除や意味変更をしない
- **デコード順:** bytes の fan-out のあとで `TextDecoder`
- **コアにプロトコルヘルパを置かない**（Modbus / COBS / SLIP は対象外 — 親 [#555](https://github.com/gurezo/web-serial-rxjs/issues/555)）
- **別 PR** とテスト。本設計ページだけでは API コードのマージ承認にはならない

任意の後続案（これも defer）: バイトのみ利用時にテキストデコードを止めるオプション、明示的バッファ上限。go 条件を満たすまで不要です。

## v1 `client.bytes$` との互換

v1 は `client.bytes$` を公開していました。v2+ で削除され、いまもバイナリ受信 API はありません。[v2 への移行](./migration-v2.md) を参照してください。

| 方針 | 判断 |
| --- | --- |
| 互換のため `bytes$` 名をそのまま復活 | 不要。v2 マイグレーションで削除済みと記載済み |
| `receive$` チャンクへの `TextEncoder.encode` | **非推奨** — ワイヤバイトを復元しない |
| 需要があれば加算的 `receiveBytes$` | 形状としては妥当。設計なしの v1 意味の暗黙復活はしない |

将来バイト API を出す場合、マイグレーション注記は本ページと `migration-v2.md` を指し、デコード済み文字列からのロスレス往復を主張しないこと。

## go / no-go チェックリスト

機能を再検討するときに使う表です。

| 観点 | 現状の評価 |
| --- | --- |
| テキスト API やアプリ所有の Web Serial では足りない実ユースケースが確認できるか | **コア投入には未確認** |
| `receiveBytes$` を本ライブラリに置く明確な理由があるか | **今日は不十分** |
| `receive$` / `lines$` / `terminalText$` との責務が整理されているか | **はい**（本ページ） |
| 同一 loop の fan-out（デコード前の bytes）が理解されているか | **はい** |
| 遅い購読者／バッファ方針が述べられているか | **はい**（無制限を約束しない） |
| 破壊的変更なしの加算 API が可能か | **はい** |
| API・pump 複雑性に見合う価値があるか | **即時追加には否** |
| **実装しない**判断が妥当か | **はい — 現状の決定** |

### Go（将来）

実装 Issue を立てる前に、次がすべて真であること:

1. `receive$` / Recipes / 直接 Web Serial では満たせない具体的な利用需要がある
2. 公開形状として加算的 `receiveBytes$`（または同等）に合意できる
3. multicast・無 replay・フレーミングはアプリ側、という規則を受け入れる
4. テキストストリームを退行させずに read pump を変更し、テストできる余力がある

### No-go（いま）

- 「Modbus が必要かもしれない」程度の推測
- コアパッケージ内でのプロトコル実装
- 対応範囲／選び方／マイグレーションの更新なしでのバイト API 出荷

## 対象外

- 本ドキュメント変更での `receiveBytes$` 実装
- Modbus RTU / COBS / SLIP / デバイス専用 API
- Web Serial 非対応ブラウザ向け Polyfill
- 未検証ハードウェアを対応済みと称すること

## 関連ガイド

- [対応範囲（concepts）](./concepts.md#対応範囲テキスト--バイナリ--文字コード) — 現行の対応表
- [receive$ / lines$ / terminalText$ の選び方](./stream-selection.md) — テキストストリームの選択
- [通信パターン別 Recipes](./recipes.md) — パターン索引
- [v1 → v2 マイグレーション](./migration-v2.md) — `client.bytes$` 削除
- [ブラウザサポートと公式サポート方針](./browser-support.md) — API 実装状況と公式サポート

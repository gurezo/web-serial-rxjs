# バージョンサポートとリリース方針

このページは、`@gurezo/web-serial-rxjs` がどのようにバージョンを付けてリリースするか、過去 major へのサポート期待値、リリースノートの所在をまとめます。**アップグレード・保守判断**のための文書です。**LTS や長期サポートは約束しません**。

Parent: [#555](https://github.com/gurezo/web-serial-rxjs/issues/555) · Issue: [#565](https://github.com/gurezo/web-serial-rxjs/issues/565) · Related: [ブラウザサポート](./browser-support.md)

## Semantic Versioning

本プロジェクトは [Semantic Versioning](https://semver.org/) に従います。npm のパッケージ版と Git タグは `MAJOR.MINOR.PATCH` です（タグは `v` 接頭辞付き。例: `v4.1.0`）。

| 上げ方 | 意味 |
| --- | --- |
| **MAJOR** | 公開 API または文書化された挙動の破壊的変更 |
| **MINOR** | 後方互換を保つ新機能 |
| **PATCH** | 後方互換を保つバグ修正 |

リリース手順（タグ → CI → npm → GitHub Release）はリポジトリの [RELEASING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.ja.md) を参照してください。

## Breaking change

破壊的変更は **major** リリースでのみ公開します。

採用者が移行すべき公開 API の変更を含む major では、本 Guide に **Migration Guide** を追加または更新します（例: [v3 → v4](./migration-v4.md)）。個別コミットよりこれらのページを優先してください。

## Deprecated API

- `@deprecated` 付きの API は、既存アプリが段階的に移行できるよう **現行 major** 内では利用可能です。
- 削除は **将来の major**（現時点では **v5+**）に延期し、minor / patch では削除しません。
- v4 における具体的な deprecated 面は [API の概念 – Deprecated exports](./concepts.md#deprecated-exports) と各 Migration Guide を参照してください。

## サポート範囲（LTS なし）

本プロジェクトは、古い major に対する LTS や複数年サポートを**約束しません**。

| 関心事 | 方針 |
| --- | --- |
| **セキュリティ修正** | **最新 major** 系列のみ対象（現在は **4.x**）。[SECURITY.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.ja.md) を参照。 |
| **バグ修正** | 既定では現行 major 向けに `main` へ取り込みます。可能な場合は最新の `4.x` へアップグレードしてください。 |
| **過去 major への backport** | **約束しません**。`release/v*` 保守ブランチがある場合のみ、**best-effort** で hotfix する場合があります（[CONTRIBUTING.ja.md – 保守ブランチからのリリース](https://github.com/gurezo/web-serial-rxjs/blob/main/CONTRIBUTING.ja.md#保守ブランチからのリリース)）。そのようなブランチが無ければ、古い major への追加修正はありません。 |

ブラウザ / 環境のサポート（動作確認の範囲）はバージョンサポートとは別です — [ブラウザサポートと公式サポート方針](./browser-support.md) を参照してください。

## GitHub Release / npm / CHANGELOG

| 経路 | 役割 |
| --- | --- |
| **GitHub Release** | タグ付き各バージョンの、利用者向けリリースノートの正本 |
| **npm** | パッケージ配布（`@gurezo/web-serial-rxjs`） |
| **CHANGELOG.md** | 任意。維持している場合に更新。迷ったら GitHub Releases を優先 |

## 関連

- リポジトリ [SECURITY.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.ja.md) · [English](https://github.com/gurezo/web-serial-rxjs/blob/main/SECURITY.md)
- リポジトリ [RELEASING.ja.md](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.ja.md) · [English](https://github.com/gurezo/web-serial-rxjs/blob/main/RELEASING.md)
- [ブラウザサポートと公式サポート方針](./browser-support.md)
- [v3 → v4 Migration](./migration-v4.md) · [v2 → v3](./migration-v3.md) · [v1 → v2](./migration-v2.md)
- リポジトリ [README – 開発とリリース戦略](https://github.com/gurezo/web-serial-rxjs/blob/main/README.ja.md#開発とリリース戦略)

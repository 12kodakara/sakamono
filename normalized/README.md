# normalized/ — 正規化済みデータの置き場

`external/` の生データを、サカモノ内部のモデル
（`Product` / `StoreListing` / `ProductVariant` / `PriceSnapshot`）へ
変換した結果を置きます。

- `liverpool/latest.json` … 取り込みコマンドが書き出すファイル

## Gitへコミットしません

`.gitignore` 済みです（このREADMEを除く）。

## 開発用 fixture とは別物です

| | 置き場所 | 何のためのものか |
| --- | --- | --- |
| 開発用 fixture | `src/data/fixtures/` | サイトの開発・テスト用の**架空**データ。**消さない** |
| 正規化済みデータ | `normalized/` | 外部から入手したデータを変換したもの |

**取り込んだデータで fixture を上書きしないでください。**
fixture は「取り込みが失敗してもサイト開発を続けられる」ための土台です。

## 作り方

```bash
npm run data:liverpool:fetch -- --sample          # 架空サンプルで生成
npm run data:liverpool:fetch -- --dry-run         # 書き出さず集計だけ見る
npm run data:liverpool:fetch -- --limit=5         # 件数を絞る
```

## 画面で見るには

`.env.local` に次を書いて `npm run dev`:

```
SAKAMONO_DATA_SOURCE=liverpool
```

**この状態のまま公開しないでください。** 第3段階はローカル検証のみです。

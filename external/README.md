# external/ — 外部から入手した「生データ」の置き場

ここには、外部のデータ提供元から入手した**加工前のデータ**を置きます。

- `liverpool/raw.json` … Liverpool FC の商品データ（`LiverpoolRawFeed` 形式）

## Gitへコミットしません

このフォルダの中身は `.gitignore` 済みです（このREADMEを除く）。

理由:

1. 第三者のコンテンツをリポジトリへ保存・再配布しないため
2. データ提供元の利用条件を守るため
3. 生データは大きくなりがちで、履歴に残すと扱いにくいため

## Liverpool のデータをどう入手するか

**公式ストアからの自動取得は行いません。**
利用規約 第15.7条が、自動・体系的な抽出、別データベースへの取り込み、
再配信を禁止しているためです。

正規の入手経路は **Webgains 公式商品フィード（プログラムID 7413）** です。

詳しい調査結果: [docs/data-sources/liverpool.md](../docs/data-sources/liverpool.md)

## 動作だけ確かめたいとき

サカモノが用意した架空のサンプルで動かせます（外部への通信は一切しません）。

```bash
npm run data:liverpool:fetch -- --sample
```

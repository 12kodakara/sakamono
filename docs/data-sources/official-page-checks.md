# 公式商品ページを直接開いて確認した記録

**方式名**: 公式商品ページの直接確認（OFFICIAL_PAGE_CHECK）
**目的**: robots.txt が許可しており、機械的な取得を拒否していない公式サイトについて、
商品ページを1件ずつ開き、画面に表示されている値だけを商品データの根拠として記録する。

---

## 0. この方式のきまり

| 項目 | きまり |
| --- | --- |
| 確認する人 | Claude Code（公式の商品ページを1件ずつ開く） |
| 使ってよい相手 | **robots.txt が許可している公式ドメインだけ** |
| やらないこと | アクセス拒否（403等）の迂回・CAPTCHAの回避・非公開APIの利用・一括クロール |
| 記録するもの | 画面に表示されていた値だけ。**表示が無い項目は書かない（推測で補わない）** |
| 主な識別子 | **メーカー品番（スタイル番号）**。完全一致したときだけ「同一商品」とする |
| 価格・在庫 | **変動情報**。商品データへ保存しない（この記録にも残さない） |
| 画像 | 公式画像を転載しない。画像URLも登録しない |

### `manual-official-checks.md` との違い

| | この文書 | `manual-official-checks.md` |
| --- | --- | --- |
| 確認したのは | Claude Code | サカモノの運営者（ブラウザ） |
| 対象 | 機械的に開ける公式サイト（Nike など） | 開けない公式サイト（adidas など） |

**2つを混ぜないために文書を分けています。** どちらの記録に載っているかは、
商品データのコメントと `src/tests/officialChecks.test.ts` の `record` で分かります。

### 相手ごとの可否（2026-09-25 時点）

| ドメイン | robots.txt | 商品ページ取得 | 判定 |
| --- | --- | --- | --- |
| `www.nike.com` | 取得可。冒頭に `just crawl it.`。`*/p/` 等は Disallow だが **`/t/`（商品ページ）は対象外** | 200 | ✅ この方式を使う |
| `us.puma.com` | 取得可。`/pd/`（商品ページ）は Disallow の対象外 | 200 | ✅ この方式を使う |
| `www.adidas.com` / `www.adidas.co.uk` | robots.txt 自体が **403** | 403 | ❌ 使わない（迂回しない） |
| `store.liverpoolfc.com` | 取得可 | — | ❌ 使わない（利用規約 第15.7条。`liverpool.md` 参照） |

> Nike は品番からも商品ページへ到達できます（`https://www.nike.com/id/t/x/<品番>`）。
> シーズンが変わって一覧から外れた商品でも、品番があれば確認し直せます。

---

## 1. 記録

### 1-1. HM3207-741（product-thfc-2526-third-replica）

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | Nike公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | Tottenham Hotspur 2025/26 Stadium Third Men's Nike Dri-FIT Total 90 Football Replica Shirt | Tottenham Hotspur 2025/26 Third Replica Shirt | ✅ 同一商品 |
| スタイル番号 | HM3207-741 | HM3207-741 | ✅ 一致 |
| クラブ | Tottenham Hotspur | トッテナム・ホットスパー | ✅ 一致 |
| シーズン | 2025/26 | 2025/26 | ✅ 一致 |
| 種類 | Third | third | ✅ 一致 |
| 仕様 | **Stadium**（＝レプリカ） | replica | ✅ 一致 |
| メーカー | Nike | Nike | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | Dynamic Yellow/Blue Void/Pacific Blue/Blue Void | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

### 1-2. HJ4603-784（product-fcb-2526-away-replica）

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | Nike公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | F.C. Barcelona 2025/26 Stadium Away Men's Kobe Dri-FIT Football Replica Shirt | FC Barcelona 2025/26 Away Replica Shirt | ✅ 同一商品 |
| スタイル番号 | HJ4603-784 | HJ4603-784 | ✅ 一致 |
| クラブ | F.C. Barcelona | FCバルセロナ | ✅ 一致 |
| シーズン | 2025/26 | 2025/26 | ✅ 一致 |
| 種類 | Away | away | ✅ 一致 |
| 仕様 | **Stadium**（＝レプリカ） | replica | ✅ 一致 |
| メーカー | Nike | Nike | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | Team Gold/Team Gold/Persian Violet/Black | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

### 1-3. HJ4554-784（product-fcb-2526-away-authentic）

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | Nike公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | F.C. Barcelona 2025/26 Match Away Men's Kobe Dri-FIT ADV Football Authentic Shirt | FC Barcelona 2025/26 Away Authentic Shirt | ✅ 同一商品 |
| スタイル番号 | HJ4554-784 | HJ4554-784 | ✅ 一致 |
| クラブ | F.C. Barcelona | FCバルセロナ | ✅ 一致 |
| シーズン | 2025/26 | 2025/26 | ✅ 一致 |
| 種類 | Away | away | ✅ 一致 |
| 仕様 | **Match**（＝オーセンティック・選手仕様） | authentic | ✅ 一致 |
| メーカー | Nike | Nike | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | Team Gold/Team Gold/Persian Violet/Black | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

### 1-4. HJ4593-411（product-psg-2526-home-replica）

**リーグ・アン最初のクラブです。** これまでプレミアリーグとラ・リーガの4クラブだけで、
セリエA・リーグ・アン・エールディヴィジはクラブが0件のままでした。

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | Nike公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | Paris Saint-Germain 2025/26 Stadium Home Men's Nike Dri-FIT Football Replica Shirt | Paris Saint-Germain 2025/26 Home Replica Shirt | ✅ 同一商品 |
| スタイル番号 | HJ4593-411 | HJ4593-411 | ✅ 一致 |
| クラブ | Paris Saint-Germain | パリ・サンジェルマン | ✅ 一致 |
| シーズン | 2025/26 | 2025/26 | ✅ 一致 |
| 種類 | Home | home | ✅ 一致 |
| 仕様 | **Stadium**（＝レプリカ） | replica | ✅ 一致 |
| メーカー | Nike | Nike | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | Midnight Navy/Midnight Navy/White | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

クラブ情報（`club-psg`）も公式で確認しています。

| 項目 | 確認元 | 登録値 |
| --- | --- | --- |
| クラブ名 | psg.fr（公式サイト） | Paris Saint-Germain |
| 公式ストア | psg.fr のフッターが案内する `store.psg.fr` | https://store.psg.fr/ |
| 所属リーグ | リーグ・アン（フランス） | league-ligue-1 |

> `store.psg.fr` へ直接アクセスすると 403 が返りますが、**公式サイト自身がこのURLを案内している**ため
> 公式ストアであることは確認できています。サカモノはこのURLへ自動アクセスしません（画面のリンクに使うだけです）。

### 1-5. 779962_01（product-acm-2526-home-replica）

**セリエA最初のクラブです。** これでプレミアリーグ・ラ・リーガ・リーグ・アン・セリエAの4リーグになり、
残るはエールディヴィジだけになりました。**PUMA を確認した最初の商品**でもあります。

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | PUMA公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | AC Milan 25/26 Home Replica Men's Soccer Jersey | AC Milan 2025/26 Home Replica Shirt | ✅ 同一商品 |
| 品番 | 779962_01 | 779962_01 | ✅ 一致 |
| クラブ | AC Milan | ACミラン | ✅ 一致 |
| シーズン | 25/26 | 2025/26 | ✅ 一致 |
| 種類 | Home | home | ✅ 一致 |
| 仕様 | **Replica** | replica | ✅ 一致 |
| メーカー | PUMA | PUMA | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | For All Time Red-PUMA Black | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

クラブ情報（`club-ac-milan`）も公式で確認しています。

| 項目 | 確認元 | 登録値 |
| --- | --- | --- |
| クラブ名 | acmilan.com（公式サイト） | AC Milan |
| 公式ストア | acmilan.com が案内する `store.acmilan.com` | https://store.acmilan.com/ |
| 所属リーグ | セリエA（イタリア） | league-serie-a |

> `store.acmilan.com` へ直接アクセスすると 403 が返りますが、**公式サイト自身がこのURLを案内している**ため
> 公式ストアであることは確認できています。サカモノはこのURLへ自動アクセスしません。

**★PUMAの品番は「6桁_2桁」です（779962_01）。★**
後ろ2桁はカラー番号で、色違いは別番号になります。
**オーセンティック版は 779961_01 で、レプリカ（779962_01）と1桁しか違いません。**
Nike の「Stadium／Match」と同じく、仕様が違えば別商品・別番号です。

### 1-6. 780420_01（product-psv-2526-home-replica）

**エールディヴィジ最初のクラブです。これで5リーグすべてにクラブが入りました。**

| 項目 | 公式表示 | サカモノの登録値 | 照合 |
| --- | --- | --- | --- |
| 確認方法 | PUMA公式の商品ページを直接確認 | — | — |
| 確認日 | 2026-09-25 | — | — |
| 商品名 | PSV Eindhoven 25/26 Home Replica Men's Soccer Jersey | PSV Eindhoven 2025/26 Home Replica Shirt | ✅ 同一商品 |
| 品番 | 780420_01 | 780420_01 | ✅ 一致 |
| クラブ | PSV Eindhoven | PSVアイントホーフェン | ✅ 一致 |
| シーズン | 25/26 | 2025/26 | ✅ 一致 |
| 種類 | Home | home | ✅ 一致 |
| 仕様 | **Replica** | replica | ✅ 一致 |
| メーカー | PUMA | PUMA | ✅ 一致 |
| 対象 | Men's | men | ✅ 一致 |
| カラー | PUMA White-For All Time Red | （項目なし） | 参考 |
| 袖 | 表示なし | 半袖 | 公式表示なし（矛盾なし） |

クラブ情報（`club-psv`）の確認は、ほかのクラブと手順が違います。

| 項目 | 確認元 | 登録値 |
| --- | --- | --- |
| クラブ名 | PUMA公式の商品ページ | PSV Eindhoven |
| 公式ストア | **ストア自身の表示**（下記） | https://www.psvfanstore.nl/ |
| 所属リーグ | エールディヴィジ（オランダ） | league-eredivisie |

> **psv.nl（クラブ公式サイト）は中身がJavaScriptで組み立てられており、こちらからは読めませんでした。**
> HTMLを直接見てもストアへのリンクが1件も含まれていません。
> そこで `psvfanstore.nl` 側を確認したところ、**そのページ自身が
> 「PSV FANstore｜Officiële webshop PSV」「Het officiële verkooppunt voor PSV merchandise」
> （PSV公式ウェブショップ／PSV公式グッズ販売所）と明記**していました。
> 推測ではなく、ストア自身の表示を根拠にしています。

### 見送った候補

| 候補 | 品番 | 理由 |
| --- | --- | --- |
| Inter Milan 2025/26 Stadium Home | HJ4591-439（第三者サイト表示） | **Nike公式の商品ページに到達できません（全ルート404）。** 第三者サイトだけを根拠に登録しません |
| Tottenham 2025/26 Match Home | HJ4550-101（同上） | 同上（404） |
| Real Madrid 2025/26 アウェイ | — | adidas が 403。迂回しません |

---

## 2. 気をつけること

- **HJ4603-784（Stadium）と HJ4554-784（Match）はカラー表記が同じです。**
  色が同じでも仕様（レプリカ／オーセンティック）が違えば別商品・別番号です。
  価格は1万円以上違うことがあるため、取り違えると比較が大きく狂います。
- **「Stadium」＝レプリカ、「Match」＝オーセンティック**が Nike の言い方です。
  商品名に Replica / Authentic とも書かれているので、両方で確認しています。
- Nike のスタイル番号は「品番-カラー番号」の形です。色違いは別番号になります。
- **これらの商品には掲載（価格）を付けていません。** 価格は変動情報で、公式確認の対象外です。
  価格が無い商品は既存ルール（`isProductListable`）で noindex のままになります。

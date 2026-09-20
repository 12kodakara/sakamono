/**
 * 楽天APIの応答のサンプル（★架空のデータ★）。
 *
 * ★実際のAPIレスポンスを保存したものではありません。★
 *   指示書40のとおり、本番データをfixtureへ持ち込まないため、
 *   公式仕様のフィールド名だけを使って手で組み立てています。
 *   ショップ名・URL・価格はすべて架空です。
 *
 * 目的は2つ:
 *   1. 認証情報が無くてもパイプライン全体を動かせるようにする
 *   2. ★「採用してはいけないもの」を必ず混ぜておく★
 *      正しく拾えるかより、間違って拾わないかを確かめるためのものです。
 */

import type { RakutenApiResponse } from './types'

/** サンプルが対象にしている商品のメーカー品番。 */
export const SAMPLE_TARGET_SKU = 'JV6423'

function item(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    itemName: '',
    itemCode: 'sample-shop:item-0',
    itemPrice: 0,
    itemUrl: 'https://example.com/sample-rakuten/item',
    shopCode: 'sample-shop',
    shopName: 'サンプルショップ（架空）',
    mediumImageUrls: ['https://example.com/sample-rakuten/image.jpg'],
    availability: 1,
    // 0 = 税込
    taxFlag: 0,
    // 0 = 送料込み
    postageFlag: 0,
    pointRate: 1,
    ...overrides,
  }
}

/**
 * formatVersion=2 の形（Items が素の配列）。
 *
 * 1〜3 は採用されるべきもの、4〜9 は採用されてはいけないものです。
 */
export const rakutenSampleResponse: RakutenApiResponse = {
  count: 9,
  page: 1,
  pageCount: 1,
  hits: 9,
  Items: [
    /* ---- 採用されるべきもの ---- */
    item({
      itemName: 'リバプール 25-26 ホーム 半袖レプリカユニフォーム adidas アディダス JYF22-JV6423',
      itemCode: 'sample-shop:item-1',
      itemPrice: 8980,
      itemUrl: 'https://example.com/sample-rakuten/item-1',
    }),
    item({
      itemName: 'アディダス リバプールFC 25/26 ホームジャージー JV6423 レプリカユニフォーム メンズ',
      itemCode: 'sample-shop-2:item-2',
      shopCode: 'sample-shop-2',
      shopName: 'サンプルスポーツ（架空）',
      itemPrice: 9240,
      itemUrl: 'https://example.com/sample-rakuten/item-2',
      pointRate: 5,
    }),

    /* ---- ★採用されてはいけないもの★ ---- */

    // 長袖（別品番・別価格の商品）
    item({
      itemName: 'リバプール 25-26 ホーム 長袖レプリカユニフォーム adidas JYF51-JV6456',
      itemCode: 'sample-shop:item-3',
      itemPrice: 10010,
      itemUrl: 'https://example.com/sample-rakuten/item-3',
    }),
    // 選手名入り（同じ品番でも別商品）
    item({
      itemName: 'リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー adidas JV6423',
      itemCode: 'sample-shop:item-4',
      itemPrice: 14410,
      itemUrl: 'https://example.com/sample-rakuten/item-4',
    }),
    // ジュニア（大人用より大幅に安い）
    item({
      itemName: 'ジュニア リバプール 25-26 ホーム 半袖レプリカユニフォーム adidas JYF33-JV6436',
      itemCode: 'sample-shop:item-5',
      itemPrice: 5610,
      itemUrl: 'https://example.com/sample-rakuten/item-5',
    }),
    // 別クラブ
    item({
      itemName: 'マンチェスターシティ 25/26 ホーム 半袖 レプリカ ユニフォーム puma',
      itemCode: 'sample-shop:item-6',
      itemPrice: 9000,
      itemUrl: 'https://example.com/sample-rakuten/item-6',
    }),
    // 中古
    item({
      itemName: '【中古】リバプール 25-26 ホーム 半袖レプリカユニフォーム adidas JV6423',
      itemCode: 'sample-shop:item-7',
      itemPrice: 4500,
      itemUrl: 'https://example.com/sample-rakuten/item-7',
    }),
    // ★税別価格★（そのまま税込価格と比べてはいけない）
    item({
      itemName: 'リバプール 25/26 ホーム 半袖 レプリカ ユニフォーム adidas JV6423 メンズ',
      itemCode: 'sample-shop-3:item-8',
      shopCode: 'sample-shop-3',
      shopName: 'サンプル卸（架空）',
      itemPrice: 8200,
      itemUrl: 'https://example.com/sample-rakuten/item-8',
      taxFlag: 1,
    }),
    // ★送料別★（総額を出せないので送料込み比較には使えない）
    item({
      itemName: 'リバプール 25/26 ホーム 半袖 レプリカ ユニフォーム adidas JYF22 JV6423',
      itemCode: 'sample-shop-4:item-9',
      shopCode: 'sample-shop-4',
      shopName: 'サンプル商店（架空）',
      itemPrice: 8500,
      itemUrl: 'https://example.com/sample-rakuten/item-9',
      postageFlag: 1,
    }),
  ],
}

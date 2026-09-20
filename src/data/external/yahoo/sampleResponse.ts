/**
 * 動作確認用のサンプル応答。
 *
 * ══════════════════════════════════════════════════════════
 * ★★ これは Yahoo! APIから実際に取得したデータではありません ★★
 *
 *   Client ID が無くてもパイプライン全体を確かめられるよう、
 *   公式仕様のフィールド名に合わせてサカモノが手で書いた架空のデータです。
 *
 *   商品名・価格・出品者名・JANはいずれも実在しません。
 *   URLは example.com（仕様書用に予約されたドメイン）です。
 *   個人情報・APIキーは含みません。
 * ══════════════════════════════════════════════════════════
 *
 * 照合エンジンの各分岐を1回ずつ通るように作ってあります。
 *
 *   1. 完全一致（JAN一致・新品・在庫あり・送料無料）      → 採用
 *   2. 完全一致だが「条件付き送料無料」                    → 送料不明で総額を出せない
 *   3. オーセンティック（★レプリカと取り違えない★）      → 要確認
 *   4. アウェイ（★ホームと取り違えない★）                → 要確認
 *   5. ジュニア（★大人用と取り違えない★）                → 要確認
 *   6. 別クラブ（JANなし）                                 → 不採用
 *   7. 中古                                                → 不採用
 *   8. 相場より極端に安い                                  → 要確認
 *   9. 背番号マーキング入り                                → 要確認
 *  10. 別シーズン（24/25・JANなし）                        → 不採用
 *  11. 別メーカー（adidas・JANなし）                       → 不採用
 *  12. JANが無く属性だけ一致                               → ランクC（自動採用しない）
 *
 * 3〜5 に同じJANを入れてあるのは意図的です。
 * モール型のサイトでは、出品者が別商品へ同じJANを付けてしまうことが実際にあります。
 * そのとき「JANが一致しているから同じ商品」と決めつけず、
 * 属性の食い違いに気付いて要確認へ送れるかを確かめています。
 */

import type { YahooApiResponse } from './types'

/**
 * サンプルが対象にしている商品のJAN。
 *
 * ★実在しない値です。★
 *   形だけ正しい13桁（チェックディジットも合っています）にして、
 *   数字は9で埋めてあります。実際に割り当てられることはありません。
 *
 *   以前は「2」で始まるインストアコードを使っていましたが、
 *   それだと isDistributableJan() が「流通しないコード」として弾くため、
 *   JAN一致の経路をサンプルで確かめられなくなりました。
 */
export const SAMPLE_TARGET_JAN = '4999999999999'

function hit(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    name: '',
    url: 'https://example.com/sample-yahoo/item',
    code: 'sample-item',
    condition: 'new',
    inStock: true,
    price: 0,
    priceLabel: { defaultPrice: null },
    image: { medium: 'https://example.com/sample-yahoo/image.jpg' },
    janCode: SAMPLE_TARGET_JAN,
    brand: { id: 1, name: 'ナイキ' },
    seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    shipping: { code: 1, name: '送料無料' },
    ...overrides,
  }
}

export const yahooSampleResponse: YahooApiResponse = {
  totalResultsAvailable: 12,
  totalResultsReturned: 12,
  firstResultPosition: 1,
  request: { query: `jan_code=${SAMPLE_TARGET_JAN}` },
  hits: [
    /* 1. 完全一致（採用されるべき候補） */
    hit({
      index: 1,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム ナイキ メンズ 半袖',
      url: 'https://example.com/sample-yahoo/item-0001',
      code: 'sample-item-0001',
      price: 20800,
      priceLabel: { defaultPrice: 24200 },
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 2. 同じ商品だが送料の条件が分からない（総額を出せない） */
    hit({
      index: 2,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム NIKE メンズ',
      url: 'https://example.com/sample-yahoo/item-0002',
      code: 'sample-item-0002',
      price: 20900,
      seller: { sellerId: 'sample-shop-b', name: 'サンプルサッカーショップB' },
      shipping: { code: 2, name: '条件付き送料無料' },
    }),

    /* 3. オーセンティック（★レプリカと取り違えてはいけない★） */
    hit({
      index: 3,
      name: 'リバプール 25/26 ホーム オーセンティック ユニフォーム ナイキ',
      url: 'https://example.com/sample-yahoo/item-0003',
      code: 'sample-item-0003',
      price: 32800,
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 4. アウェイ（★ホームと取り違えてはいけない★） */
    hit({
      index: 4,
      name: 'リバプール 25/26 アウェイ レプリカ ユニフォーム ナイキ メンズ',
      url: 'https://example.com/sample-yahoo/item-0004',
      code: 'sample-item-0004',
      price: 19800,
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 5. ジュニア（★大人用の最安値にしてはいけない★） */
    hit({
      index: 5,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム ジュニア キッズ ナイキ',
      url: 'https://example.com/sample-yahoo/item-0005',
      code: 'sample-item-0005',
      price: 12800,
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 6. 別クラブ */
    hit({
      index: 6,
      name: 'マンチェスターユナイテッド 25/26 ホーム レプリカ ユニフォーム',
      url: 'https://example.com/sample-yahoo/item-0006',
      code: 'sample-item-0006',
      price: 19900,
      janCode: null,
      seller: { sellerId: 'sample-shop-c', name: 'サンプルフットボールC' },
    }),

    /* 7. 中古（★新品価格の比較に混ぜてはいけない★） */
    hit({
      index: 7,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム 中古 美品',
      url: 'https://example.com/sample-yahoo/item-0007',
      code: 'sample-item-0007',
      price: 9800,
      condition: 'used',
      seller: { sellerId: 'sample-shop-d', name: 'サンプルリユースD' },
    }),

    /* 8. 相場より極端に安い（★安いだけで採用してはいけない★） */
    hit({
      index: 8,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム ナイキ メンズ',
      url: 'https://example.com/sample-yahoo/item-0008',
      code: 'sample-item-0008',
      price: 1980,
      seller: { sellerId: 'sample-shop-e', name: 'サンプル激安ストアE' },
    }),

    /* 9. 背番号マーキング入り（無地と同じ価格では比べられない） */
    hit({
      index: 9,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム 背番号 マーキング入り ナイキ',
      url: 'https://example.com/sample-yahoo/item-0009',
      code: 'sample-item-0009',
      price: 26800,
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 10. 別シーズン */
    hit({
      index: 10,
      name: 'リバプール 24/25 ホーム レプリカ ユニフォーム ナイキ メンズ',
      url: 'https://example.com/sample-yahoo/item-0010',
      code: 'sample-item-0010',
      price: 13800,
      janCode: null,
      seller: { sellerId: 'sample-shop-a', name: 'サンプルスポーツ店A' },
    }),

    /* 11. 別メーカー（★adidasにNikeを一致させてはいけない★） */
    hit({
      index: 11,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム アディダス メンズ',
      url: 'https://example.com/sample-yahoo/item-0011',
      code: 'sample-item-0011',
      price: 18800,
      janCode: null,
      brand: { id: 2, name: 'アディダス' },
      seller: { sellerId: 'sample-shop-c', name: 'サンプルフットボールC' },
    }),

    /* 12. JANが無く、属性だけ一致（★自動採用しない★） */
    hit({
      index: 12,
      name: 'リバプール 25/26 ホーム レプリカ ユニフォーム ナイキ',
      url: 'https://example.com/sample-yahoo/item-0012',
      code: 'sample-item-0012',
      price: 22800,
      janCode: null,
      seller: { sellerId: 'sample-shop-f', name: 'サンプルスポーツF' },
    }),
  ],
}

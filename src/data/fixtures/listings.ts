/**
 * ストア掲載情報（StoreListing）の fixture データ。
 *
 * ★★★ ここにある価格はすべてサンプル値です。実際の販売価格ではありません。★★★
 *
 * ■ externalUrl について
 *   すべて example.com を指しています。
 *   example.com は仕様書・サンプル用に予約されたドメインで、実在の店舗ページではありません。
 *   「サンプル価格が実在のページの価格である」と誤解されないようにするためです。
 *   第2段階で実際の商品ページURLへ置き換えます。
 *
 * ■ discountRate について
 *   手で書かず calculateDiscountRate() で算出しています。
 *   通常価格と現在価格から必ず整合が取れるようにするためです。
 */

import type { CurrencyCode, StoreListing } from '@/domain/types'
import { calculateDiscountRate } from '@/lib/pricing/compare'

interface ListingSeed {
  id: string
  productId: string
  storeId: string
  externalId: string
  currency: CurrencyCode
  currentPrice: number
  regularPrice: number
  inStock: boolean
  lastCheckedAt: string
}

function listing(seed: ListingSeed): StoreListing {
  return {
    ...seed,
    externalUrl: `https://example.com/sample-listing/${seed.externalId}`,
    discountRate: calculateDiscountRate(seed.regularPrice, seed.currentPrice),
  }
}

const CHECKED_AT = '2026-09-18T09:00:00.000Z'

export const listingFixtures: StoreListing[] = [
  /* ===== Liverpool: ホーム レプリカ ========================= */
  listing({
    id: 'listing-lfc-home-r-official',
    productId: 'product-lfc-2526-home-replica',
    storeId: 'store-lfc-official',
    externalId: 'lfc-2526-h-r',
    currency: 'GBP',
    currentPrice: 79.95,
    regularPrice: 94.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-lfc-home-r-domestic',
    productId: 'product-lfc-2526-home-replica',
    storeId: 'store-jp-sample-a',
    externalId: 'jp-a-lfc-2526-h-r',
    currency: 'JPY',
    currentPrice: 21800,
    regularPrice: 21800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Liverpool: アウェイ オーセンティック =============== */
  listing({
    id: 'listing-lfc-away-a-official',
    productId: 'product-lfc-2526-away-authentic',
    storeId: 'store-lfc-official',
    externalId: 'lfc-2526-a-a',
    currency: 'GBP',
    currentPrice: 124.95,
    regularPrice: 124.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-lfc-away-a-domestic',
    productId: 'product-lfc-2526-away-authentic',
    storeId: 'store-jp-sample-b',
    externalId: 'jp-b-lfc-2526-a-a',
    currency: 'JPY',
    currentPrice: 29800,
    regularPrice: 32800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Liverpool: トレーニングトップ ====================== */
  /* 国内の比較対象が見つかっていない商品の例（価格差は表示されない） */
  listing({
    id: 'listing-lfc-training-official',
    productId: 'product-lfc-2526-training-top',
    storeId: 'store-lfc-official',
    externalId: 'lfc-2526-tr',
    currency: 'GBP',
    currentPrice: 54.95,
    regularPrice: 69.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Tottenham: ホーム レプリカ ========================= */
  listing({
    id: 'listing-thfc-home-r-official',
    productId: 'product-thfc-2526-home-replica',
    storeId: 'store-thfc-official',
    externalId: 'thfc-2526-h-r',
    currency: 'GBP',
    currentPrice: 69.95,
    regularPrice: 84.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-thfc-home-r-domestic',
    productId: 'product-thfc-2526-home-replica',
    storeId: 'store-jp-sample-a',
    externalId: 'jp-a-thfc-2526-h-r',
    currency: 'JPY',
    currentPrice: 19800,
    regularPrice: 19800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Tottenham: マフラー ================================ */
  /* 在庫切れ表示の例 */
  listing({
    id: 'listing-thfc-scarf-official',
    productId: 'product-thfc-2526-scarf',
    storeId: 'store-thfc-official',
    externalId: 'thfc-scarf',
    currency: 'GBP',
    currentPrice: 22,
    regularPrice: 22,
    inStock: false,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-thfc-scarf-domestic',
    productId: 'product-thfc-2526-scarf',
    storeId: 'store-jp-sample-b',
    externalId: 'jp-b-thfc-scarf',
    currency: 'JPY',
    currentPrice: 5980,
    regularPrice: 5980,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== FC Barcelona: ホーム レプリカ ====================== */
  listing({
    id: 'listing-fcb-home-r-official',
    productId: 'product-fcb-2526-home-replica',
    storeId: 'store-fcb-official',
    externalId: 'fcb-2526-h-r',
    currency: 'EUR',
    currentPrice: 99.99,
    regularPrice: 109.99,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-fcb-home-r-domestic',
    productId: 'product-fcb-2526-home-replica',
    storeId: 'store-jp-sample-a',
    externalId: 'jp-a-fcb-2526-h-r',
    currency: 'JPY',
    currentPrice: 24800,
    regularPrice: 24800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== FC Barcelona: サード レプリカ ====================== */
  listing({
    id: 'listing-fcb-third-r-official',
    productId: 'product-fcb-2526-third-replica',
    storeId: 'store-fcb-official',
    externalId: 'fcb-2526-3-r',
    currency: 'EUR',
    currentPrice: 79.99,
    regularPrice: 109.99,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-fcb-third-r-domestic',
    productId: 'product-fcb-2526-third-replica',
    storeId: 'store-jp-sample-b',
    externalId: 'jp-b-fcb-2526-3-r',
    currency: 'JPY',
    currentPrice: 18900,
    regularPrice: 18900,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Real Madrid: ホーム レプリカ ======================= */
  listing({
    id: 'listing-rma-home-r-official',
    productId: 'product-rma-2526-home-replica',
    storeId: 'store-rma-official',
    externalId: 'rma-2526-h-r',
    currency: 'EUR',
    currentPrice: 94.99,
    regularPrice: 94.99,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-rma-home-r-domestic',
    productId: 'product-rma-2526-home-replica',
    storeId: 'store-jp-sample-a',
    externalId: 'jp-a-rma-2526-h-r',
    currency: 'JPY',
    currentPrice: 20900,
    regularPrice: 20900,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ===== Real Madrid: ホーム オーセンティック =============== */
  listing({
    id: 'listing-rma-home-a-official',
    productId: 'product-rma-2526-home-authentic',
    storeId: 'store-rma-official',
    externalId: 'rma-2526-h-a',
    currency: 'EUR',
    currentPrice: 149.99,
    regularPrice: 149.99,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-rma-home-a-domestic',
    productId: 'product-rma-2526-home-authentic',
    storeId: 'store-jp-sample-b',
    externalId: 'jp-b-rma-2526-h-a',
    currency: 'JPY',
    currentPrice: 34800,
    regularPrice: 34800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ==========================================================
   * 第2段階で追加した検証用の掲載
   * ======================================================== */

  /* ----- ケースA: 海外購入がかなり安い --------------------- */
  listing({
    id: 'listing-lfc-2425-home-official',
    productId: 'product-lfc-2425-home-replica',
    storeId: 'store-lfc-official',
    externalId: 'lfc-2425-h-r',
    currency: 'GBP',
    currentPrice: 44.95,
    regularPrice: 94.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),
  listing({
    id: 'listing-lfc-2425-home-domestic',
    productId: 'product-lfc-2425-home-replica',
    storeId: 'store-jp-sample-a',
    externalId: 'jp-a-lfc-2425-h-r',
    currency: 'JPY',
    currentPrice: 17800,
    regularPrice: 17800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ----- ケースC: 送料不明のストアでの掲載 ----------------- */
  listing({
    id: 'listing-thfc-away-r-select-c',
    productId: 'product-thfc-2526-away-replica',
    storeId: 'store-select-c',
    externalId: 'select-c-thfc-2526-a-r',
    currency: 'GBP',
    currentPrice: 64.95,
    regularPrice: 64.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /*
   * 同じ商品に、送料不明のストアの「商品代だけは安い」掲載を足したもの。
   * 日本到着推定額を出せる公式ストアの方が採用されることを確かめる
   * （商品代が安いという理由だけで、総額の分からない掲載を選ばない）。
   */
  listing({
    id: 'listing-fcb-home-r-select-c',
    productId: 'product-fcb-2526-home-replica',
    storeId: 'store-select-c',
    externalId: 'select-c-fcb-2526-h-r',
    currency: 'GBP',
    currentPrice: 74.95,
    regularPrice: 74.95,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /*
   * 極端に安いフリマ出品。
   * 人の確認が取れていないモール型の出品なので、比較には使わない。
   * 「単純な最安値を採用しない」ことを確かめるためのデータ。
   */
  listing({
    id: 'listing-lfc-home-r-marketplace',
    productId: 'product-lfc-2526-home-replica',
    storeId: 'store-jp-marketplace-c',
    externalId: 'jp-c-lfc-2526-h-r',
    currency: 'JPY',
    currentPrice: 9800,
    regularPrice: 9800,
    inStock: true,
    lastCheckedAt: CHECKED_AT,
  }),

  /* ----- 在庫切れのため比較に使えない国内掲載 -------------- */
  listing({
    id: 'listing-fcb-home-r-domestic-oos',
    productId: 'product-fcb-2526-home-replica',
    storeId: 'store-jp-sample-b',
    externalId: 'jp-b-fcb-2526-h-r',
    currency: 'JPY',
    currentPrice: 22800,
    regularPrice: 22800,
    inStock: false,
    lastCheckedAt: CHECKED_AT,
  }),
]

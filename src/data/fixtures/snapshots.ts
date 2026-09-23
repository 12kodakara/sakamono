/**
 * 価格履歴（PriceSnapshot）の fixture データ。
 *
 * ★これは開発用のサンプルデータです。実際の価格推移ではありません。★
 *
 * 商品詳細ページの「価格の推移」欄が、データが入ったときにどう見えるかを
 * 確認するために用意しています。
 * 第2段階では、価格取得のたびに1件ずつ追記していく想定です。
 */

import type { CurrencyCode, PriceSnapshot } from '@/domain/types'

/** 月ごとの価格を並べたものから PriceSnapshot の配列を作る。 */
function history(
  storeListingId: string,
  currency: CurrencyCode,
  points: ReadonlyArray<{ month: string; price: number }>,
): PriceSnapshot[] {
  return points.map((point, index) => ({
    id: `snapshot-${storeListingId}-${index + 1}`,
    storeListingId,
    price: point.price,
    currency,
    recordedAt: `${point.month}-01T00:00:00.000Z`,
  }))
}

export const priceSnapshotFixtures: PriceSnapshot[] = [
  ...history('listing-thfc-home-r-official', 'GBP', [
    { month: '2026-04', price: 84.95 },
    { month: '2026-05', price: 84.95 },
    { month: '2026-06', price: 84.95 },
    { month: '2026-07', price: 79.95 },
    { month: '2026-08', price: 74.95 },
    { month: '2026-09', price: 69.95 },
  ]),
  ...history('listing-fcb-home-r-official', 'EUR', [
    { month: '2026-04', price: 109.99 },
    { month: '2026-05', price: 109.99 },
    { month: '2026-06', price: 109.99 },
    { month: '2026-07', price: 104.99 },
    { month: '2026-08', price: 104.99 },
    { month: '2026-09', price: 99.99 },
  ]),
  ...history('listing-fcb-third-r-official', 'EUR', [
    { month: '2026-04', price: 109.99 },
    { month: '2026-05', price: 109.99 },
    { month: '2026-06', price: 99.99 },
    { month: '2026-07', price: 89.99 },
    { month: '2026-08', price: 89.99 },
    { month: '2026-09', price: 79.99 },
  ]),
  // --- 第2段階で追加（ケースA: 段階的に値下げされた前シーズン品）---
  ...history('listing-lfc-2425-home-official', 'GBP', [
    { month: '2026-04', price: 94.95 },
    { month: '2026-05', price: 79.95 },
    { month: '2026-06', price: 69.95 },
    { month: '2026-07', price: 59.95 },
    { month: '2026-08', price: 49.95 },
    { month: '2026-09', price: 44.95 },
  ]),
  ...history('listing-rma-home-r-official', 'EUR', [
    { month: '2026-04', price: 94.99 },
    { month: '2026-05', price: 94.99 },
    { month: '2026-06', price: 94.99 },
    { month: '2026-07', price: 94.99 },
    { month: '2026-08', price: 94.99 },
    { month: '2026-09', price: 94.99 },
  ]),
]

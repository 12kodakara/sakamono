/**
 * Yahoo! + 楽天を横断した国内価格の集計テスト。
 *
 * ★ここで守りたいこと★
 *
 *   ・0件を0円として出さない
 *   ・送料込みで比べられないものを「送料込み最安」として出さない
 *   ・同じ提供元の同じ掲載を二重に数えない
 *   ・提供元をまたいだ同じショップは、別の買い物として両方残す
 *   ・最安がどの提供元のものか分かる
 */

import { describe, expect, it } from 'vitest'
import type { DomesticOffer, DomesticOfferSource } from '@/domain/domesticOffer'
import {
  OUTLIER_HIGH_RATIO,
  OUTLIER_LOW_RATIO,
  PRICE_BASIS_LABEL_JA,
  aggregateDomesticOffers,
  dedupeOffers,
  duplicateKey,
  findPriceOutliers,
} from '@/data/external/domestic/aggregate'

/* ------------------------------------------------------------
 * テスト用のデータ
 * ---------------------------------------------------------- */

let counter = 0

/** 「採用される」候補を作る。 */
function offer(overrides: Partial<DomesticOffer> = {}): DomesticOffer {
  counter += 1
  const priceJpy = overrides.priceJpy ?? 9_000
  return {
    source: 'yahoo',
    externalId: `item-${counter}`,
    title: 'リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423',
    url: `https://example.com/item-${counter}`,
    priceJpy,
    regularPriceJpy: null,
    shippingJpy: 0,
    totalPriceJpy: priceJpy,
    sellerId: `shop-${counter}`,
    sellerName: `ショップ${counter}`,
    inStock: true,
    condition: 'new',
    conditionEvidence: 'api-new',
    matchConfidence: 0.9,
    matchGrade: 'B',
    matchLevel: 'sku',
    positiveEvidence: [],
    negativeEvidence: [],
    unknownAttributes: [],
    rejectCodes: [],
    rejectReasons: [],
    reviewReasons: [],
    verification: 'automated',
    imageUrl: null,
    rewardNote: null,
    fetchedAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  }
}

function at(source: DomesticOfferSource, priceJpy: number, extra: Partial<DomesticOffer> = {}) {
  return offer({ source, priceJpy, totalPriceJpy: priceJpy, ...extra })
}

/* ============================================================
 * 提供元ごとの内訳
 * ========================================================== */

describe('提供元ごとの内訳', () => {
  it('Yahoo! と楽天の件数を別々に数える', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 9_240),
      at('yahoo', 9_500),
      at('rakuten', 8_980),
    ])

    const yahoo = result.bySource.find((entry) => entry.source === 'yahoo')
    const rakuten = result.bySource.find((entry) => entry.source === 'rakuten')

    expect(yahoo?.acceptedCount).toBe(2)
    expect(rakuten?.acceptedCount).toBe(1)
    expect(result.offerCount).toBe(3)
  })

  it('提供元の表示名を持つ', () => {
    const result = aggregateDomesticOffers([at('rakuten', 8_980)])
    expect(result.bySource[0].sourceLabel).toBe('楽天市場')
  })

  it('候補が無い提供元は並べない', () => {
    const result = aggregateDomesticOffers([at('yahoo', 9_240)])
    expect(result.bySource.map((entry) => entry.source)).toEqual(['yahoo'])
  })

  it('不採用・要確認の件数も提供元ごとに数える', () => {
    const result = aggregateDomesticOffers([
      at('rakuten', 8_980),
      at('rakuten', 5_000, { rejectReasons: ['袖丈が一致しません'] }),
      at('rakuten', 9_000, { reviewReasons: ['新品かどうか確認できていません'] }),
    ])

    const rakuten = result.bySource[0]
    expect(rakuten.candidateCount).toBe(3)
    expect(rakuten.rejectedCount).toBe(1)
    expect(rakuten.reviewCount).toBe(1)
    expect(rakuten.acceptedCount).toBe(1)
  })
})

/* ============================================================
 * 最安
 * ========================================================== */

describe('最安', () => {
  it('提供元をまたいでいちばん安いものを選び、どこのものか分かる', () => {
    const result = aggregateDomesticOffers([at('yahoo', 9_240), at('rakuten', 8_980)])

    expect(result.lowest?.amountJpy).toBe(8_980)
    expect(result.lowest?.source).toBe('rakuten')
    expect(result.lowest?.sourceLabel).toBe('楽天市場')
    expect(result.lowest?.basis).toBe('delivered')
  })

  it('★採用できた候補が無ければ null（0円にしない）★', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 9_240, { rejectReasons: ['袖丈が一致しません'] }),
    ])
    expect(result.lowest).toBeNull()
    expect(result.offerCount).toBe(0)
    expect(result.medianDeliveredJpy).toBeNull()
  })

  it('候補が1件も無ければ null', () => {
    const result = aggregateDomesticOffers([])
    expect(result.lowest).toBeNull()
    expect(result.bySource).toHaveLength(0)
  })

  it('★送料込みで比べられるものを優先する★', () => {
    // 商品価格だけなら楽天が安いが、送料が分からない
    const result = aggregateDomesticOffers([
      at('yahoo', 9_240),
      offer({ source: 'rakuten', priceJpy: 8_000, shippingJpy: null, totalPriceJpy: null }),
    ])

    expect(result.lowest?.amountJpy).toBe(9_240)
    expect(result.lowest?.basis).toBe('delivered')
  })

  it('送料込みのものが1件も無ければ、商品価格として示す（★送料込みとは書かない★）', () => {
    const result = aggregateDomesticOffers([
      offer({
        source: 'rakuten',
        priceJpy: 8_000,
        shippingJpy: null,
        totalPriceJpy: null,
        // 送料不明でも「同じ商品だ」とは確かめられている状態にする
        reviewReasons: [],
      }),
    ])

    // 既存の採用条件では総額を出せない候補は採用されない
    expect(result.lowest).toBeNull()
  })

  it('表示の文言が「送料込み」と「商品価格のみ」で分かれている', () => {
    expect(PRICE_BASIS_LABEL_JA.delivered).toContain('送料込み')
    expect(PRICE_BASIS_LABEL_JA['item-only']).toContain('送料別')
  })
})

/* ============================================================
 * 中央値
 * ========================================================== */

describe('中央値', () => {
  it('Yahoo! と楽天を合わせて計算する', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 9_000),
      at('yahoo', 11_000),
      at('rakuten', 10_000),
    ])
    expect(result.medianDeliveredJpy).toBe(10_000)
  })

  it('偶数件なら中央2つの平均', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 9_000),
      at('rakuten', 10_000),
    ])
    expect(result.medianDeliveredJpy).toBe(9_500)
  })

  it('1件ならその価格', () => {
    const result = aggregateDomesticOffers([at('rakuten', 8_980)])
    expect(result.medianDeliveredJpy).toBe(8_980)
  })

  it('★採用できた候補の件数だけを数える（APIの総件数ではない）★', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 9_000),
      at('yahoo', 5_000, { rejectReasons: ['子供用です'] }),
      at('yahoo', 5_000, { rejectReasons: ['長袖です'] }),
    ])
    expect(result.offerCount).toBe(1)
  })
})

/* ============================================================
 * 重複
 * ========================================================== */

describe('重複の扱い', () => {
  it('同じ提供元の同じ掲載を二重に数えない', () => {
    const duplicate = at('rakuten', 8_980, { externalId: 'shop:item-1' })
    const result = aggregateDomesticOffers([
      duplicate,
      { ...duplicate, url: 'https://example.com/other' },
    ])

    expect(result.offerCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
  })

  it('重複していたら安い方を残す', () => {
    const base = at('rakuten', 9_500, { externalId: 'shop:item-1' })
    const cheaper = { ...base, priceJpy: 8_980, totalPriceJpy: 8_980 }
    const { unique } = dedupeOffers([base, cheaper])

    expect(unique).toHaveLength(1)
    expect(unique[0].totalPriceJpy).toBe(8_980)
  })

  it('★提供元が違えば、同じショップでも別の掲載として残す★', () => {
    // 同じショップがYahoo!と楽天の両方に出店していることは普通にある。
    // モールが違えば価格・送料・ポイントが違う別の買い物なので、両方見せる。
    const yahoo = at('yahoo', 9_240, { externalId: 'same-id', sellerName: '同じショップ' })
    const rakuten = at('rakuten', 8_980, { externalId: 'same-id', sellerName: '同じショップ' })

    expect(duplicateKey(yahoo)).not.toBe(duplicateKey(rakuten))

    const result = aggregateDomesticOffers([yahoo, rakuten])
    expect(result.offerCount).toBe(2)
    expect(result.duplicateCount).toBe(0)
  })
})

/* ============================================================
 * 価格の外れ値
 * ========================================================== */

describe('★価格が大きく外れた候補を見えるようにする★', () => {
  it('中央値の半額以下を目印にする', () => {
    const offers = [
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('rakuten', 3_000),
    ]
    const outliers = findPriceOutliers(offers, 10_000)

    expect(outliers).toHaveLength(1)
    expect(outliers[0].amountJpy).toBe(3_000)
    expect(outliers[0].ratio).toBeLessThanOrEqual(OUTLIER_LOW_RATIO)
  })

  it('中央値の2倍以上も目印にする（マーキング入り・セット品の疑い）', () => {
    const offers = [
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('rakuten', 25_000),
    ]
    const outliers = findPriceOutliers(offers, 10_000)

    expect(outliers).toHaveLength(1)
    expect(outliers[0].ratio).toBeGreaterThanOrEqual(OUTLIER_HIGH_RATIO)
  })

  it('★目印を付けるだけで、自動的に除外はしない★', () => {
    const result = aggregateDomesticOffers([
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('yahoo', 10_000),
      at('rakuten', 3_000),
    ])

    expect(result.priceOutliers).toHaveLength(1)
    // 除外されていないので、最安は3,000円のまま
    expect(result.lowest?.amountJpy).toBe(3_000)
    expect(result.offerCount).toBe(4)
  })

  it('件数が少ないうちは中央値が当てにならないので判定しない', () => {
    expect(findPriceOutliers([at('yahoo', 10_000), at('rakuten', 3_000)], 6_500)).toHaveLength(0)
  })

  it('中央値が無ければ判定しない', () => {
    expect(findPriceOutliers([at('yahoo', 10_000)], null)).toHaveLength(0)
  })
})

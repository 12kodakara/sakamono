/**
 * 価格比較・割引率のテスト。
 *
 *   価格差 ＝ 国内比較価格 － 日本到着推定額
 *   プラス … 海外が安い ／ マイナス … 国内が安い
 */

import { describe, expect, it } from 'vitest'
import {
  EVEN_THRESHOLD_JPY,
  buildPriceComparison,
  describePriceDifference,
  formatSavingRate,
} from '@/domain/services/priceComparison'
import type { DomesticPriceSummary } from '@/domain/services/domesticPrice'
import { emptyDomesticPriceSummary } from '@/domain/services/domesticPrice'
import { buildLandedCost, type LandedCost } from '@/domain/services/landedCost'
import { discountRateToPercent, evaluateDiscount } from '@/domain/services/discount'

/* ------------------------------------------------------------
 * テスト用のデータ作り
 * ---------------------------------------------------------- */

function landedCost(totalJpy: number | null): LandedCost {
  return buildLandedCost({
    productPriceJpy: totalJpy ?? 7000,
    shipping:
      totalJpy === null
        ? { amountJpy: null, status: 'unknown', isEstimate: false, note: '', rule: null }
        : { amountJpy: 0, status: 'fixed', isEstimate: false, note: '', rule: null },
    importCost: { amountJpy: 0, status: 'not_applicable' },
    paymentCost: { amountJpy: 0, status: 'not_applicable', rate: 0 },
    exchangeRate: null,
  })
}

function domesticSummary(referencePriceJpy: number | null): DomesticPriceSummary {
  if (referencePriceJpy === null) return emptyDomesticPriceSummary()
  return {
    ...emptyDomesticPriceSummary(),
    referencePriceJpy,
    lowestPriceJpy: referencePriceJpy,
    medianPriceJpy: referencePriceJpy,
    referenceItemPriceJpy: referencePriceJpy,
    referenceShippingJpy: 0,
    offerCount: 1,
    examinedCount: 1,
    confidence: 'A',
  }
}

function compare(landedTotal: number | null, domesticPriceJpy: number | null) {
  return buildPriceComparison({
    productId: 'p-1',
    overseasPriceJpy: landedTotal,
    landedCost: landedCost(landedTotal),
    domesticPrice: domesticSummary(domesticPriceJpy),
  })
}

/* ------------------------------------------------------------
 * 価格差
 * ---------------------------------------------------------- */

describe('価格差', () => {
  it('★プラス: 国内15,000 / 日本到着10,000 → +5,000（海外が安い）★', () => {
    const result = compare(10_000, 15_000)

    expect(result.comparisonStatus).toBe('valid')
    expect(result.priceDifferenceJpy).toBe(5_000)
    expect(result.advantage).toBe('overseas')

    const described = describePriceDifference(result)
    expect(described.prefix).toBe('国内より')
    expect(described.amountJpy).toBe(5_000)
    expect(described.suffix).toBe('安い')
  })

  it('★マイナス: 国内10,000 / 日本到着12,000 → -2,000（国内が安い）★', () => {
    const result = compare(12_000, 10_000)

    expect(result.priceDifferenceJpy).toBe(-2_000)
    expect(result.advantage).toBe('domestic')

    const described = describePriceDifference(result)
    // マイナス記号だけを見せず、言葉で伝える
    expect(described.prefix).toBe('国内購入の方が')
    expect(described.amountJpy).toBe(2_000)
    expect(described.suffix).toBe('安い')
  })

  it('差がわずかなら「ほぼ同じ」と判定する', () => {
    const result = compare(20_000, 20_000 + EVEN_THRESHOLD_JPY)
    expect(result.advantage).toBe('even')
    expect(describePriceDifference(result).prefix).toBe('国内価格とほぼ同じ')
  })

  it('しきい値を1円でも超えれば差ありと判定する', () => {
    expect(compare(20_000, 20_000 + EVEN_THRESHOLD_JPY + 1).advantage).toBe('overseas')
    expect(compare(20_000 + EVEN_THRESHOLD_JPY + 1, 20_000).advantage).toBe('domestic')
  })
})

/* ------------------------------------------------------------
 * savingRate
 * ---------------------------------------------------------- */

describe('savingRate', () => {
  it('価格差 ÷ 国内比較価格 × 100 で求める', () => {
    const result = compare(10_000, 15_000)
    expect(result.savingRate).toBeCloseTo((5_000 / 15_000) * 100, 10)
    expect(formatSavingRate(result.savingRate)).toBe('33.3%')
  })

  it('国内の方が安ければマイナスになる', () => {
    const result = compare(12_000, 10_000)
    expect(result.savingRate).toBeCloseTo(-20, 10)
    // 表示では絶対値にする（符号ではなく言葉で伝えるため）
    expect(formatSavingRate(result.savingRate)).toBe('20.0%')
  })

  it('★0除算を起こさない★', () => {
    const result = buildPriceComparison({
      productId: 'p-1',
      overseasPriceJpy: 10_000,
      landedCost: landedCost(10_000),
      domesticPrice: { ...domesticSummary(0), referencePriceJpy: 0 },
    })

    expect(result.savingRate).toBeNull()
    expect(Number.isFinite(result.priceDifferenceJpy ?? 0)).toBe(true)
  })

  it('比較できないときは null', () => {
    expect(compare(null, 15_000).savingRate).toBeNull()
    expect(formatSavingRate(null)).toBeNull()
  })
})

/* ------------------------------------------------------------
 * 比較できない場合
 * ---------------------------------------------------------- */

describe('比較の状態', () => {
  it('日本到着推定額を出せなければ insufficient-data', () => {
    const result = compare(null, 15_000)
    expect(result.comparisonStatus).toBe('insufficient-data')
    expect(result.priceDifferenceJpy).toBeNull()
    expect(result.statusNote).toContain('算出できない')
  })

  it('海外の掲載自体が無ければ insufficient-data', () => {
    const result = buildPriceComparison({
      productId: 'p-1',
      overseasPriceJpy: null,
      landedCost: null,
      domesticPrice: domesticSummary(15_000),
    })
    expect(result.comparisonStatus).toBe('insufficient-data')
  })

  it('国内の比較対象が無ければ insufficient-data', () => {
    const result = compare(10_000, null)
    expect(result.comparisonStatus).toBe('insufficient-data')
    expect(result.statusNote).toContain('見つかっていません')
  })

  it('★信頼度不足で除外された場合は low-confidence★', () => {
    const summary: DomesticPriceSummary = {
      ...emptyDomesticPriceSummary(),
      examinedCount: 1,
      excluded: [
        {
          // 審査で落ちた候補（内容はここでは使わないので最小限）
          candidate: {} as never,
          reasons: ['low-confidence'],
          variantMismatches: [],
        },
      ],
    }

    const result = buildPriceComparison({
      productId: 'p-1',
      overseasPriceJpy: 10_000,
      landedCost: landedCost(10_000),
      domesticPrice: summary,
    })

    expect(result.comparisonStatus).toBe('low-confidence')
    expect(result.priceDifferenceJpy).toBeNull()
    expect(result.statusNote).toContain('確認できていない')
  })

  it('★バリエーション違いで除外された場合も low-confidence★', () => {
    const summary: DomesticPriceSummary = {
      ...emptyDomesticPriceSummary(),
      examinedCount: 1,
      excluded: [
        { candidate: {} as never, reasons: ['variant-mismatch'], variantMismatches: ['authenticity'] },
      ],
    }

    const result = buildPriceComparison({
      productId: 'p-1',
      overseasPriceJpy: 10_000,
      landedCost: landedCost(10_000),
      domesticPrice: summary,
    })

    expect(result.comparisonStatus).toBe('low-confidence')
  })

  it('在庫切れだけで除外された場合は insufficient-data', () => {
    const summary: DomesticPriceSummary = {
      ...emptyDomesticPriceSummary(),
      examinedCount: 1,
      excluded: [{ candidate: {} as never, reasons: ['out-of-stock'], variantMismatches: [] }],
    }

    const result = buildPriceComparison({
      productId: 'p-1',
      overseasPriceJpy: 10_000,
      landedCost: landedCost(10_000),
      domesticPrice: summary,
    })

    expect(result.comparisonStatus).toBe('insufficient-data')
  })

  it('比較できないときは表示しない', () => {
    expect(describePriceDifference(compare(null, 15_000)).show).toBe(false)
  })
})

/* ------------------------------------------------------------
 * 割引率
 * ---------------------------------------------------------- */

describe('割引率', () => {
  it('通常価格と現在価格から割引率を求める', () => {
    const result = evaluateDiscount(100, 75)
    expect(result.rate).toBeCloseTo(0.25, 10)
    expect(result.percent).toBe(25)
    expect(result.isSale).toBe(true)
    expect(result.status).toBe('sale')
  })

  it('値下げしていなければセールではない', () => {
    const result = evaluateDiscount(100, 100)
    expect(result.rate).toBe(0)
    expect(result.isSale).toBe(false)
    expect(result.status).toBe('no-discount')
  })

  it('★値上げをセールとして扱わない★', () => {
    const result = evaluateDiscount(100, 120)
    expect(result.rate).toBe(0)
    expect(result.isSale).toBe(false)
    expect(result.status).toBe('price-increase')
    // 割引率をマイナスにしない
    expect(result.rate).toBeGreaterThanOrEqual(0)
  })

  it('★regularPrice = 0 は不正として扱う（0除算しない）★', () => {
    const result = evaluateDiscount(0, 0)
    expect(result.status).toBe('invalid')
    expect(result.rate).toBe(0)
    expect(Number.isFinite(result.rate)).toBe(true)

    expect(evaluateDiscount(0, 100).status).toBe('invalid')
  })

  it('マイナスの価格は不正として扱う', () => {
    expect(evaluateDiscount(100, -1).status).toBe('invalid')
    expect(evaluateDiscount(-1, 100).status).toBe('invalid')
  })

  it('数値でない価格は不正として扱う（例外は投げない）', () => {
    expect(evaluateDiscount(Number.NaN, 100).status).toBe('invalid')
    expect(evaluateDiscount(100, Number.POSITIVE_INFINITY).status).toBe('invalid')
  })

  it('割引率は常に0〜1に収まる', () => {
    const result = evaluateDiscount(100, 0)
    expect(result.rate).toBeGreaterThanOrEqual(0)
    expect(result.rate).toBeLessThanOrEqual(1)
    expect(result.percent).toBe(100)
  })

  it('パーセントへ丸められる', () => {
    expect(discountRateToPercent(0.2534)).toBe(25)
    expect(discountRateToPercent(evaluateDiscount(94.95, 79.95).rate)).toBe(16)
  })
})

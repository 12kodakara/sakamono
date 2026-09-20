/**
 * 価格計算のテスト。
 *
 * 「日本到着推定額」「価格差」「割引率」は、このサイトの中心となる計算なので、
 * 数字が変わってしまったらすぐ気付けるようにしておく。
 *
 * 実行方法:  npm test
 */

import { describe, expect, it } from 'vitest'
import { convertToJpy, getRateToJpy } from '@/lib/pricing/fx'
import { estimateLandedCost } from '@/lib/pricing/landedCost'
import {
  EVEN_THRESHOLD_JPY,
  calculateDiscountRate,
  calculatePriceDifference,
  discountRateToPercent,
} from '@/lib/pricing/compare'
import {
  CONSUMPTION_TAX_RATE,
  DUTY_FREE_THRESHOLD_JPY,
  FX_RATES_JPY,
  PERSONAL_IMPORT_TAX_BASE_RATE,
  dutyRateFor,
  estimateInternationalShippingJpy,
} from '@/lib/pricing/config'

describe('為替換算', () => {
  it('外貨を円へ換算し、1円未満を四捨五入する', () => {
    expect(convertToJpy(100, 'GBP')).toBe(100 * FX_RATES_JPY.GBP)
    expect(convertToJpy(79.95, 'GBP')).toBe(Math.round(79.95 * FX_RATES_JPY.GBP))
  })

  it('円はそのままの額になる', () => {
    expect(convertToJpy(21800, 'JPY')).toBe(21800)
    expect(getRateToJpy('JPY')).toBe(1)
  })

  it('負の金額や数値でない値は受け付けない', () => {
    expect(() => convertToJpy(-1, 'GBP')).toThrow()
    expect(() => convertToJpy(Number.NaN, 'GBP')).toThrow()
  })
})

describe('日本到着推定額', () => {
  it('少額の商品は関税・消費税がかからない前提で計算する', () => {
    // 課税価格が1万円以下になる価格を選ぶ
    const result = estimateLandedCost({
      price: 50,
      currency: 'GBP',
      category: 'kits',
      shippingType: 'direct',
    })

    const itemPriceJpy = convertToJpy(50, 'GBP')
    expect(result.dutyFree).toBe(true)
    expect(result.dutyJpy).toBe(0)
    expect(result.consumptionTaxJpy).toBe(0)
    expect(result.customsHandlingFeeJpy).toBe(0)
    expect(result.importCostJpy).toBe(0)

    // 合計 = 商品代 + 送料 + 0 + 決済手数料
    expect(result.totalJpy).toBe(
      itemPriceJpy + estimateInternationalShippingJpy('kits', 'direct') + result.paymentFeeJpy,
    )
  })

  it('高額の商品は関税・消費税・通関手数料が加算される', () => {
    const result = estimateLandedCost({
      price: 149.99,
      currency: 'EUR',
      category: 'kits',
      shippingType: 'direct',
    })

    const itemPriceJpy = convertToJpy(149.99, 'EUR')
    const taxableValueJpy = Math.round(itemPriceJpy * PERSONAL_IMPORT_TAX_BASE_RATE)

    expect(taxableValueJpy).toBeGreaterThan(DUTY_FREE_THRESHOLD_JPY)
    expect(result.dutyFree).toBe(false)
    expect(result.dutyJpy).toBe(Math.round(taxableValueJpy * dutyRateFor('kits')))
    expect(result.consumptionTaxJpy).toBe(
      Math.round((taxableValueJpy + result.dutyJpy) * CONSUMPTION_TAX_RATE),
    )
    expect(result.customsHandlingFeeJpy).toBeGreaterThan(0)
    expect(result.importCostJpy).toBe(
      result.dutyJpy + result.consumptionTaxJpy + result.customsHandlingFeeJpy,
    )
  })

  it('内訳の合計が totalJpy と一致する', () => {
    const result = estimateLandedCost({
      price: 99.99,
      currency: 'EUR',
      category: 'kits',
      shippingType: 'direct',
    })

    expect(result.totalJpy).toBe(
      result.itemPriceJpy +
        result.internationalShippingJpy +
        result.importCostJpy +
        result.paymentFeeJpy,
    )
  })

  it('転送サービス利用の方が国際送料が高くなる', () => {
    const direct = estimateLandedCost({
      price: 80,
      currency: 'GBP',
      category: 'kits',
      shippingType: 'direct',
    })
    const forwarder = estimateLandedCost({
      price: 80,
      currency: 'GBP',
      category: 'kits',
      shippingType: 'forwarder',
    })

    expect(forwarder.internationalShippingJpy).toBeGreaterThan(direct.internationalShippingJpy)
    expect(forwarder.totalJpy).toBeGreaterThan(direct.totalJpy)
  })

  it('円建てのストアでは海外事務手数料がかからない', () => {
    const result = estimateLandedCost({
      price: 20000,
      currency: 'JPY',
      category: 'kits',
      shippingType: 'direct',
    })

    expect(result.paymentFeeJpy).toBe(0)
  })

  it('常に「推定である」印が付いている', () => {
    const result = estimateLandedCost({
      price: 10,
      currency: 'GBP',
      category: 'caps',
      shippingType: 'direct',
    })

    expect(result.isEstimate).toBe(true)
    expect(result.assumptionsVersion).toBeTruthy()
  })
})

describe('価格差', () => {
  it('国内価格の方が高ければ「海外が安い」と判定する', () => {
    const result = calculatePriceDifference(18_778, 21_800)
    expect(result.advantage).toBe('overseas')
    expect(result.amountJpy).toBe(3_022)
  })

  it('日本到着推定額の方が高ければ「国内が安い」と判定する', () => {
    const result = calculatePriceDifference(32_101, 29_800)
    expect(result.advantage).toBe('domestic')
    expect(result.amountJpy).toBe(2_301)
  })

  it('差がわずかなら「ほぼ同じ」と判定する', () => {
    const result = calculatePriceDifference(20_000, 20_000 + EVEN_THRESHOLD_JPY)
    expect(result.advantage).toBe('even')
  })

  it('しきい値を1円でも超えれば差ありと判定する', () => {
    const result = calculatePriceDifference(20_000, 20_000 + EVEN_THRESHOLD_JPY + 1)
    expect(result.advantage).toBe('overseas')
  })

  it('差額は常に0以上になる', () => {
    expect(calculatePriceDifference(30_000, 10_000).amountJpy).toBe(20_000)
    expect(calculatePriceDifference(10_000, 30_000).amountJpy).toBe(20_000)
  })

  it('国内価格が0でも割り算で壊れない', () => {
    expect(calculatePriceDifference(10_000, 0).ratio).toBe(0)
  })

  it('負の金額は受け付けない', () => {
    expect(() => calculatePriceDifference(-1, 100)).toThrow()
    expect(() => calculatePriceDifference(100, -1)).toThrow()
  })
})

describe('割引率', () => {
  it('通常価格と現在価格から割引率を求める', () => {
    expect(calculateDiscountRate(100, 75)).toBeCloseTo(0.25, 10)
    expect(discountRateToPercent(calculateDiscountRate(94.95, 79.95))).toBe(16)
  })

  it('値下げしていなければ0になる', () => {
    expect(calculateDiscountRate(100, 100)).toBe(0)
    // 現在価格の方が高い場合も0（マイナスの割引率は作らない）
    expect(calculateDiscountRate(100, 120)).toBe(0)
  })

  it('通常価格が0でも壊れない', () => {
    expect(calculateDiscountRate(0, 0)).toBe(0)
  })

  it('割引率は0〜1の範囲に収まる', () => {
    const rate = calculateDiscountRate(100, 0)
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(1)
  })
})

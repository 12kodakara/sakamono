/**
 * 日本到着推定額のテスト。
 *
 * ★不明な項目を 0 として足さないこと★ が最重要。
 */

import { describe, expect, it } from 'vitest'
import type { ImportCostRule, ShippingRule } from '@/domain/types'
import { rawMoney } from '@/domain/money'
import { createExchangeRateTable } from '@/domain/services/exchange'
import {
  buildLandedCost,
  calculateLandedCost,
  describeLandedCost,
} from '@/domain/services/landedCost'
import { estimatePaymentCost } from '@/domain/services/paymentCost'
import {
  calculateSimplifiedImportBreakdown,
  findImportCostRule,
  resolveImportCost,
} from '@/domain/services/importCost'
import { exchangeRateFixtures } from '@/data/fixtures/exchangeRates'
import { importCostRuleFixtures } from '@/data/fixtures/importCostRules'
import {
  DUTY_FREE_THRESHOLD_JPY,
  FOREIGN_TRANSACTION_FEE_RATE,
  FX_RATES_JPY,
  buildSimplifiedImportParameters,
} from '@/lib/pricing/config'

const rates = createExchangeRateTable(exchangeRateFixtures)

const fixedShipping: ShippingRule = {
  id: 'r1',
  storeId: 's1',
  destinationCountry: 'JP',
  type: 'fixed',
  currency: 'GBP',
  amount: 14,
}

const unknownShipping: ShippingRule = {
  id: 'r2',
  storeId: 's1',
  destinationCountry: 'JP',
  type: 'unknown',
  currency: 'GBP',
}

const kitsImportRule = findImportCostRule(importCostRuleFixtures, 'store-overseas-any', 'kits')

describe('輸入コストの見積り', () => {
  it('課税価格が免税ラインを超えなければ0円（推定）', () => {
    const breakdown = calculateSimplifiedImportBreakdown(
      15830,
      buildSimplifiedImportParameters('kits'),
    )
    expect(breakdown.dutyFree).toBe(true)
    expect(breakdown.dutyJpy).toBe(0)
    expect(breakdown.consumptionTaxJpy).toBe(0)
    expect(breakdown.handlingFeeJpy).toBe(0)
    expect(breakdown.taxableValueJpy).toBeLessThanOrEqual(DUTY_FREE_THRESHOLD_JPY)
  })

  it('課税価格が免税ラインを超えれば関税・消費税・手数料がかかる', () => {
    const breakdown = calculateSimplifiedImportBreakdown(
      24740,
      buildSimplifiedImportParameters('kits'),
    )
    expect(breakdown.dutyFree).toBe(false)
    expect(breakdown.dutyJpy).toBeGreaterThan(0)
    expect(breakdown.consumptionTaxJpy).toBeGreaterThan(0)
    expect(breakdown.handlingFeeJpy).toBeGreaterThan(0)
  })

  it('国内ストアは「かからない」（不明ではない）', () => {
    const rule = findImportCostRule(importCostRuleFixtures, 'store-jp-sample-a', 'kits')
    const estimate = resolveImportCost(20000, rule)
    expect(estimate.status).toBe('not_applicable')
    expect(estimate.amountJpy).toBe(0)
  })

  it('★決まりが無ければ0円ではなく不明にする★', () => {
    const estimate = resolveImportCost(20000, null)
    expect(estimate.status).toBe('unknown')
    expect(estimate.amountJpy).toBeNull()
  })

  it('method が unknown なら不明にする', () => {
    const rule: ImportCostRule = {
      id: 'x',
      storeId: 'any',
      category: 'any',
      destinationCountry: 'JP',
      method: 'unknown',
    }
    expect(resolveImportCost(20000, rule).amountJpy).toBeNull()
  })
})

describe('決済・為替関連コスト', () => {
  it('外貨建ては手数料がかかる（推定）', () => {
    const result = estimatePaymentCost({
      itemPriceJpy: 15830,
      storeCurrency: 'GBP',
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })
    expect(result.status).toBe('estimated')
    expect(result.amountJpy).toBe(Math.round(15830 * FOREIGN_TRANSACTION_FEE_RATE))
  })

  it('円建ては「かからない」（0円。不明ではない）', () => {
    const result = estimatePaymentCost({
      itemPriceJpy: 21800,
      storeCurrency: 'JPY',
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })
    expect(result.status).toBe('not_applicable')
    expect(result.amountJpy).toBe(0)
  })
})

describe('landed cost（正常）', () => {
  it('すべての項目がそろえば合計を出す', () => {
    const result = calculateLandedCost({
      itemPrice: rawMoney(69.95, 'GBP'),
      storeCurrency: 'GBP',
      category: 'kits',
      shippingRule: fixedShipping,
      importCostRule: kitsImportRule,
      rates,
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const landed = result.value

    expect(landed.productPriceJpy).toBe(Math.round(69.95 * FX_RATES_JPY.GBP))
    expect(landed.shippingJpy).toBe(Math.round(14 * FX_RATES_JPY.GBP))
    expect(landed.status).toBe('estimated')
    expect(landed.missing).toEqual([])

    // 合計が内訳どおりであること
    expect(landed.totalJpy).toBe(
      landed.productPriceJpy +
        (landed.shippingJpy ?? 0) +
        (landed.importCostJpy ?? 0) +
        (landed.paymentCostJpy ?? 0),
    )
  })

  it('円建て・送料確定・税なしなら complete になる', () => {
    const landed = buildLandedCost({
      productPriceJpy: 21800,
      shipping: { amountJpy: 0, status: 'free', isEstimate: false, note: '', rule: null },
      importCost: { amountJpy: 0, status: 'not_applicable' },
      paymentCost: { amountJpy: 0, status: 'not_applicable', rate: 0 },
      exchangeRate: null,
    })

    expect(landed.status).toBe('complete')
    expect(landed.isEstimate).toBe(false)
    expect(landed.totalJpy).toBe(21800)
  })
})

describe('landed cost（不完全）', () => {
  it('★送料不明なら合計を出さない★', () => {
    const result = calculateLandedCost({
      itemPrice: rawMoney(64.95, 'GBP'),
      storeCurrency: 'GBP',
      category: 'kits',
      shippingRule: unknownShipping,
      importCostRule: kitsImportRule,
      rates,
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const landed = result.value

    expect(landed.totalJpy).toBeNull()
    expect(landed.shippingJpy).toBeNull()
    expect(landed.status).toBe('incomplete')
    expect(landed.missing).toEqual(['shipping'])
  })

  it('★指示書の例: 商品代7,000 + 送料不明 + 輸入1,000 を 8,000 と出さない★', () => {
    const landed = buildLandedCost({
      productPriceJpy: 7000,
      shipping: { amountJpy: null, status: 'unknown', isEstimate: false, note: '', rule: null },
      importCost: { amountJpy: 1000, status: 'estimated' },
      paymentCost: { amountJpy: 0, status: 'not_applicable', rate: 0 },
      exchangeRate: null,
    })

    expect(landed.totalJpy).toBeNull()
    expect(landed.totalJpy).not.toBe(8000)
    // 参考額としてなら 8,000円 を示してよい
    expect(landed.partialTotalJpy).toBe(8000)

    const described = describeLandedCost(landed)
    expect(described.hasTotal).toBe(false)
    expect(described.displayAmountJpy).toBe(8000)
    expect(described.label).toContain('国際送料を除く')
    expect(described.note).toContain('算出できません')
  })

  it('複数の項目が不明なら、その全部を missing に入れる', () => {
    const landed = buildLandedCost({
      productPriceJpy: 7000,
      shipping: { amountJpy: null, status: 'unknown', isEstimate: false, note: '', rule: null },
      importCost: { amountJpy: null, status: 'unknown' },
      paymentCost: { amountJpy: null, status: 'unknown', rate: 0 },
      exchangeRate: null,
    })

    expect(landed.missing).toEqual(['shipping', 'importCost', 'paymentCost'])
    expect(landed.partialTotalJpy).toBe(7000)
  })

  it('合計が出せるときは「日本到着推定額」と表示してよい', () => {
    const landed = buildLandedCost({
      productPriceJpy: 7000,
      shipping: { amountJpy: 2000, status: 'fixed', isEstimate: false, note: '', rule: null },
      importCost: { amountJpy: 1000, status: 'estimated' },
      paymentCost: { amountJpy: 150, status: 'estimated', rate: 0.022 },
      exchangeRate: null,
    })

    const described = describeLandedCost(landed)
    expect(described.hasTotal).toBe(true)
    expect(described.displayAmountJpy).toBe(10150)
    expect(described.label).toBe('日本到着推定額')
  })

  it('円へ換算できない通貨なら計算自体が失敗する（0円にしない）', () => {
    const result = calculateLandedCost({
      // @ts-expect-error 対応していない通貨を渡した場合の動作を確認する
      itemPrice: { amount: 100, currency: 'CHF' },
      // @ts-expect-error 同上
      storeCurrency: 'CHF',
      category: 'kits',
      shippingRule: fixedShipping,
      importCostRule: kitsImportRule,
      rates,
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })
    expect(result.ok).toBe(false)
  })
})

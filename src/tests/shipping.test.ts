/**
 * 送料の解決のテスト。
 *
 * ★送料不明を 0円にしないこと★ が最重要。
 */

import { describe, expect, it } from 'vitest'
import type { ShippingRule } from '@/domain/types'
import { rawMoney } from '@/domain/money'
import { createExchangeRateTable } from '@/domain/services/exchange'
import { findShippingRule, resolveShipping } from '@/domain/services/shipping'
import { exchangeRateFixtures } from '@/data/fixtures/exchangeRates'
import { shippingRuleFixtures } from '@/data/fixtures/shippingRules'
import { FX_RATES_JPY } from '@/lib/pricing/config'

const rates = createExchangeRateTable(exchangeRateFixtures)

function resolve(rule: ShippingRule | null, price: number, currency: 'GBP' | 'JPY' | 'EUR') {
  const result = resolveShipping({ rule, itemPrice: rawMoney(price, currency), rates })
  if (!result.ok) throw new Error(`換算に失敗しました: ${result.error.message}`)
  return result.value
}

const base = {
  id: 'test-rule',
  storeId: 'store-test',
  destinationCountry: 'JP' as const,
}

describe('fixed（固定送料）', () => {
  it('金額をそのまま円へ換算して返す', () => {
    const rule: ShippingRule = { ...base, type: 'fixed', currency: 'GBP', amount: 14 }
    const result = resolve(rule, 69.95, 'GBP')

    expect(result.status).toBe('fixed')
    expect(result.isEstimate).toBe(false)
    expect(result.amountJpy).toBe(Math.round(14 * FX_RATES_JPY.GBP))
  })

  it('円建てならそのままの金額になる', () => {
    const rule: ShippingRule = { ...base, type: 'fixed', currency: 'JPY', amount: 550 }
    expect(resolve(rule, 19800, 'JPY').amountJpy).toBe(550)
  })
})

describe('threshold（一定金額以上で送料無料）', () => {
  const rule: ShippingRule = {
    ...base,
    type: 'threshold',
    currency: 'GBP',
    amount: 15,
    freeShippingThreshold: 150,
  }

  it('しきい値未満なら送料がかかる', () => {
    const result = resolve(rule, 79.95, 'GBP')
    expect(result.status).toBe('fixed')
    expect(result.amountJpy).toBe(Math.round(15 * FX_RATES_JPY.GBP))
  })

  it('しきい値以上なら送料無料（0円）になる', () => {
    const result = resolve(rule, 160, 'GBP')
    expect(result.status).toBe('free')
    expect(result.amountJpy).toBe(0)
    expect(result.isEstimate).toBe(false)
  })

  it('ちょうどしきい値なら送料無料になる', () => {
    expect(resolve(rule, 150, 'GBP').status).toBe('free')
  })

  it('しきい値が未設定なら不明として扱う', () => {
    const broken: ShippingRule = { ...base, type: 'threshold', currency: 'GBP', amount: 15 }
    const result = resolve(broken, 10, 'GBP')
    expect(result.status).toBe('unknown')
    expect(result.amountJpy).toBeNull()
  })
})

describe('estimated（決済画面でしか確定しない）', () => {
  it('推定として金額を返す', () => {
    const rule: ShippingRule = { ...base, type: 'estimated', currency: 'EUR', amount: 18 }
    const result = resolve(rule, 99.99, 'EUR')

    expect(result.status).toBe('estimated')
    expect(result.isEstimate).toBe(true)
    expect(result.amountJpy).toBe(Math.round(18 * FX_RATES_JPY.EUR))
  })
})

describe('unknown（送料不明）', () => {
  it('★0円ではなく null を返す★', () => {
    const rule: ShippingRule = { ...base, type: 'unknown', currency: 'GBP' }
    const result = resolve(rule, 64.95, 'GBP')

    expect(result.status).toBe('unknown')
    expect(result.amountJpy).toBeNull()
    expect(result.amountJpy).not.toBe(0)
  })

  it('決まりが見つからない場合も不明として扱う', () => {
    const result = resolve(null, 64.95, 'GBP')
    expect(result.status).toBe('unknown')
    expect(result.amountJpy).toBeNull()
  })

  it('金額が設定されていない fixed / estimated は不明として扱う', () => {
    const noAmount: ShippingRule = { ...base, type: 'fixed', currency: 'GBP' }
    expect(resolve(noAmount, 10, 'GBP').amountJpy).toBeNull()
  })
})

describe('fixture の送料ルール', () => {
  it('ストアごとに日本向けの決まりを引ける', () => {
    expect(findShippingRule(shippingRuleFixtures, 'store-lfc-official')?.type).toBe('threshold')
    expect(findShippingRule(shippingRuleFixtures, 'store-thfc-official')?.type).toBe('fixed')
    expect(findShippingRule(shippingRuleFixtures, 'store-fcb-official')?.type).toBe('estimated')
    expect(findShippingRule(shippingRuleFixtures, 'store-select-c')?.type).toBe('unknown')
  })

  it('登録の無いストアは null になる', () => {
    expect(findShippingRule(shippingRuleFixtures, 'store-does-not-exist')).toBeNull()
  })

  it('4つのタイプがすべて揃っている（計算を確かめられるように）', () => {
    const types = new Set(shippingRuleFixtures.map((rule) => rule.type))
    expect(types).toEqual(new Set(['fixed', 'threshold', 'estimated', 'unknown']))
  })
})

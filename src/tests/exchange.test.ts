/**
 * 円換算のテスト。
 *
 * ★未対応の通貨を黙って0円にしないこと★ を重点的に確かめる。
 */

import { describe, expect, it } from 'vitest'
import type { ExchangeRate } from '@/domain/types'
import { money, rawMoney } from '@/domain/money'
import { convertMoneyToJpy, createExchangeRateTable } from '@/domain/services/exchange'
import { exchangeRateFixtures } from '@/data/fixtures/exchangeRates'
import { FX_RATES_JPY } from '@/lib/pricing/config'

const rates = createExchangeRateTable(exchangeRateFixtures)

describe('レート表', () => {
  it('開発用の固定値であることが分かる', () => {
    expect(rates.containsDevelopmentFixture).toBe(true)
    for (const rate of rates.all) {
      expect(rate.kind).toBe('development-fixture')
      expect(rate.source).toContain('実勢レートではありません')
    }
  })

  it('同じ通貨が複数あれば新しい方を使う', () => {
    const older: ExchangeRate = {
      baseCurrency: 'GBP',
      quoteCurrency: 'JPY',
      rate: 100,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      source: 'old',
      kind: 'development-fixture',
    }
    const newer: ExchangeRate = { ...older, rate: 200, fetchedAt: '2026-09-01T00:00:00.000Z' }
    const table = createExchangeRateTable([older, newer])
    expect(table.find('GBP')?.rate).toBe(200)
  })
})

describe('円換算', () => {
  it('GBP → JPY', () => {
    const result = convertMoneyToJpy(rawMoney(79.95, 'GBP'), rates)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.value.amount).toBe(Math.round(79.95 * FX_RATES_JPY.GBP))
    expect(result.value.value.currency).toBe('JPY')
    expect(result.value.rate?.baseCurrency).toBe('GBP')
  })

  it('EUR → JPY', () => {
    const result = convertMoneyToJpy(rawMoney(99.99, 'EUR'), rates)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.value.amount).toBe(Math.round(99.99 * FX_RATES_JPY.EUR))
  })

  it('USD → JPY', () => {
    const result = convertMoneyToJpy(rawMoney(50, 'USD'), rates)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.value.amount).toBe(Math.round(50 * FX_RATES_JPY.USD))
  })

  it('JPY → JPY はそのまま（レートを使わない）', () => {
    const result = convertMoneyToJpy(money(21800, 'JPY'), rates)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.value.amount).toBe(21800)
    expect(result.value.rate).toBeNull()
  })

  it('★未対応の通貨は0円にせず、失敗として返す★', () => {
    // @ts-expect-error 対応していない通貨を渡した場合の動作を確認する
    const result = convertMoneyToJpy({ amount: 100, currency: 'CHF' }, rates)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('unsupported-currency')
    expect(result.error.message).toContain('対応していない通貨')
  })

  it('レートを持っていない通貨は失敗として返す', () => {
    const empty = createExchangeRateTable([])
    const result = convertMoneyToJpy(rawMoney(10, 'GBP'), empty)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('rate-not-found')
  })

  it('レートが0以下なら失敗として返す', () => {
    const broken = createExchangeRateTable([
      {
        baseCurrency: 'GBP',
        quoteCurrency: 'JPY',
        rate: 0,
        fetchedAt: '2026-09-01T00:00:00.000Z',
        source: 'test',
        kind: 'development-fixture',
      },
    ])
    const result = convertMoneyToJpy(rawMoney(10, 'GBP'), broken)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('invalid-rate')
  })

  it('金額が数値でなければ失敗として返す', () => {
    const result = convertMoneyToJpy({ amount: Number.NaN, currency: 'GBP' }, rates)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.reason).toBe('invalid-amount')
  })
})

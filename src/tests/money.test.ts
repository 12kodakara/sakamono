/**
 * Money 型のテスト。
 *
 * 金額と通貨をセットで扱えているか、丸めの方針どおりかを確かめる。
 */

import { describe, expect, it } from 'vitest'
import {
  addMoney,
  absMoney,
  compareMoney,
  isSupportedCurrency,
  jpy,
  money,
  multiplyMoney,
  rawMoney,
  roundHalfAwayFromZero,
  roundMoney,
  subtractMoney,
  sumMoney,
  toJpyNumber,
} from '@/domain/money'

describe('丸め', () => {
  it('0から遠い方へ half up で丸める（符号で挙動が変わらない）', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3)
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3)
    expect(roundHalfAwayFromZero(2.4)).toBe(2)
    expect(roundHalfAwayFromZero(-2.4)).toBe(-2)
  })

  it('小数桁を指定して丸められる', () => {
    expect(roundHalfAwayFromZero(1.005, 2)).toBe(1.01)
    expect(roundHalfAwayFromZero(79.954, 2)).toBe(79.95)
  })

  it('-0 を作らない', () => {
    expect(Object.is(roundHalfAwayFromZero(-0.4), 0)).toBe(true)
  })
})

describe('Money の作成', () => {
  it('円は整数へ丸める', () => {
    expect(jpy(15830.1).amount).toBe(15830)
    expect(jpy(15830.6).amount).toBe(15831)
  })

  it('外貨は小数2桁を保持する', () => {
    expect(money(79.954, 'GBP').amount).toBe(79.95)
    expect(money(99.999, 'EUR').amount).toBe(100)
  })

  it('未対応の通貨は受け付けない', () => {
    // @ts-expect-error 対応していない通貨を渡した場合の動作を確認する
    expect(() => money(100, 'CHF')).toThrow()
    expect(isSupportedCurrency('CHF')).toBe(false)
    expect(isSupportedCurrency('JPY')).toBe(true)
  })

  it('数値でない金額は受け付けない', () => {
    expect(() => money(Number.NaN, 'JPY')).toThrow()
  })

  it('マイナスの金額は作れる（差額を表すため）', () => {
    expect(jpy(-2121).amount).toBe(-2121)
  })
})

describe('Money の計算', () => {
  it('同じ通貨どうしは足し引きできる', () => {
    expect(addMoney(jpy(1000), jpy(234)).amount).toBe(1234)
    expect(subtractMoney(jpy(1000), jpy(234)).amount).toBe(766)
  })

  it('★通貨が違う金額は足せない★', () => {
    expect(() => addMoney(jpy(1000), money(10, 'GBP'))).toThrow()
    expect(() => subtractMoney(money(10, 'EUR'), money(10, 'GBP'))).toThrow()
    expect(() => compareMoney(jpy(1), money(1, 'USD'))).toThrow()
  })

  it('途中計算では丸めない', () => {
    const raw = multiplyMoney(rawMoney(79.95, 'GBP'), 198)
    expect(raw.amount).toBeCloseTo(15830.1, 6)
    expect(roundMoney({ ...raw, currency: 'JPY' }).amount).toBe(15830)
  })

  it('合計は通貨を指定して求める', () => {
    expect(sumMoney([jpy(100), jpy(200), jpy(300)], 'JPY').amount).toBe(600)
    expect(sumMoney([], 'JPY').amount).toBe(0)
  })

  it('絶対値を取れる', () => {
    expect(absMoney(jpy(-500)).amount).toBe(500)
  })

  it('円建て以外から円を取り出そうとするとエラーになる', () => {
    expect(toJpyNumber(jpy(100))).toBe(100)
    expect(() => toJpyNumber(money(100, 'GBP'))).toThrow()
  })
})

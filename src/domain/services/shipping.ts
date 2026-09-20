/**
 * 送料の解決。
 *
 * 「そのストアの ShippingRule」と「商品価格」から、日本までの送料を求める。
 *
 * ★unknown を 0円にしない。★
 *   送料が分からない状態を 0円として合計すると、
 *   実際より安い「日本到着推定額」を出してしまう。
 *   分からないときは amountJpy を null にして、
 *   合計を出せないことを呼び出し側へ伝える。
 */

import type { Money, ShippingRule } from '@/domain/types'
import { money, rawMoney } from '@/domain/money'
import { err, ok, type Result } from '@/lib/result'
import { convertMoneyToJpyRaw, type ExchangeError, type ExchangeRateTable } from './exchange'

/**
 * 解決した結果の状態。
 *
 *  - fixed     : 金額が確定している（固定送料、またはしきい値未満で課金）
 *  - free      : 送料無料の条件を満たした
 *  - estimated : 運営側が置いた推定値（決済画面でしか確定しない）
 *  - unknown   : 分からない
 */
export type ShippingStatus = 'fixed' | 'free' | 'estimated' | 'unknown'

export interface ShippingResolution {
  /** 送料（円）。分からない場合は null。★0 と null を混同しないこと★ */
  amountJpy: number | null
  status: ShippingStatus
  /** 推定値かどうか。true のとき画面へ「推定」と出す。 */
  isEstimate: boolean
  /** 画面や管理者向けの説明。 */
  note: string
  /** 使った決まり。見つからなければ null。 */
  rule: ShippingRule | null
}

/** 送料不明の結果を作る。 */
function unknownShipping(note: string, rule: ShippingRule | null = null): ShippingResolution {
  return { amountJpy: null, status: 'unknown', isEstimate: false, note, rule }
}

export interface ResolveShippingInput {
  /** そのストアの送料の決まり。無ければ null。 */
  rule: ShippingRule | null | undefined
  /** 商品価格（ストアの通貨建て）。送料無料の判定に使う。 */
  itemPrice: Money
  rates: ExchangeRateTable
}

/**
 * 送料を解決する。
 *
 * 送料無料のしきい値判定は、商品価格としきい値の両方を円へ直してから比べる。
 * ストアの通貨と決まりの通貨が食い違っていても正しく比べられるようにするため。
 */
export function resolveShipping(
  input: ResolveShippingInput,
): Result<ShippingResolution, ExchangeError> {
  const { rule, itemPrice, rates } = input

  if (!rule) {
    return ok(unknownShipping('このストアの日本向け送料を確認できていません。'))
  }

  if (rule.type === 'unknown') {
    return ok(
      unknownShipping(
        rule.note ?? 'このストアの日本向け送料を確認できていません。',
        rule,
      ),
    )
  }

  // fixed / threshold / estimated はいずれも amount が要る
  if (rule.amount === undefined || !Number.isFinite(rule.amount) || rule.amount < 0) {
    return ok(
      unknownShipping(
        `送料の決まり（${rule.type}）に金額が設定されていないため、送料を確定できません。`,
        rule,
      ),
    )
  }

  const amountJpyResult = convertMoneyToJpyRaw(rawMoney(rule.amount, rule.currency), rates)
  if (!amountJpyResult.ok) return err(amountJpyResult.error)
  const shippingJpy = money(amountJpyResult.value.amount, 'JPY').amount

  if (rule.type === 'fixed') {
    return ok({
      amountJpy: shippingJpy,
      status: 'fixed',
      isEstimate: false,
      note: rule.note ?? '公表されている日本向けの固定送料です。',
      rule,
    })
  }

  if (rule.type === 'estimated') {
    return ok({
      amountJpy: shippingJpy,
      status: 'estimated',
      isEstimate: true,
      note:
        rule.note ??
        '送料が決済画面でしか確定しないため、サカモノが置いた推定値を使っています。',
      rule,
    })
  }

  // ---- threshold（一定金額以上で送料無料）----
  if (rule.freeShippingThreshold === undefined || !Number.isFinite(rule.freeShippingThreshold)) {
    return ok(
      unknownShipping(
        '送料無料になる金額が設定されていないため、送料を確定できません。',
        rule,
      ),
    )
  }

  const itemJpyResult = convertMoneyToJpyRaw(itemPrice, rates)
  if (!itemJpyResult.ok) return err(itemJpyResult.error)

  const thresholdJpyResult = convertMoneyToJpyRaw(
    rawMoney(rule.freeShippingThreshold, rule.currency),
    rates,
  )
  if (!thresholdJpyResult.ok) return err(thresholdJpyResult.error)

  const isFree = itemJpyResult.value.amount >= thresholdJpyResult.value.amount
  const thresholdJpy = money(thresholdJpyResult.value.amount, 'JPY').amount

  if (isFree) {
    return ok({
      amountJpy: 0,
      status: 'free',
      isEstimate: false,
      note: rule.note ?? `${thresholdJpy.toLocaleString('ja-JP')}円以上の購入で送料無料です。`,
      rule,
    })
  }

  return ok({
    amountJpy: shippingJpy,
    status: 'fixed',
    isEstimate: false,
    note:
      rule.note ??
      `${thresholdJpy.toLocaleString('ja-JP')}円以上の購入で送料無料になります。`,
    rule,
  })
}

/** ShippingRule の一覧から、ストアの日本向けの決まりを探す。 */
export function findShippingRule(
  rules: ShippingRule[],
  storeId: string,
): ShippingRule | null {
  return rules.find((rule) => rule.storeId === storeId && rule.destinationCountry === 'JP') ?? null
}

/** 画面に出す日本語ラベル。 */
export const SHIPPING_STATUS_LABEL_JA: Record<ShippingStatus, string> = {
  fixed: '確定',
  free: '送料無料',
  estimated: '推定',
  unknown: '不明',
}

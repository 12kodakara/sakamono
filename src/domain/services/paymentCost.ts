/**
 * 決済・為替関連コストの見積り。
 *
 * 海外のストアでカード決済をすると、カード会社の「海外事務手数料」が上乗せされる。
 * 為替レートの差と合わせて、実際の請求額は商品価格の円換算より少し高くなる。
 *
 * 円建てのストア（国内購入）では発生しないので not_applicable（＝本当に0円）。
 * ★「0円」と「不明」は別物として扱う。★
 */

import type { Currency } from '@/domain/types'
import { money } from '@/domain/money'

export interface PaymentCostEstimate {
  /** 決済関連コストの推定額（円）。見積もれない場合は null。 */
  amountJpy: number | null
  status: 'estimated' | 'not_applicable' | 'unknown'
  /** 使った手数料率（0〜1）。not_applicable のときは 0。 */
  rate: number
  note?: string
}

export interface PaymentCostInput {
  /** 商品価格の円換算。 */
  itemPriceJpy: number
  /** ストアの通貨。 */
  storeCurrency: Currency
  /** 海外事務手数料の率（0〜1）。運営側が置いた推定値。 */
  foreignTransactionFeeRate: number
}

/**
 * 決済・為替関連コストを見積もる。
 *
 *  - 円建てのストア   → 0円（not_applicable）
 *  - 外貨建てのストア → 商品価格 × 手数料率（estimated）
 */
export function estimatePaymentCost(input: PaymentCostInput): PaymentCostEstimate {
  const { itemPriceJpy, storeCurrency, foreignTransactionFeeRate } = input

  if (storeCurrency === 'JPY') {
    return {
      amountJpy: 0,
      status: 'not_applicable',
      rate: 0,
      note: '円建てでの購入のため、海外事務手数料はかかりません。',
    }
  }

  if (!Number.isFinite(foreignTransactionFeeRate) || foreignTransactionFeeRate < 0) {
    return {
      amountJpy: null,
      status: 'unknown',
      rate: 0,
      note: '海外事務手数料の前提が設定されていないため、見積もれません。',
    }
  }

  return {
    amountJpy: money(itemPriceJpy * foreignTransactionFeeRate, 'JPY').amount,
    status: 'estimated',
    rate: foreignTransactionFeeRate,
    note: `カード会社の海外事務手数料を ${(foreignTransactionFeeRate * 100).toFixed(1)}% として試算しています。`,
  }
}

/** 画面に出す日本語ラベル。 */
export const PAYMENT_COST_STATUS_LABEL_JA: Record<PaymentCostEstimate['status'], string> = {
  estimated: '推定',
  not_applicable: 'かからない',
  unknown: '不明',
}

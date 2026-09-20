/**
 * 第1段階の「日本到着推定額」関数。
 *
 * ★★ 新しいコードでは使わないでください。★★
 *
 * 第2段階で、日本到着推定額の計算は
 *   src/domain/services/landedCost.ts
 * へ移しました。そちらは
 *   - 送料を ShippingRule（データ）から決める
 *   - 送料不明を 0円にせず「算出不可」として扱う
 * という第2段階の要件に対応しています。
 *
 * この関数は「カテゴリから送料を概算する」第1段階のやり方のままですが、
 * ★計算そのものは新しいサービスへ委譲しており、式を二重に持っていません。★
 * 第1段階のテストを残しておくために置いてあります。
 * 第3段階で、この関数と対応するテストは削除して構いません。
 *
 * @deprecated src/domain/services/landedCost.ts の calculateLandedCost() を使ってください。
 */

import type { CurrencyCode, ProductCategory, ShippingType } from '@/domain/types'
import { buildLandedCost } from '@/domain/services/landedCost'
import { calculateSimplifiedImportBreakdown } from '@/domain/services/importCost'
import { estimatePaymentCost } from '@/domain/services/paymentCost'
import type { ShippingResolution } from '@/domain/services/shipping'
import { convertToJpy, getRateToJpy } from './fx'
import {
  FOREIGN_TRANSACTION_FEE_RATE,
  PRICING_ASSUMPTIONS_VERSION,
  buildSimplifiedImportParameters,
  estimateInternationalShippingJpy,
} from './config'

export interface LandedCostInput {
  /** 海外ストアでの販売価格（そのストアの通貨建て）。 */
  price: number
  currency: CurrencyCode
  category: ProductCategory
  /** ストアの日本への配送形態。 */
  shippingType: ShippingType
}

export interface LandedCostBreakdown {
  itemPriceJpy: number
  internationalShippingJpy: number
  dutyJpy: number
  consumptionTaxJpy: number
  customsHandlingFeeJpy: number
  importCostJpy: number
  paymentFeeJpy: number
  totalJpy: number
  fxRate: number
  dutyFree: boolean
  isEstimate: true
  assumptionsVersion: string
}

/**
 * @deprecated calculateLandedCost()（src/domain/services/landedCost.ts）を使ってください。
 */
export function estimateLandedCost(input: LandedCostInput): LandedCostBreakdown {
  const { price, currency, category, shippingType } = input

  const itemPriceJpy = convertToJpy(price, currency)
  const internationalShippingJpy = estimateInternationalShippingJpy(category, shippingType)

  const breakdown = calculateSimplifiedImportBreakdown(
    itemPriceJpy,
    buildSimplifiedImportParameters(category),
  )
  const importCostJpy = breakdown.dutyJpy + breakdown.consumptionTaxJpy + breakdown.handlingFeeJpy

  const paymentCost = estimatePaymentCost({
    itemPriceJpy,
    storeCurrency: currency,
    foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
  })

  // 第1段階のやり方では送料は常に「分かっている」扱いなので、確定値として組み立てる
  const shipping: ShippingResolution = {
    amountJpy: internationalShippingJpy,
    status: 'estimated',
    isEstimate: true,
    note: '第1段階のカテゴリ別概算',
    rule: null,
  }

  const landedCost = buildLandedCost({
    productPriceJpy: itemPriceJpy,
    shipping,
    importCost: { amountJpy: importCostJpy, status: 'estimated' },
    paymentCost,
    exchangeRate: null,
  })

  return {
    itemPriceJpy,
    internationalShippingJpy,
    dutyJpy: breakdown.dutyJpy,
    consumptionTaxJpy: breakdown.consumptionTaxJpy,
    customsHandlingFeeJpy: breakdown.handlingFeeJpy,
    importCostJpy,
    paymentFeeJpy: paymentCost.amountJpy ?? 0,
    // buildLandedCost がすべてそろっていると判断した場合のみ値が入る
    totalJpy: landedCost.totalJpy ?? landedCost.partialTotalJpy,
    fxRate: getRateToJpy(currency),
    dutyFree: breakdown.dutyFree,
    isEstimate: true,
    assumptionsVersion: PRICING_ASSUMPTIONS_VERSION,
  }
}

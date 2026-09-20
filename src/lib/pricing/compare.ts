/**
 * 第1段階の価格差・割引率の関数。
 *
 * ★★ 新しいコードでは使わないでください。★★
 *
 * 第2段階で、計算の中身は
 *   src/domain/services/priceComparison.ts （価格差）
 *   src/domain/services/discount.ts        （割引率）
 * へ移しました。
 *
 * このファイルは、第1段階から使っている呼び出し名を残すための薄い層です。
 * ★式は持たず、すべてサービスへ委譲しています。★
 *
 * @deprecated buildPriceComparison() / evaluateDiscount() を使ってください。
 */

import {
  EVEN_THRESHOLD_JPY as SERVICE_EVEN_THRESHOLD_JPY,
  type PriceAdvantage as ServicePriceAdvantage,
} from '@/domain/services/priceComparison'
import {
  discountRateToPercent as serviceDiscountRateToPercent,
  evaluateDiscount,
} from '@/domain/services/discount'

/** 「ほぼ同じ」とみなす差額の上限（円）。定義元は priceComparison サービス。 */
export const EVEN_THRESHOLD_JPY = SERVICE_EVEN_THRESHOLD_JPY

/** 価格差の向き。 */
export type PriceAdvantage = ServicePriceAdvantage

export interface PriceDifference {
  /** 差額（円）。常に0以上の絶対値。 */
  amountJpy: number
  /** どちらが安いか。 */
  advantage: PriceAdvantage
  /** 国内価格に対する差の割合（0〜1）。国内価格が0のときは0。 */
  ratio: number
}

/**
 * 日本到着推定額と国内価格を比べる。
 *
 * @deprecated buildPriceComparison() を使ってください。
 */
export function calculatePriceDifference(
  landedTotalJpy: number,
  domesticPriceJpy: number,
): PriceDifference {
  assertNonNegative(landedTotalJpy, 'landedTotalJpy')
  assertNonNegative(domesticPriceJpy, 'domesticPriceJpy')

  const diff = domesticPriceJpy - landedTotalJpy
  const amountJpy = Math.abs(diff)

  let advantage: PriceAdvantage = 'even'
  if (amountJpy > EVEN_THRESHOLD_JPY) {
    advantage = diff > 0 ? 'overseas' : 'domestic'
  }

  const ratio = domesticPriceJpy === 0 ? 0 : amountJpy / domesticPriceJpy

  return { amountJpy, advantage, ratio }
}

/**
 * 割引率を計算する（0〜1）。
 * 判定は evaluateDiscount() が行う。値上げ・通常価格0などは0を返す。
 *
 * @deprecated evaluateDiscount() を使ってください（状態も一緒に受け取れます）。
 */
export function calculateDiscountRate(regularPrice: number, currentPrice: number): number {
  assertNonNegative(regularPrice, 'regularPrice')
  assertNonNegative(currentPrice, 'currentPrice')
  return evaluateDiscount(regularPrice, currentPrice).rate
}

/** 割引率をパーセントの整数へ丸める（例: 0.2534 -> 25）。 */
export const discountRateToPercent = serviceDiscountRateToPercent

function assertNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} が数値ではありません: ${value}`)
  }
  if (value < 0) {
    throw new Error(`${label} が負の値です: ${value}`)
  }
}

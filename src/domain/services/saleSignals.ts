/**
 * 注目セールの判定に使う「材料」。
 *
 * ★第2段階では複雑なランキングは作らない。★
 *   将来ランキングを組むときに必要になる入力値を、
 *   1つの型にまとめておくところまでを担当する。
 *
 * 入力に使う材料:
 *   割引率 / 価格差 / 商品一致の信頼度 / 在庫 / データ鮮度
 */

import type { ConfidenceGrade } from '@/domain/types'
import { isAutoComparableGrade } from '@/lib/matching/confidence'
import type { FreshnessLevel } from './freshness'

export interface SaleSignals {
  /** 海外ストアでの割引率（0〜1）。 */
  discountRate: number
  /** 国内比較価格との差（円）。プラスなら海外が安い。比較できなければ null。 */
  priceDifferenceJpy: number | null
  /** 国内比較に採用した掲載の商品一致ランク。 */
  confidenceGrade: ConfidenceGrade | null
  /** 海外ストアに在庫があるか。 */
  inStock: boolean
  /** 価格データの鮮度。 */
  freshness: FreshnessLevel
  /** 価格確認からの経過日数。 */
  ageDays: number | null
}

/**
 * 重み。第2段階では暫定値。
 * 実データが入る第3段階で、実際の反応を見ながら調整する。
 */
export const SALE_SCORE_WEIGHTS = {
  /** 割引率1.0あたりの点数。 */
  discount: 100,
  /** 価格差1,000円あたりの点数。 */
  priceDifferencePer1000Jpy: 4,
  /** 商品一致ランクによる加点。 */
  gradeBonus: { A: 20, B: 10, C: 0, D: 0 } as Record<ConfidenceGrade, number>,
  /** 在庫切れの減点。 */
  outOfStockPenalty: 60,
  /** 情報が古い場合の減点。 */
  stalePenalty: 25,
} as const

/**
 * 材料から点数を出す。
 *
 * 単純な重み付き合計。順位付けの目安であり、精度を主張するものではない。
 */
export function scoreSaleCandidate(
  signals: SaleSignals,
  weights = SALE_SCORE_WEIGHTS,
): number {
  let score = signals.discountRate * weights.discount

  if (signals.priceDifferenceJpy !== null && signals.priceDifferenceJpy > 0) {
    score += (signals.priceDifferenceJpy / 1000) * weights.priceDifferencePer1000Jpy
  }

  if (signals.confidenceGrade) {
    score += weights.gradeBonus[signals.confidenceGrade]
  }

  if (!signals.inStock) score -= weights.outOfStockPenalty
  if (signals.freshness === 'stale') score -= weights.stalePenalty

  return score
}

/**
 * 注目セールとして公開面へ出してよいか。
 *
 * 値下げしていること・在庫があることが最低条件。
 * 価格差を根拠に押し出す場合は、商品一致ランクが A / B であることも要る。
 */
export function isFeaturableSale(signals: SaleSignals): boolean {
  if (signals.discountRate <= 0) return false
  if (!signals.inStock) return false
  if (signals.priceDifferenceJpy !== null && signals.confidenceGrade) {
    return isAutoComparableGrade(signals.confidenceGrade)
  }
  return true
}

/**
 * 価格比較。第2段階の出口にあたるサービス。
 *
 * 日本到着推定額（landed cost）と国内比較価格をつき合わせて、
 * 「どちらがいくら安いのか」「そもそも比較してよいのか」をまとめて返す。
 *
 * ── 価格差の計算式 ──────────────────────────────
 *
 *     価格差 ＝ 国内比較価格 － 日本到着推定額
 *
 *   プラス … 海外から取り寄せた方が安い
 *   マイナス … 国内で買った方が安い
 *
 *   例) 国内 15,000円 / 日本到着推定 10,000円 → +5,000 →「国内より5,000円安い」
 *       国内 10,000円 / 日本到着推定 12,000円 → -2,000 →「国内購入の方が2,000円安い」
 *
 *   ★マイナス記号だけを画面へ出さない。★
 *     符号の意味は人によって読み方が変わるので、必ず言葉で示す。
 * ──────────────────────────────────────────────
 */

import type { ConfidenceGrade } from '@/domain/types'
import type { DomesticPriceSummary } from './domesticPrice'
import type { LandedCost } from './landedCost'

/** この差額以内なら「ほぼ同じ」とみなす（円）。 */
export const EVEN_THRESHOLD_JPY = 100

/** どちらが安いか。 */
export type PriceAdvantage = 'overseas' | 'domestic' | 'even'

export type ComparisonStatus =
  /** 比較できた */
  | 'valid'
  /** 価格や送料の情報が足りず比較できない */
  | 'insufficient-data'
  /** 国内商品との一致が確認できていないため比較しない */
  | 'low-confidence'

export interface PriceComparison {
  productId: string
  /** 海外ストアでの商品価格の円換算（送料などを含まない）。 */
  overseasPriceJpy: number | null
  /** 日本到着推定額の内訳。海外の掲載が無ければ null。 */
  landedCost: LandedCost | null
  domesticPrice: DomesticPriceSummary
  /**
   * 価格差（円）。国内比較価格 － 日本到着推定額。
   * プラスなら海外が安い。比較できない場合は null。
   */
  priceDifferenceJpy: number | null
  /** 国内比較価格に対する価格差の割合（％）。比較できない場合は null。 */
  savingRate: number | null
  /** どちらが安いか。比較できない場合は null。 */
  advantage: PriceAdvantage | null
  comparisonStatus: ComparisonStatus
  /** 画面や管理者へそのまま出せる説明。 */
  statusNote: string
  /** 採用した国内掲載の商品一致ランク。 */
  domesticConfidence: ConfidenceGrade | null
}

export interface BuildPriceComparisonInput {
  productId: string
  /** 海外ストアでの商品価格の円換算。海外の掲載が無ければ null。 */
  overseasPriceJpy: number | null
  landedCost: LandedCost | null
  domesticPrice: DomesticPriceSummary
}

/**
 * 「同じ商品と確認できなかったせいで国内価格が決まらなかった」のか、
 * 「そもそも国内の取り扱いが無かった」のかを見分ける。
 */
function excludedForConfidenceReasons(summary: DomesticPriceSummary): boolean {
  return summary.excluded.some((entry) =>
    entry.reasons.some(
      (reason) =>
        reason === 'low-confidence' ||
        reason === 'variant-mismatch' ||
        reason === 'untrusted-store',
    ),
  )
}

export function buildPriceComparison(input: BuildPriceComparisonInput): PriceComparison {
  const { productId, overseasPriceJpy, landedCost, domesticPrice } = input

  const base = {
    productId,
    overseasPriceJpy,
    landedCost,
    domesticPrice,
    domesticConfidence: domesticPrice.confidence,
  }

  // --- 海外側が出せない ---
  if (!landedCost) {
    return {
      ...base,
      priceDifferenceJpy: null,
      savingRate: null,
      advantage: null,
      comparisonStatus: 'insufficient-data',
      statusNote: '海外ストアでの取り扱いを確認できていません。',
    }
  }

  if (landedCost.totalJpy === null) {
    return {
      ...base,
      priceDifferenceJpy: null,
      savingRate: null,
      advantage: null,
      comparisonStatus: 'insufficient-data',
      statusNote:
        '国際送料などが分からず日本到着推定額を算出できないため、価格差を出せません。',
    }
  }

  // --- 国内側が出せない ---
  if (domesticPrice.referencePriceJpy === null) {
    if (excludedForConfidenceReasons(domesticPrice)) {
      return {
        ...base,
        priceDifferenceJpy: null,
        savingRate: null,
        advantage: null,
        comparisonStatus: 'low-confidence',
        statusNote:
          '国内で見つかった商品が同じものだと確認できていないため、価格差は表示していません。',
      }
    }

    return {
      ...base,
      priceDifferenceJpy: null,
      savingRate: null,
      advantage: null,
      comparisonStatus: 'insufficient-data',
      statusNote:
        domesticPrice.examinedCount === 0
          ? '国内の比較対象がまだ見つかっていません。'
          : '国内の在庫や送料条件を確認できないため、価格差を出せません。',
    }
  }

  // --- 比較できる ---
  const priceDifferenceJpy = domesticPrice.referencePriceJpy - landedCost.totalJpy

  let advantage: PriceAdvantage = 'even'
  if (Math.abs(priceDifferenceJpy) > EVEN_THRESHOLD_JPY) {
    advantage = priceDifferenceJpy > 0 ? 'overseas' : 'domestic'
  }

  const savingRate =
    domesticPrice.referencePriceJpy > 0
      ? (priceDifferenceJpy / domesticPrice.referencePriceJpy) * 100
      : null

  return {
    ...base,
    priceDifferenceJpy,
    savingRate,
    advantage,
    comparisonStatus: 'valid',
    statusNote:
      landedCost.status === 'complete'
        ? '確定している費用どうしの比較です。'
        : '日本到着推定額には送料・輸入コストなどの推定を含みます。',
  }
}

/**
 * 価格差を日本語の一文にする。
 *
 * ★符号ではなく言葉で伝える。★
 */
export function describePriceDifference(comparison: PriceComparison): {
  /** 表示してよいか。 */
  show: boolean
  advantage: PriceAdvantage | null
  /** 「国内より」「国内購入の方が」などの前置き。 */
  prefix: string
  /** 金額（常に0以上）。 */
  amountJpy: number
  /** 「安い」などの後置き。 */
  suffix: string
} {
  if (comparison.comparisonStatus !== 'valid' || comparison.priceDifferenceJpy === null) {
    return { show: false, advantage: null, prefix: '', amountJpy: 0, suffix: '' }
  }

  const amountJpy = Math.abs(comparison.priceDifferenceJpy)

  if (comparison.advantage === 'even') {
    return { show: true, advantage: 'even', prefix: '国内価格とほぼ同じ', amountJpy: 0, suffix: '' }
  }

  if (comparison.advantage === 'domestic') {
    return {
      show: true,
      advantage: 'domestic',
      prefix: '国内購入の方が',
      amountJpy,
      suffix: '安い',
    }
  }

  return { show: true, advantage: 'overseas', prefix: '国内より', amountJpy, suffix: '安い' }
}

/** savingRate を「12.2%」のような文字列にする。 */
export function formatSavingRate(savingRate: number | null): string | null {
  if (savingRate === null || !Number.isFinite(savingRate)) return null
  return `${Math.abs(savingRate).toFixed(1)}%`
}

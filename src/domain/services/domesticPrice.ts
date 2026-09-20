/**
 * 国内の比較価格を決める。
 *
 * ★単純に「国内で見つかった最安値」を採用してはいけない。★
 *   フリマ・モールには、中古・非正規・別バリエーション・マーキング違いが混ざる。
 *   そういう出品を最安値として拾うと、価格比較そのものが壊れる。
 *
 * そこで次の順に絞ってから、残ったものの中で最安を選ぶ。
 *
 *   1. 商品同定が十分か      … ランクA/B、または人が確認済み
 *   2. バリエーションが一致か … レプリカ/オーセンティック、袖丈、対象などが同じ
 *   3. 販売元が信頼できるか   … モール型は人の確認が必要
 *   4. 在庫があるか
 *   5. 送料の条件が分かるか   … 分からなければ総額を出せない
 *
 * 除外したものは捨てずに excluded として残す。
 * 「なぜ価格差を出していないのか」を画面や管理者へ説明するために使う。
 */

import type {
  ConfidenceGrade,
  DomesticMatch,
  Product,
  Store,
  StoreListing,
} from '@/domain/types'
import { isComparable, isTrustedDomesticStore, toConfidenceGrade } from '@/lib/matching/confidence'
import type { ShippingResolution } from './shipping'
import { checkVariantCompatibility, type VariantMismatchReason } from './variantMatch'

/* ------------------------------------------------------------
 * 除外理由
 * ---------------------------------------------------------- */

export type DomesticExclusionReason =
  /** 商品同定の信頼度が足りない（ランクC/D かつ未確認） */
  | 'low-confidence'
  /** バリエーションが食い違っている */
  | 'variant-mismatch'
  /** 在庫切れ */
  | 'out-of-stock'
  /** 販売元が信頼できない（モール型で未確認） */
  | 'untrusted-store'
  /** 国内送料が分からず総額を出せない */
  | 'shipping-unknown'
  /** 商品や価格のデータがそろっていない */
  | 'missing-data'

export const DOMESTIC_EXCLUSION_LABEL_JA: Record<DomesticExclusionReason, string> = {
  'low-confidence': '同じ商品かどうかの確認が取れていない',
  'variant-mismatch': '仕様が異なる商品',
  'out-of-stock': '在庫切れ',
  'untrusted-store': '販売元の確認が取れていない',
  'shipping-unknown': '国内送料が不明',
  'missing-data': '情報が不足している',
}

/* ------------------------------------------------------------
 * 候補
 * ---------------------------------------------------------- */

export interface DomesticOfferCandidate {
  listing: StoreListing
  store: Store
  match: DomesticMatch
  /** その掲載が指している商品。バリエーション照合に使う。 */
  product: Product | null
  /** 国内送料の解決結果。 */
  shipping: ShippingResolution
  /** 商品価格の円換算（国内なのでそのまま円）。 */
  itemPriceJpy: number
  /** 商品一致のランク。 */
  grade: ConfidenceGrade
}

/** 比較に使える候補（送料込みの総額が確定しているもの）。 */
export interface EligibleDomesticOffer extends DomesticOfferCandidate {
  /** 商品価格＋国内送料。 */
  totalPriceJpy: number
  /** 国内送料（円）。 */
  shippingJpy: number
}

export interface ExcludedDomesticOffer {
  candidate: DomesticOfferCandidate
  reasons: DomesticExclusionReason[]
  /** バリエーションが食い違っていた場合、その項目。 */
  variantMismatches: VariantMismatchReason[]
}

/* ------------------------------------------------------------
 * まとめ
 * ---------------------------------------------------------- */

/**
 * 国内価格のまとめ。
 *
 * ★金額はすべて「商品価格＋国内送料」の総額。★
 *   日本到着推定額（送料を含む）と条件をそろえて比べるため。
 *   内訳は referenceItemPriceJpy / referenceShippingJpy で確認できる。
 */
export interface DomesticPriceSummary {
  /** 比較に採用した国内価格（送料込みの総額）。採用できなければ null。 */
  referencePriceJpy: number | null
  /** 採用候補のうち最も安い総額。 */
  lowestPriceJpy: number | null
  /** 採用候補の総額の中央値。 */
  medianPriceJpy: number | null
  /** 採用した掲載の商品価格（送料別）。 */
  referenceItemPriceJpy: number | null
  /** 採用した掲載の国内送料。 */
  referenceShippingJpy: number | null
  /** 比較に使えた掲載の件数。 */
  offerCount: number
  /** 照合結果として存在した掲載の件数（除外したものを含む）。 */
  examinedCount: number
  /** 採用した掲載の商品一致ランク。採用できなければ null。 */
  confidence: ConfidenceGrade | null
  /** 採用した掲載。 */
  reference: EligibleDomesticOffer | null
  /** 比較に使えた掲載すべて（安い順）。 */
  eligible: EligibleDomesticOffer[]
  /** 除外した掲載と、その理由。 */
  excluded: ExcludedDomesticOffer[]
}

/**
 * 候補1件を審査する。
 * 除外理由の配列を返す（空なら比較に使える）。
 */
export function evaluateDomesticOffer(
  candidate: DomesticOfferCandidate,
  overseasProduct: Product,
): { reasons: DomesticExclusionReason[]; variantMismatches: VariantMismatchReason[] } {
  const reasons: DomesticExclusionReason[] = []
  let variantMismatches: VariantMismatchReason[] = []

  // 1. 商品同定の信頼度
  if (!isComparable(candidate.match)) {
    reasons.push('low-confidence')
  }

  // 2. バリエーションの一致
  if (!candidate.product) {
    reasons.push('missing-data')
  } else {
    const compatibility = checkVariantCompatibility(overseasProduct, candidate.product)
    if (!compatibility.compatible) {
      reasons.push('variant-mismatch')
      variantMismatches = compatibility.mismatches
    }
  }

  // 3. 販売元の信頼
  if (!isTrustedDomesticStore(candidate.store, candidate.match)) {
    reasons.push('untrusted-store')
  }

  // 4. 在庫
  if (!candidate.listing.inStock) {
    reasons.push('out-of-stock')
  }

  // 5. 送料条件
  if (candidate.shipping.amountJpy === null) {
    reasons.push('shipping-unknown')
  }

  return { reasons, variantMismatches }
}

/** 数値の中央値（整数へ丸める）。 */
function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/**
 * 候補一覧から国内比較価格を決める。
 *
 * 採用するのは「審査を通ったもののうち、送料込み総額が最も安いもの」。
 * 同額なら商品一致ランクが高い方を選ぶ。
 */
export function summarizeDomesticPrice(
  candidates: DomesticOfferCandidate[],
  overseasProduct: Product,
): DomesticPriceSummary {
  const eligible: EligibleDomesticOffer[] = []
  const excluded: ExcludedDomesticOffer[] = []

  for (const candidate of candidates) {
    const { reasons, variantMismatches } = evaluateDomesticOffer(candidate, overseasProduct)

    if (reasons.length > 0 || candidate.shipping.amountJpy === null) {
      excluded.push({ candidate, reasons, variantMismatches })
      continue
    }

    eligible.push({
      ...candidate,
      shippingJpy: candidate.shipping.amountJpy,
      totalPriceJpy: candidate.itemPriceJpy + candidate.shipping.amountJpy,
    })
  }

  const gradeOrder: Record<ConfidenceGrade, number> = { A: 0, B: 1, C: 2, D: 3 }
  eligible.sort((a, b) => {
    if (a.totalPriceJpy !== b.totalPriceJpy) return a.totalPriceJpy - b.totalPriceJpy
    return gradeOrder[a.grade] - gradeOrder[b.grade]
  })

  const reference = eligible[0] ?? null
  const totals = eligible.map((offer) => offer.totalPriceJpy)

  return {
    referencePriceJpy: reference?.totalPriceJpy ?? null,
    lowestPriceJpy: totals.length > 0 ? totals[0] : null,
    medianPriceJpy: median(totals),
    referenceItemPriceJpy: reference?.itemPriceJpy ?? null,
    referenceShippingJpy: reference?.shippingJpy ?? null,
    offerCount: eligible.length,
    examinedCount: candidates.length,
    confidence: reference?.grade ?? null,
    reference,
    eligible,
    excluded,
  }
}

/** 国内候補が1件も無いときの空のまとめ。 */
export function emptyDomesticPriceSummary(): DomesticPriceSummary {
  return {
    referencePriceJpy: null,
    lowestPriceJpy: null,
    medianPriceJpy: null,
    referenceItemPriceJpy: null,
    referenceShippingJpy: null,
    offerCount: 0,
    examinedCount: 0,
    confidence: null,
    reference: null,
    eligible: [],
    excluded: [],
  }
}

/** DomesticMatch からランクを求める補助。 */
export function gradeForMatch(match: Pick<DomesticMatch, 'confidence'>): ConfidenceGrade {
  return toConfidenceGrade(match.confidence)
}

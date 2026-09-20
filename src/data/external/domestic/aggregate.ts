/**
 * 国内価格の横断集計（Yahoo! + 楽天）。
 *
 *   Yahoo accepted offers ─┐
 *                          ├→ 重複整理 → 最安 / 中央値 / 店舗数
 *   Rakuten accepted offers┘
 *
 * ★提供元が増えてもここだけ直せば済むようにしています。★
 *   将来 KAMO・Fanatics Japan・その他の正規販売店を足すときも、
 *   DomesticOffer の形で渡してもらえれば、この関数はそのまま使えます。
 *
 * ★「安い方を採る」だけの処理にしないこと。★
 *   提供元をまたぐと、別商品・別条件のものが同じ棚に並びます。
 *   採用条件を通ったものだけを対象にし、
 *   価格の前提（送料込みか、商品価格だけか）も分けて持ちます。
 */

import type { DomesticOffer, DomesticOfferSource } from '@/domain/domesticOffer'
import {
  DOMESTIC_OFFER_SOURCE_LABEL_JA,
  STRICT_ADOPTION_POLICY,
  isAdoptableOffer,
  type AdoptionPolicy,
} from '@/domain/domesticOffer'

/* ------------------------------------------------------------
 * 価格の前提
 * ---------------------------------------------------------- */

/**
 * その金額が何を含んでいるか。
 *
 * ★「送料込み最安」と「商品価格最安」を混ぜて表示しないこと。★
 *   送料が分からない候補の商品価格を「国内最安」として出すと、
 *   実際に払う額より安い数字を見せることになります。
 */
export type PriceBasis = 'delivered' | 'item-only'

export const PRICE_BASIS_LABEL_JA: Record<PriceBasis, string> = {
  delivered: '送料込み',
  'item-only': '商品価格のみ（送料別）',
}

export interface LowestPrice {
  amountJpy: number
  basis: PriceBasis
  source: DomesticOfferSource
  /** 提供元の表示名（「楽天市場」など）。 */
  sourceLabel: string
  offer: DomesticOffer
}

/* ------------------------------------------------------------
 * 提供元ごとの内訳
 * ---------------------------------------------------------- */

export interface SourceBreakdown {
  source: DomesticOfferSource
  sourceLabel: string
  /** その提供元から受け取った候補の総数。 */
  candidateCount: number
  /** 重大な食い違いで不採用にした件数。 */
  rejectedCount: number
  /** 人の確認へ回した件数。 */
  reviewCount: number
  /** 価格比較へ自動で使える件数。 */
  acceptedCount: number
  /** 送料込みで比べられる候補の最安（0件なら null。★0円にしない★）。 */
  lowestDeliveredJpy: number | null
  /** 商品価格だけで見たときの最安（0件なら null）。 */
  lowestItemJpy: number | null
}

export interface DomesticAggregate {
  /** 提供元ごとの内訳（指示書21）。 */
  bySource: SourceBreakdown[]
  /** すべての提供元の候補総数。 */
  candidateCount: number
  /** 自動採用できた候補（安い順）。 */
  accepted: DomesticOffer[]
  /** 自動採用の件数（＝比較対象の店舗数）。 */
  offerCount: number
  /**
   * 国内最安。
   * ★送料込みで比べられるものがあればそちらを優先します。★
   *   1件も無ければ、商品価格だけの最安を basis='item-only' で返します。
   *   その場合、画面では「送料込み」と書いてはいけません。
   */
  lowest: LowestPrice | null
  /** 送料込みで比べられる候補の中央値（0件なら null）。 */
  medianDeliveredJpy: number | null
  /** 重複として取り除いた件数。 */
  duplicateCount: number
  /**
   * 中央値から大きく外れた候補（指示書34）。
   * ★第5段階では自動的に除外しません。記録して見えるようにするだけです。★
   */
  priceOutliers: PriceOutlier[]
}

export interface PriceOutlier {
  offer: DomesticOffer
  amountJpy: number
  medianJpy: number
  /** 中央値に対する比。0.4 なら中央値の40%。 */
  ratio: number
  reason: string
}

/**
 * 中央値からこの割合を下回ったら「気に留める」しきい値。
 *
 * ★安いこと自体を偽物の証拠にしません。★
 *   正規のセール・在庫処分でも半額になります。
 *   ここで出すのは「人が見たほうがよい」という目印だけです。
 */
export const OUTLIER_LOW_RATIO = 0.5

/** 逆に高すぎるもの（マーキング入り・セット品の取り違えが疑われる）。 */
export const OUTLIER_HIGH_RATIO = 2.0

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/* ------------------------------------------------------------
 * 重複の整理
 * ---------------------------------------------------------- */

/**
 * 同じ提供元の中で、明らかに同じ掲載を二重に数えないための鍵。
 *
 * ★提供元をまたいだ重複は取り除きません。★
 *   同じショップがYahoo!と楽天の両方に出店していても、
 *   モールが違えば価格・送料・ポイントが違う別の買い物です。
 *   どちらが安いかを見せるのがサカモノの役目なので、両方残します。
 */
export function duplicateKey(offer: DomesticOffer): string {
  return `${offer.source}::${offer.externalId || offer.url}`
}

/**
 * 同一提供元内の重複を取り除く。
 *
 * 同じ鍵のものが複数あれば、★安い方★を残します
 * （同じ掲載が別々の検索で拾われ、片方だけ価格が古いことがあるため）。
 */
export function dedupeOffers(offers: DomesticOffer[]): {
  unique: DomesticOffer[]
  duplicateCount: number
} {
  const byKey = new Map<string, DomesticOffer>()
  let duplicateCount = 0

  for (const offer of offers) {
    const key = duplicateKey(offer)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, offer)
      continue
    }
    duplicateCount += 1
    const existingPrice = existing.totalPriceJpy ?? existing.priceJpy
    const candidatePrice = offer.totalPriceJpy ?? offer.priceJpy
    if (candidatePrice < existingPrice) byKey.set(key, offer)
  }

  return { unique: [...byKey.values()], duplicateCount }
}

/* ------------------------------------------------------------
 * 集計
 * ---------------------------------------------------------- */

function breakdownFor(
  source: DomesticOfferSource,
  offers: DomesticOffer[],
  policy: AdoptionPolicy,
): SourceBreakdown {
  const ofSource = offers.filter((offer) => offer.source === source)
  const accepted = ofSource.filter((offer) => isAdoptableOffer(offer, policy))

  const delivered = accepted
    .map((offer) => offer.totalPriceJpy)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b)

  const items = accepted.map((offer) => offer.priceJpy).sort((a, b) => a - b)

  return {
    source,
    sourceLabel: DOMESTIC_OFFER_SOURCE_LABEL_JA[source],
    candidateCount: ofSource.length,
    rejectedCount: ofSource.filter((offer) => offer.rejectReasons.length > 0).length,
    reviewCount: ofSource.filter(
      (offer) => offer.rejectReasons.length === 0 && offer.reviewReasons.length > 0,
    ).length,
    acceptedCount: accepted.length,
    lowestDeliveredJpy: delivered.length > 0 ? delivered[0] : null,
    lowestItemJpy: items.length > 0 ? items[0] : null,
  }
}

/**
 * Yahoo! と楽天の候補をまとめて、国内価格の全体像を作る。
 *
 * @param allOffers すべての提供元の候補（採用されなかったものも含めて渡す）
 * @param policy    採用の方針。既定はいちばん厳しい設定。
 */
export function aggregateDomesticOffers(
  allOffers: DomesticOffer[],
  policy: AdoptionPolicy = STRICT_ADOPTION_POLICY,
): DomesticAggregate {
  const { unique, duplicateCount } = dedupeOffers(allOffers)

  // 実際に現れた提供元だけを、決まった順で並べる
  const order: DomesticOfferSource[] = ['yahoo', 'rakuten', 'manual']
  const presentSources = order.filter((source) =>
    unique.some((offer) => offer.source === source),
  )
  const bySource = presentSources.map((source) => breakdownFor(source, unique, policy))

  const accepted = unique.filter((offer) => isAdoptableOffer(offer, policy))

  /* ---- 最安 ---- */
  // ★送料込みで比べられるものを優先する。★
  const delivered = accepted
    .filter((offer) => offer.totalPriceJpy !== null)
    .sort((a, b) => (a.totalPriceJpy as number) - (b.totalPriceJpy as number))

  let lowest: LowestPrice | null = null
  if (delivered.length > 0) {
    const best = delivered[0]
    lowest = {
      amountJpy: best.totalPriceJpy as number,
      basis: 'delivered',
      source: best.source,
      sourceLabel: DOMESTIC_OFFER_SOURCE_LABEL_JA[best.source],
      offer: best,
    }
  } else if (accepted.length > 0) {
    // 送料が分かるものが1件も無い場合だけ、商品価格で見る。
    // ★このとき「送料込み最安」と表示してはいけない。★
    const byItem = [...accepted].sort((a, b) => a.priceJpy - b.priceJpy)
    const best = byItem[0]
    lowest = {
      amountJpy: best.priceJpy,
      basis: 'item-only',
      source: best.source,
      sourceLabel: DOMESTIC_OFFER_SOURCE_LABEL_JA[best.source],
      offer: best,
    }
  }

  /* ---- 中央値（送料込みで比べられるものだけ）---- */
  const medianDeliveredJpy = median(delivered.map((offer) => offer.totalPriceJpy as number))

  return {
    bySource,
    candidateCount: unique.length,
    accepted: delivered.length > 0 ? delivered : [...accepted].sort((a, b) => a.priceJpy - b.priceJpy),
    offerCount: accepted.length,
    lowest,
    medianDeliveredJpy,
    duplicateCount,
    priceOutliers: findPriceOutliers(accepted, medianDeliveredJpy),
  }
}

/**
 * 中央値から大きく外れた候補を探す。
 *
 * ★第5段階では自動的に除外しません。★
 *   指示書34のとおり、見えるようにするだけです。
 *   安すぎるものは「別商品（キッズ・別シーズン・アクセサリー）」のことも、
 *   ただのセールのこともあります。高すぎるものは
 *   「マーキング入り・セット品」の取り違えが疑われます。
 *   どちらも人が見て判断すべきもので、自動で捨てると正しい出品まで失います。
 */
export function findPriceOutliers(
  accepted: DomesticOffer[],
  medianJpy: number | null,
): PriceOutlier[] {
  // 中央値が意味を持つのは、ある程度の件数がそろってから
  if (medianJpy === null || medianJpy <= 0 || accepted.length < 4) return []

  const outliers: PriceOutlier[] = []

  for (const offer of accepted) {
    const amountJpy = offer.totalPriceJpy ?? offer.priceJpy
    const ratio = amountJpy / medianJpy

    if (ratio <= OUTLIER_LOW_RATIO) {
      outliers.push({
        offer,
        amountJpy,
        medianJpy,
        ratio,
        reason:
          '中央値の半額以下です。別商品（子供用・別シーズン・アクセサリー）が混ざっていないか確認してください',
      })
    } else if (ratio >= OUTLIER_HIGH_RATIO) {
      outliers.push({
        offer,
        amountJpy,
        medianJpy,
        ratio,
        reason:
          '中央値の2倍以上です。選手名入りやセット商品が混ざっていないか確認してください',
      })
    }
  }

  return outliers
}

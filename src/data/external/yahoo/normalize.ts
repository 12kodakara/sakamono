/**
 * YahooAdapter — Yahoo!の生データをサカモノの形へ写す。
 *
 *   YahooRawProduct
 *        ↓  照合エンジン（src/lib/matching/engine.ts）で一致度を判定
 *   DomesticOffer（提供元によらない共通の形）
 *        ↓
 *   Store / StoreListing / DomesticMatch / ShippingRule
 *        ↓
 *   既存の価格比較エンジン（第2段階）— 変更不要
 *
 * ★画面は YahooRawProduct を絶対に参照しない。★
 */

import type {
  DomesticMatch,
  Product,
  ProductCondition,
  ShippingRule,
  Store,
  StoreListing,
} from '@/domain/types'
import type { DomesticOffer } from '@/domain/domesticOffer'
import { isAdoptableOffer } from '@/domain/domesticOffer'
import {
  MATCH_DIMENSION_LABEL_JA,
  evaluateMatch,
  type MatchContext,
} from '@/lib/matching/engine'
import { evaluateDiscount } from '@/domain/services/discount'
import { toSlug } from '@/lib/slug'
import type { YahooRawProduct } from './types'

/* ------------------------------------------------------------
 * 送料の読み取り
 * ---------------------------------------------------------- */

/**
 * Yahoo!の送料表示から、国内送料（円）を読み取る。
 *
 * ★「条件付き送料無料」は null（不明）にする。★
 *   いくら以上で無料になるのか分からないため、0円と決めつけると
 *   実際より安い総額を出してしまいます。
 */
export function readShippingJpy(label: string | null): number | null {
  const text = (label ?? '').normalize('NFKC')
  if (text.includes('送料無料') && !text.includes('条件')) return 0
  return null
}

/* ------------------------------------------------------------
 * 生データ → DomesticOffer
 * ---------------------------------------------------------- */

function toCondition(value: YahooRawProduct['condition']): ProductCondition {
  return value
}

function toInStock(value: YahooRawProduct['availability']): boolean | null {
  if (value === 'available') return true
  if (value === 'unavailable') return false
  // ★取れなかったものを「在庫あり」にしない★
  return null
}

/**
 * 生データ1件を DomesticOffer へ変換する。
 *
 * 一致の判定はここで行い、結果（信頼度・不採用理由・要確認理由）を
 * offer に持たせます。あとの処理は offer だけを見れば済みます。
 */
export function toDomesticOffer(
  raw: YahooRawProduct,
  context: MatchContext,
  matchLevel: string,
): DomesticOffer {
  const evaluation = evaluateMatch(context, {
    title: raw.name,
    jan: raw.janCode,
    brandName: raw.brandName,
    condition: toCondition(raw.condition),
    priceJpy: raw.price,
  })

  const rejectReasons = evaluation.hardReject
    ? evaluation.hardRejectReasons.map(
        (dimension) => `${MATCH_DIMENSION_LABEL_JA[dimension]}が一致しません`,
      )
    : []

  // 在庫・状態による除外もここで理由として残す（画面で説明できるように）
  if (raw.condition === 'used') {
    rejectReasons.push('中古品です')
  }
  if (raw.availability === 'unavailable') {
    rejectReasons.push('在庫切れです')
  }

  const shippingJpy = readShippingJpy(raw.shippingLabel)

  return {
    source: 'yahoo',
    externalId: raw.externalId,
    title: raw.name,
    url: raw.url,
    // 検証済みなので price は必ず数値
    priceJpy: raw.price as number,
    regularPriceJpy: raw.regularPrice,
    shippingJpy,
    totalPriceJpy: shippingJpy === null ? null : (raw.price as number) + shippingJpy,
    sellerId: raw.sellerId,
    sellerName: raw.sellerName,
    inStock: toInStock(raw.availability),
    condition: toCondition(raw.condition),
    // Yahoo!のAPIには condition 項目があるので、明言があればそれが根拠になる。
    conditionEvidence:
      raw.condition === 'new' ? 'api-new' : raw.condition === 'used' ? 'api-used' : 'unknown',
    // Yahoo!側でもポイント還元はありますが、APIからは取得していません。
    // ★取得できたとしても、価格から差し引いてはいけません。★
    rewardNote: null,
    matchConfidence: evaluation.confidence,
    matchGrade: evaluation.grade,
    matchLevel: evaluation.hardReject ? `${matchLevel}（不採用）` : evaluation.matchLevel,
    positiveEvidence: evaluation.positiveEvidence,
    negativeEvidence: evaluation.negativeEvidence,
    unknownAttributes: evaluation.unknownAttributes,
    rejectCodes: [...evaluation.hardRejectCodes],
    rejectReasons,
    reviewReasons: evaluation.reviewReasons,
    verification: evaluation.verification,
    imageUrl: raw.imageUrl,
    fetchedAt: raw.fetchedAt,
  }
}

/** 生データの配列をまとめて変換する。 */
export function toDomesticOffers(
  rawProducts: YahooRawProduct[],
  context: MatchContext,
  matchLevel: string,
): DomesticOffer[] {
  const seen = new Set<string>()
  const offers: DomesticOffer[] = []

  for (const raw of rawProducts) {
    // 同じ商品が複数の検索で出てくることがあるので1件にまとめる
    if (seen.has(raw.url)) continue
    seen.add(raw.url)
    offers.push(toDomesticOffer(raw, context, matchLevel))
  }

  return offers
}

/* ------------------------------------------------------------
 * 送料
 * ---------------------------------------------------------- */

/**
 * Yahoo!の送料表示から、送料の決まりを作る。
 *
 * ★「条件付き送料無料」は unknown にする。★
 *   条件（いくら以上で無料か）が分からないので、
 *   0円と決めつけると実際より安い総額を出してしまいます。
 *   第2段階で作った「不明を0円にしない」仕組みへそのまま渡します。
 */
export function buildShippingRuleFromLabel(storeId: string, label: string | null): ShippingRule {
  const text = (label ?? '').normalize('NFKC')
  const isFree = text.includes('送料無料') && !text.includes('条件')

  if (isFree) {
    return {
      id: `ship-${storeId}`,
      storeId,
      destinationCountry: 'JP',
      type: 'fixed',
      currency: 'JPY',
      amount: 0,
      note: 'Yahoo!ショッピングの表示が「送料無料」のため0円として扱っています。',
      source: 'Yahoo!ショッピング 商品検索API（shipping.name）',
    }
  }

  return {
    id: `ship-${storeId}`,
    storeId,
    destinationCountry: 'JP',
    type: 'unknown',
    currency: 'JPY',
    note: label
      ? `送料の条件（${text}）が確定できないため、総額を算出できません。`
      : '送料の情報が取得できていないため、総額を算出できません。',
    source: 'Yahoo!ショッピング 商品検索API（shipping.name）',
  }
}

/* ------------------------------------------------------------
 * DomesticOffer → サカモノ内部モデル
 * ---------------------------------------------------------- */

export interface YahooNormalizedModels {
  stores: Store[]
  listings: StoreListing[]
  matches: DomesticMatch[]
  shippingRules: ShippingRule[]
}

function sellerStoreId(offer: DomesticOffer): string {
  const key = toSlug(offer.sellerId ?? offer.sellerName ?? 'unknown-seller') || 'unknown-seller'
  return `store-yahoo-${key}`
}

/**
 * DomesticOffer を、既存の価格比較エンジンが扱える形へ変換する。
 *
 * 出品者ごとに Store を1つ作ります（Yahoo!ショッピングは出品者が個別にいるため）。
 * ★Store.type は marketplace。★
 *   第2段階の仕組みにより、照合エンジンの自動検証を通っていない掲載は
 *   自動的に比較対象から外れます。
 */
export function toSakamonoModels(
  product: Product,
  offers: DomesticOffer[],
  shippingLabels: Map<string, string | null>,
): YahooNormalizedModels {
  const stores = new Map<string, Store>()
  const shippingRules = new Map<string, ShippingRule>()
  const listings: StoreListing[] = []
  const matches: DomesticMatch[] = []

  for (const offer of offers) {
    const storeId = sellerStoreId(offer)

    if (!stores.has(storeId)) {
      stores.set(storeId, {
        id: storeId,
        slug: toSlug(storeId),
        name: offer.sellerName ?? 'Yahoo!ショッピング出品者',
        // ★出品者が個別に存在するモール型★
        type: 'marketplace',
        currency: 'JPY',
        country: '日本',
        japanShippingAvailable: true,
        shippingType: 'domestic',
        affiliateAvailable: false,
        active: true,
        // 実際に取得したデータであることを記録（開発用fixtureと区別するため）
        dataOrigin: 'live',
      })
      shippingRules.set(
        storeId,
        buildShippingRuleFromLabel(storeId, shippingLabels.get(offer.externalId) ?? null),
      )
    }

    const listingId = `listing-yahoo-${toSlug(offer.externalId) || toSlug(offer.url)}`

    // 通常価格が取れない場合は現在価格と同値（★存在しない値下げを作らない★）
    const regularPrice = offer.regularPriceJpy ?? offer.priceJpy
    const discount = evaluateDiscount(regularPrice, offer.priceJpy)

    listings.push({
      id: listingId,
      productId: product.id,
      storeId,
      externalId: offer.externalId,
      externalUrl: offer.url,
      currency: 'JPY',
      currentPrice: offer.priceJpy,
      regularPrice,
      discountRate: discount.rate,
      inStock: offer.inStock === true,
      stockStatus:
        offer.inStock === true ? 'available' : offer.inStock === false ? 'unavailable' : 'unknown',
      lastCheckedAt: offer.fetchedAt,
    })

    matches.push({
      id: `match-yahoo-${toSlug(offer.externalId) || toSlug(offer.url)}`,
      productId: product.id,
      storeListingId: listingId,
      confidence: offer.matchConfidence,
      matchMethod:
        offer.matchLevel === 'jan'
          ? 'jan'
          : offer.matchLevel === 'ean-as-jan'
            ? 'ean'
            : offer.matchLevel === 'sku'
              ? 'sku'
              : 'attributes',
      reviewed: false,
      verification: offer.verification,
      sourceLabel: 'yahoo',
      // 画面で「なぜ採用したのか／しなかったのか」を説明できるようにする。
      // ★採用したものにも根拠を残します。★
      //   落とした理由だけ残しても、誤って採用したものは見つけられません。
      matchNote:
        offer.rejectReasons.length > 0
          ? offer.rejectReasons.join('・')
          : offer.reviewReasons.length > 0
            ? offer.reviewReasons.join('・')
            : offer.positiveEvidence.length > 0
              ? offer.positiveEvidence.join('・')
              : undefined,
      unknownAttributes: offer.unknownAttributes,
      createdAt: offer.fetchedAt,
    })
  }

  return {
    stores: [...stores.values()],
    listings,
    matches,
    shippingRules: [...shippingRules.values()],
  }
}

/* ------------------------------------------------------------
 * 集計
 * ---------------------------------------------------------- */

export interface YahooOfferSummary {
  /** APIから受け取った候補の総数。 */
  candidateCount: number
  /** 重大な食い違いで不採用にした件数。 */
  hardRejectedCount: number
  /** 人の確認へ回した件数。 */
  reviewCount: number
  /** ランクごとの件数。 */
  gradeCounts: Record<'A' | 'B' | 'C' | 'D', number>
  /** ★実際に価格比較へ使える候補の件数（APIの総件数ではない）。★ */
  adoptedCount: number
  /** 採用候補の最安値（★送料込みの総額★）。0件なら null（0円にしない）。 */
  lowestPriceJpy: number | null
  /** 採用候補の総額の中央値。0件なら null。 */
  medianPriceJpy: number | null
  /** 照合は通ったが、送料の条件が分からず総額を出せなかった件数。 */
  shippingUnknownCount: number
  /** 採用した候補（安い順）。 */
  adopted: DomesticOffer[]
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

/**
 * 候補をまとめる。
 *
 * ★「APIが返した件数」を店舗数として出さないこと。★
 *   比較に使えるのは審査を通った候補だけです。
 */
export function summarizeOffers(offers: DomesticOffer[]): YahooOfferSummary {
  const gradeCounts: Record<'A' | 'B' | 'C' | 'D', number> = { A: 0, B: 0, C: 0, D: 0 }

  for (const offer of offers) {
    gradeCounts[offer.matchGrade] += 1
  }

  const adopted = offers
    .filter((offer) => isAdoptableOffer(offer))
    .sort((a, b) => (a.totalPriceJpy ?? 0) - (b.totalPriceJpy ?? 0))
  const prices = adopted.map((offer) => offer.totalPriceJpy as number)

  // 照合は通ったのに、送料が分からないせいで使えなかったもの
  const shippingUnknownCount = offers.filter(
    (offer) =>
      offer.rejectReasons.length === 0 &&
      offer.reviewReasons.length === 0 &&
      offer.verification === 'automated' &&
      offer.totalPriceJpy === null,
  ).length

  return {
    candidateCount: offers.length,
    hardRejectedCount: offers.filter((offer) => offer.rejectReasons.length > 0).length,
    reviewCount: offers.filter(
      (offer) => offer.rejectReasons.length === 0 && offer.reviewReasons.length > 0,
    ).length,
    gradeCounts,
    adoptedCount: adopted.length,
    shippingUnknownCount,
    lowestPriceJpy: prices.length > 0 ? prices[0] : null,
    medianPriceJpy: median(prices),
    adopted,
  }
}

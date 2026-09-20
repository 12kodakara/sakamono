/**
 * RakutenAdapter — 楽天の生データをサカモノの形へ写す。
 *
 *   RakutenRawItem
 *        ↓  ★Yahoo!と同じ共通の照合エンジン★（src/lib/matching/engine.ts）
 *   DomesticOffer（提供元によらない共通の形）
 *        ↓
 *   Store / StoreListing / DomesticMatch / ShippingRule
 *        ↓
 *   既存の価格比較エンジン（第2段階）— 変更不要
 *
 * ★画面は RakutenRawItem を絶対に参照しない。★
 *
 * ★楽天専用の照合エンジンを作っていません。★
 *   第4.6段階で作り込んだ共通エンジンをそのまま使います。
 *   袖丈・マーキング・レプリカ／オーセンティック・ホーム／アウェイの
 *   判定ルールは、提供元が変わっても同じでなければ意味がありません。
 */

import type {
  DomesticMatch,
  Product,
  ShippingRule,
  Store,
  StoreListing,
} from '@/domain/types'
import type { DomesticOffer } from '@/domain/domesticOffer'
import {
  MATCH_DIMENSION_LABEL_JA,
  evaluateMatch,
  type MatchContext,
} from '@/lib/matching/engine'
import { USED_TERMS } from '@/lib/matching/aliases'
import { containsAnyTerm, padded } from '@/lib/matching/textNormalize'
import { evaluateDiscount } from '@/domain/services/discount'
import { toSlug } from '@/lib/slug'
import type { RakutenRawItem } from './types'

/* ------------------------------------------------------------
 * 価格の意味を確かめる
 * ---------------------------------------------------------- */

/**
 * 掲載価格をそのまま「税込の商品価格」として比べてよいか。
 *
 * ★楽天の itemPrice は税別のことがあります（taxFlag = 1）。★
 *   税別価格を税込価格と並べると、10%分だけ安く見えます。
 *   サカモノが出すのは「日本に届くまでにいくら払うか」なので、
 *   税別のまま比べてはいけません。
 *
 * 税率を掛けて税込へ直すこともできますが、第5段階ではしません。
 * 商品によって税率（8% / 10%）が違い、こちらで決め打ちすると
 * 別の嘘を作ることになるためです。人の確認へ回します。
 */
export function describeTaxBasis(item: RakutenRawItem): string | null {
  if (item.taxBasis === 'tax-included') return null
  if (item.taxBasis === 'tax-excluded') {
    return '掲載価格が税別です（税込価格に直せないため、そのままでは比較に使えません）'
  }
  return '掲載価格が税込か税別か確認できません（税込とは決めつけません）'
}

/**
 * 楽天の postageFlag から、国内送料（円）を読み取る。
 *
 * ★「送料別」を0円にしない。★
 *   楽天は送料の金額そのものを返しません。
 *   「送料別」と分かっても、いくらかは分からないので null（不明）です。
 *   0円と決めつけると、実際より安い総額を出してしまいます。
 */
export function readRakutenShippingJpy(item: RakutenRawItem): number | null {
  return item.postageBasis === 'included' ? 0 : null
}

/**
 * ポイント倍率を、表示用の覚え書きにする。
 *
 * ★価格から差し引くためのものではありません。★
 */
export function describePointReward(item: RakutenRawItem): string | null {
  if (item.pointRate === null || item.pointRate <= 1) return null
  return `ポイント${item.pointRate}倍（★価格には含めていません★）`
}

/* ------------------------------------------------------------
 * 生データ → DomesticOffer
 * ---------------------------------------------------------- */

function toInStock(value: RakutenRawItem['availability']): boolean | null {
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
export function toDomesticOffer(raw: RakutenRawItem, context: MatchContext): DomesticOffer {
  const evaluation = evaluateMatch(context, {
    title: raw.name,
    // ★楽天はJANを返さないので、常に null。★
    //   照合エンジン側では janEvidence = 'missing' になります。
    //   「JANが無い＝一致」ではありません。未確認として扱われます。
    jan: raw.janCode,
    // ★ブランド名の単独項目も無い。商品名から判定させる。★
    brandName: raw.manufacturer,
    // 楽天の商品検索APIは新品／中古を区別しません（後述）。
    condition: 'unknown',
    priceJpy: raw.price,
  })

  const rejectReasons = evaluation.hardReject
    ? evaluation.hardRejectReasons.map(
        (dimension) => `${MATCH_DIMENSION_LABEL_JA[dimension]}が一致しません`,
      )
    : []

  if (raw.availability === 'unavailable') {
    rejectReasons.push('在庫切れです')
  }

  /* ---- 価格の意味が確かめられないものは、人の確認へ ---- */
  const reviewReasons = [...evaluation.reviewReasons]
  const taxNote = describeTaxBasis(raw)
  if (taxNote) reviewReasons.push(taxNote)

  const shippingJpy = readRakutenShippingJpy(raw)

  return {
    source: 'rakuten',
    externalId: raw.externalId,
    title: raw.name,
    url: raw.url,
    // 検証済みなので price は必ず数値
    priceJpy: raw.price as number,
    // ★楽天の商品検索APIは「通常価格」を返しません。★
    //   現在価格で埋めると、存在しない値引きを作ってしまいます。
    regularPriceJpy: null,
    shippingJpy,
    totalPriceJpy: shippingJpy === null ? null : (raw.price as number) + shippingJpy,
    sellerId: raw.shopCode,
    sellerName: raw.shopName,
    inStock: toInStock(raw.availability),
    // ★楽天の商品検索APIには新品／中古の項目がありません。★
    //   「中古の取り扱いが少ないから新品だろう」とは決めつけません。
    //   unknown のままにすると、既存の採用条件（新品のみ）で自動的に外れます。
    condition: 'unknown',
    // 商品名に中古を示す語があるかどうかだけは確かめられる。
    // ★ただし「中古と書かれていない＝新品」ではありません。★
    //   出品者が書き忘れているだけかもしれないので、
    //   これを根拠に自動採用はしません（判断材料として記録するだけ）。
    conditionEvidence: containsAnyTerm(padded(raw.name), USED_TERMS)
      ? 'api-used'
      : 'title-checked',
    matchConfidence: evaluation.confidence,
    matchGrade: evaluation.grade,
    matchLevel: evaluation.hardReject ? `${evaluation.matchLevel}（不採用）` : evaluation.matchLevel,
    positiveEvidence: evaluation.positiveEvidence,
    negativeEvidence: evaluation.negativeEvidence,
    unknownAttributes: evaluation.unknownAttributes,
    rejectCodes: [...evaluation.hardRejectCodes],
    rejectReasons,
    reviewReasons,
    verification: evaluation.verification,
    imageUrl: raw.imageUrl,
    rewardNote: describePointReward(raw),
    fetchedAt: raw.fetchedAt,
  }
}

/** 生データの配列をまとめて変換する。 */
export function toDomesticOffers(
  rawItems: RakutenRawItem[],
  context: MatchContext,
): DomesticOffer[] {
  const seen = new Set<string>()
  const offers: DomesticOffer[] = []

  for (const raw of rawItems) {
    // ★同じ商品が複数の検索で出てくることがあるので1件にまとめる。★
    //   楽天の itemCode は「ショップコード:商品管理番号」で一意です。
    const key = raw.externalId || raw.url
    if (seen.has(key)) continue
    seen.add(key)
    offers.push(toDomesticOffer(raw, context))
  }

  return offers
}

/* ------------------------------------------------------------
 * 送料
 * ---------------------------------------------------------- */

/**
 * 楽天の postageFlag から、送料の決まりを作る。
 *
 * ★「送料別」は unknown にする。★
 *   楽天は送料の金額を返さないので、別だと分かっても額は不明です。
 *   第2段階で作った「不明を0円にしない」仕組みへそのまま渡します。
 */
export function buildShippingRuleFromPostage(
  storeId: string,
  postageBasis: RakutenRawItem['postageBasis'],
): ShippingRule {
  if (postageBasis === 'included') {
    return {
      id: `ship-${storeId}`,
      storeId,
      destinationCountry: 'JP',
      type: 'fixed',
      currency: 'JPY',
      amount: 0,
      note: '楽天市場の表示が「送料込み」のため0円として扱っています。',
      source: '楽天市場 商品検索API（postageFlag）',
    }
  }

  return {
    id: `ship-${storeId}`,
    storeId,
    destinationCountry: 'JP',
    type: 'unknown',
    currency: 'JPY',
    note:
      postageBasis === 'excluded'
        ? '「送料別」と分かっていますが、金額が取得できないため総額を算出できません。'
        : '送料の情報が取得できていないため、総額を算出できません。',
    source: '楽天市場 商品検索API（postageFlag）',
  }
}

/* ------------------------------------------------------------
 * DomesticOffer → サカモノ内部モデル
 * ---------------------------------------------------------- */

export interface RakutenNormalizedModels {
  stores: Store[]
  listings: StoreListing[]
  matches: DomesticMatch[]
  shippingRules: ShippingRule[]
}

function shopStoreId(offer: DomesticOffer): string {
  const key = toSlug(offer.sellerId ?? offer.sellerName ?? 'unknown-shop') || 'unknown-shop'
  return `store-rakuten-${key}`
}

/**
 * DomesticOffer を、既存の価格比較エンジンが扱える形へ変換する。
 *
 * 出店者ごとに Store を1つ作ります（楽天市場は出店者が個別にいるため）。
 * ★Store.type は marketplace。★
 *   第2段階の仕組みにより、照合エンジンの自動検証を通っていない掲載は
 *   自動的に比較対象から外れます。
 */
export function toSakamonoModels(
  product: Product,
  offers: DomesticOffer[],
  postageByExternalId: Map<string, RakutenRawItem['postageBasis']>,
): RakutenNormalizedModels {
  const stores = new Map<string, Store>()
  const shippingRules = new Map<string, ShippingRule>()
  const listings: StoreListing[] = []
  const matches: DomesticMatch[] = []

  for (const offer of offers) {
    const storeId = shopStoreId(offer)

    if (!stores.has(storeId)) {
      stores.set(storeId, {
        id: storeId,
        slug: toSlug(storeId),
        name: offer.sellerName ?? '楽天市場 出店者',
        // ★出店者が個別に存在するモール型★
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
        buildShippingRuleFromPostage(
          storeId,
          postageByExternalId.get(offer.externalId) ?? 'unknown',
        ),
      )
    }

    const listingId = `listing-rakuten-${toSlug(offer.externalId) || toSlug(offer.url)}`

    // 通常価格が取れないので現在価格と同値（★存在しない値下げを作らない★）
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
      id: `match-rakuten-${toSlug(offer.externalId) || toSlug(offer.url)}`,
      productId: product.id,
      storeListingId: listingId,
      confidence: offer.matchConfidence,
      matchMethod: offer.matchLevel === 'sku' ? 'sku' : 'attributes',
      reviewed: false,
      verification: offer.verification,
      sourceLabel: 'rakuten',
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

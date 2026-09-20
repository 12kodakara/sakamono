/**
 * データ検証。
 *
 * fixture でも外部APIから取った本番データでも、同じ関数で検証できるようにしてある。
 * 第2段階で取得処理を作ったら、取り込み直後にここを通して不正データを弾く。
 *
 * 戻り値は「エラーメッセージの配列」。空配列なら問題なし。
 * 例外を投げないのは、複数の問題をまとめて報告したいため。
 */

import { isValidSlug } from '@/lib/slug'
import type {
  Club,
  DomesticMatch,
  ExchangeRate,
  ImportCostRule,
  League,
  Product,
  ProductVariant,
  ShippingRule,
  Store,
  StoreListing,
} from './types'

export interface Dataset {
  leagues: League[]
  clubs: Club[]
  stores: Store[]
  products: Product[]
  listings: StoreListing[]
  matches: DomesticMatch[]
  /** 第2段階で追加。為替レート。 */
  exchangeRates: ExchangeRate[]
  /** 第2段階で追加。送料の決まり。 */
  shippingRules: ShippingRule[]
  /** 第2段階で追加。輸入コストの決まり。 */
  importCostRules: ImportCostRule[]
  /** 第3段階で追加。サイズなどのバリエーション。 */
  variants: ProductVariant[]
}

/* ------------------------------------------------------------
 * 単体の検証
 * ---------------------------------------------------------- */

export function validateLeague(league: League): string[] {
  const errors: string[] = []
  if (!league.id) errors.push('League.id が空です')
  if (!isValidSlug(league.slug)) errors.push(`League.slug の形式が不正です: ${league.slug}`)
  if (!league.name) errors.push(`League.name が空です (${league.id})`)
  if (!league.nameJa) errors.push(`League.nameJa が空です (${league.id})`)
  if (!Number.isInteger(league.displayOrder)) {
    errors.push(`League.displayOrder が整数ではありません (${league.id})`)
  }
  return errors
}

export function validateClub(club: Club): string[] {
  const errors: string[] = []
  if (!club.id) errors.push('Club.id が空です')
  if (!isValidSlug(club.slug)) errors.push(`Club.slug の形式が不正です: ${club.slug}`)
  if (!club.name) errors.push(`Club.name が空です (${club.id})`)
  if (!club.nameJa) errors.push(`Club.nameJa が空です (${club.id})`)
  if (!isHttpsUrl(club.officialStoreUrl)) {
    errors.push(`Club.officialStoreUrl が https のURLではありません (${club.id})`)
  }
  return errors
}

export function validateStore(store: Store): string[] {
  const errors: string[] = []
  if (!store.id) errors.push('Store.id が空です')
  if (!isValidSlug(store.slug)) errors.push(`Store.slug の形式が不正です: ${store.slug}`)
  if (!store.name) errors.push(`Store.name が空です (${store.id})`)
  if (store.shippingType === 'domestic' && store.country !== '日本') {
    errors.push(`Store.shippingType が domestic なのに country が日本ではありません (${store.id})`)
  }
  if (!store.japanShippingAvailable && store.shippingType !== 'none') {
    errors.push(
      `Store.japanShippingAvailable が false なのに shippingType が none ではありません (${store.id})`,
    )
  }
  return errors
}

export function validateProduct(product: Product): string[] {
  const errors: string[] = []
  if (!product.id) errors.push('Product.id が空です')
  if (!isValidSlug(product.slug)) errors.push(`Product.slug の形式が不正です: ${product.slug}`)
  if (!product.clubId) errors.push(`Product.clubId が空です (${product.id})`)
  if (!product.name) errors.push(`Product.name が空です (${product.id})`)
  if (!product.nameJa) errors.push(`Product.nameJa が空です (${product.id})`)
  // シーズンは null（不明）を許す。推測で埋めさせないため。
  // 値がある場合だけ形式を確かめる。
  if (product.season !== null && !/^\d{4}\/\d{2}$/.test(product.season)) {
    errors.push(
      `Product.season は YYYY/YY 形式、または不明なら null で指定してください (${product.id}: ${product.season})`,
    )
  }

  // ユニフォーム以外に kitType が付いていないか
  if (product.category !== 'kits' && product.kitType !== null) {
    errors.push(`Product.kitType は category が kits のときだけ設定してください (${product.id})`)
  }
  if (product.category === 'kits' && product.kitType === null) {
    errors.push(`Product.kitType が未設定です (${product.id})`)
  }

  if (product.jan !== null && !/^\d{8}$|^\d{13}$/.test(product.jan)) {
    errors.push(`Product.jan は8桁または13桁の数字です (${product.id}: ${product.jan})`)
  }
  if (product.ean !== null && !/^\d{8}$|^\d{13}$/.test(product.ean)) {
    errors.push(`Product.ean は8桁または13桁の数字です (${product.id}: ${product.ean})`)
  }

  if (!product.image?.src) errors.push(`Product.image.src が空です (${product.id})`)
  if (!product.image?.alt) errors.push(`Product.image.alt が空です (${product.id})`)
  if (!(product.image?.width > 0) || !(product.image?.height > 0)) {
    errors.push(`Product.image の width / height を正の数で指定してください (${product.id})`)
  }

  return errors
}

export function validateStoreListing(listing: StoreListing): string[] {
  const errors: string[] = []
  if (!listing.id) errors.push('StoreListing.id が空です')
  if (!listing.productId) errors.push(`StoreListing.productId が空です (${listing.id})`)
  if (!listing.storeId) errors.push(`StoreListing.storeId が空です (${listing.id})`)
  if (!isHttpsUrl(listing.externalUrl)) {
    errors.push(`StoreListing.externalUrl が https のURLではありません (${listing.id})`)
  }
  if (!(listing.currentPrice >= 0)) {
    errors.push(`StoreListing.currentPrice が不正です (${listing.id})`)
  }
  if (!(listing.regularPrice >= 0)) {
    errors.push(`StoreListing.regularPrice が不正です (${listing.id})`)
  }
  if (listing.currentPrice > listing.regularPrice) {
    errors.push(`StoreListing.currentPrice が regularPrice を超えています (${listing.id})`)
  }
  if (listing.discountRate < 0 || listing.discountRate > 1) {
    errors.push(`StoreListing.discountRate は0〜1です (${listing.id})`)
  }
  if (!isIsoDateTime(listing.lastCheckedAt)) {
    errors.push(`StoreListing.lastCheckedAt が ISO 8601 形式ではありません (${listing.id})`)
  }
  return errors
}

export function validateDomesticMatch(match: DomesticMatch): string[] {
  const errors: string[] = []
  if (!match.id) errors.push('DomesticMatch.id が空です')
  if (match.confidence < 0 || match.confidence > 1) {
    errors.push(`DomesticMatch.confidence は0〜1です (${match.id}: ${match.confidence})`)
  }
  if (!isIsoDateTime(match.createdAt)) {
    errors.push(`DomesticMatch.createdAt が ISO 8601 形式ではありません (${match.id})`)
  }
  return errors
}

/* ------------------------------------------------------------
 * データセット全体の検証（参照整合性を含む）
 * ---------------------------------------------------------- */

export function validateDataset(dataset: Dataset): string[] {
  const errors: string[] = []

  dataset.leagues.forEach((x) => errors.push(...validateLeague(x)))
  dataset.clubs.forEach((x) => errors.push(...validateClub(x)))
  dataset.stores.forEach((x) => errors.push(...validateStore(x)))
  dataset.products.forEach((x) => errors.push(...validateProduct(x)))
  dataset.listings.forEach((x) => errors.push(...validateStoreListing(x)))
  dataset.matches.forEach((x) => errors.push(...validateDomesticMatch(x)))
  dataset.exchangeRates.forEach((x) => errors.push(...validateExchangeRate(x)))
  dataset.shippingRules.forEach((x) => errors.push(...validateShippingRule(x)))
  dataset.importCostRules.forEach((x) => errors.push(...validateImportCostRule(x)))
  dataset.variants.forEach((x) => errors.push(...validateProductVariant(x)))

  errors.push(...findDuplicates(dataset.leagues.map((x) => x.id), 'League.id'))
  errors.push(...findDuplicates(dataset.leagues.map((x) => x.slug), 'League.slug'))
  errors.push(...findDuplicates(dataset.clubs.map((x) => x.id), 'Club.id'))
  errors.push(...findDuplicates(dataset.clubs.map((x) => x.slug), 'Club.slug'))
  errors.push(...findDuplicates(dataset.products.map((x) => x.id), 'Product.id'))
  errors.push(...findDuplicates(dataset.products.map((x) => x.slug), 'Product.slug'))
  errors.push(...findDuplicates(dataset.stores.map((x) => x.id), 'Store.id'))
  errors.push(...findDuplicates(dataset.listings.map((x) => x.id), 'StoreListing.id'))

  const leagueIds = new Set(dataset.leagues.map((x) => x.id))
  const clubIds = new Set(dataset.clubs.map((x) => x.id))
  const storeIds = new Set(dataset.stores.map((x) => x.id))
  const productIds = new Set(dataset.products.map((x) => x.id))
  const listingIds = new Set(dataset.listings.map((x) => x.id))

  dataset.clubs.forEach((club) => {
    if (!leagueIds.has(club.leagueId)) {
      errors.push(`Club.leagueId が存在しないリーグを指しています (${club.id} -> ${club.leagueId})`)
    }
  })
  dataset.products.forEach((product) => {
    if (!clubIds.has(product.clubId)) {
      errors.push(
        `Product.clubId が存在しないクラブを指しています (${product.id} -> ${product.clubId})`,
      )
    }
  })
  dataset.listings.forEach((listing) => {
    if (!productIds.has(listing.productId)) {
      errors.push(`StoreListing.productId が存在しない商品を指しています (${listing.id})`)
    }
    if (!storeIds.has(listing.storeId)) {
      errors.push(`StoreListing.storeId が存在しないストアを指しています (${listing.id})`)
    }
  })
  dataset.shippingRules.forEach((rule) => {
    if (!storeIds.has(rule.storeId)) {
      errors.push(`ShippingRule.storeId が存在しないストアを指しています (${rule.id})`)
    }
  })
  dataset.importCostRules.forEach((rule) => {
    if (rule.storeId !== 'any' && !storeIds.has(rule.storeId)) {
      errors.push(`ImportCostRule.storeId が存在しないストアを指しています (${rule.id})`)
    }
  })
  dataset.variants.forEach((variant) => {
    if (!listingIds.has(variant.storeListingId)) {
      errors.push(
        `ProductVariant.storeListingId が存在しない掲載を指しています (${variant.id})`,
      )
    }
  })
  dataset.matches.forEach((match) => {
    if (!productIds.has(match.productId)) {
      errors.push(`DomesticMatch.productId が存在しない商品を指しています (${match.id})`)
    }
    if (!listingIds.has(match.storeListingId)) {
      errors.push(`DomesticMatch.storeListingId が存在しない掲載を指しています (${match.id})`)
    }
  })

  return errors
}

/* ------------------------------------------------------------
 * 小さな補助関数
 * ---------------------------------------------------------- */

function isHttpsUrl(value: string): boolean {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isIsoDateTime(value: string): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

function findDuplicates(values: string[], label: string): string[] {
  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value)
    seen.add(value)
  }
  return [...duplicated].map((value) => `${label} が重複しています: ${value}`)
}

/* ------------------------------------------------------------
 * 第2段階で追加した検証
 * ---------------------------------------------------------- */

export function validateExchangeRate(rate: ExchangeRate): string[] {
  const errors: string[] = []
  const label = `${rate.baseCurrency}->${rate.quoteCurrency}`

  if (rate.quoteCurrency !== 'JPY') {
    errors.push(`ExchangeRate.quoteCurrency は JPY のみ対応しています (${label})`)
  }
  if (rate.baseCurrency === 'JPY') {
    errors.push('ExchangeRate に JPY->JPY は登録しません（換算せずそのまま扱います）')
  }
  if (!Number.isFinite(rate.rate) || rate.rate <= 0) {
    errors.push(`ExchangeRate.rate は0より大きい数値です (${label}: ${rate.rate})`)
  }
  if (!isIsoDateTime(rate.fetchedAt)) {
    errors.push(`ExchangeRate.fetchedAt が ISO 8601 形式ではありません (${label})`)
  }
  if (!rate.source) {
    errors.push(`ExchangeRate.source が空です (${label})`)
  }
  if (rate.kind !== 'development-fixture' && rate.kind !== 'live') {
    errors.push(`ExchangeRate.kind の値が不正です (${label}: ${String(rate.kind)})`)
  }
  return errors
}

export function validateShippingRule(rule: ShippingRule): string[] {
  const errors: string[] = []
  if (!rule.id) errors.push('ShippingRule.id が空です')
  if (!rule.storeId) errors.push(`ShippingRule.storeId が空です (${rule.id})`)
  if (rule.destinationCountry !== 'JP') {
    errors.push(`ShippingRule.destinationCountry は JP のみ対応しています (${rule.id})`)
  }

  const needsAmount = rule.type === 'fixed' || rule.type === 'threshold' || rule.type === 'estimated'
  if (needsAmount) {
    if (rule.amount === undefined) {
      errors.push(`ShippingRule.amount が未設定です (${rule.id}: type=${rule.type})`)
    } else if (!Number.isFinite(rule.amount) || rule.amount < 0) {
      errors.push(`ShippingRule.amount が不正です (${rule.id}: ${rule.amount})`)
    }
  }

  if (rule.type === 'threshold') {
    if (rule.freeShippingThreshold === undefined) {
      errors.push(`ShippingRule.freeShippingThreshold が未設定です (${rule.id})`)
    } else if (!Number.isFinite(rule.freeShippingThreshold) || rule.freeShippingThreshold < 0) {
      errors.push(`ShippingRule.freeShippingThreshold が不正です (${rule.id})`)
    }
  }

  if (rule.type === 'unknown' && rule.amount !== undefined) {
    errors.push(
      `ShippingRule.type が unknown なのに amount が設定されています (${rule.id})。` +
        '送料不明を金額つきで扱うと0円と混同されます。',
    )
  }

  return errors
}

export function validateImportCostRule(rule: ImportCostRule): string[] {
  const errors: string[] = []
  if (!rule.id) errors.push('ImportCostRule.id が空です')
  if (!rule.storeId) errors.push(`ImportCostRule.storeId が空です (${rule.id})`)
  if (rule.destinationCountry !== 'JP') {
    errors.push(`ImportCostRule.destinationCountry は JP のみ対応しています (${rule.id})`)
  }

  if (rule.method === 'flat') {
    if (rule.flatAmountJpy === undefined || !Number.isFinite(rule.flatAmountJpy)) {
      errors.push(`ImportCostRule.flatAmountJpy が未設定または不正です (${rule.id})`)
    } else if (rule.flatAmountJpy < 0) {
      errors.push(`ImportCostRule.flatAmountJpy がマイナスです (${rule.id})`)
    }
  }

  if (rule.method === 'simplified-personal-import') {
    const parameters = rule.parameters
    if (!parameters) {
      errors.push(`ImportCostRule.parameters が未設定です (${rule.id})`)
    } else {
      const ratios: Array<[string, number]> = [
        ['taxBaseRate', parameters.taxBaseRate],
        ['dutyRate', parameters.dutyRate],
        ['consumptionTaxRate', parameters.consumptionTaxRate],
      ]
      for (const [name, value] of ratios) {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
          errors.push(`ImportCostRule.parameters.${name} は0〜1です (${rule.id}: ${value})`)
        }
      }
      if (!Number.isFinite(parameters.dutyFreeThresholdJpy) || parameters.dutyFreeThresholdJpy < 0) {
        errors.push(`ImportCostRule.parameters.dutyFreeThresholdJpy が不正です (${rule.id})`)
      }
      if (!Number.isFinite(parameters.handlingFeeJpy) || parameters.handlingFeeJpy < 0) {
        errors.push(`ImportCostRule.parameters.handlingFeeJpy が不正です (${rule.id})`)
      }
    }
  }

  return errors
}

/* ------------------------------------------------------------
 * 第3段階で追加した検証
 * ---------------------------------------------------------- */

export function validateProductVariant(variant: ProductVariant): string[] {
  const errors: string[] = []
  if (!variant.id) errors.push('ProductVariant.id が空です')
  if (!variant.storeListingId) {
    errors.push(`ProductVariant.storeListingId が空です (${variant.id})`)
  }
  if (!['available', 'unavailable', 'unknown'].includes(variant.availability)) {
    errors.push(
      `ProductVariant.availability の値が不正です (${variant.id}: ${String(variant.availability)})`,
    )
  }
  if (variant.ean !== null && !/^\d{8}$|^\d{13}$/.test(variant.ean)) {
    errors.push(`ProductVariant.ean は8桁または13桁の数字です (${variant.id}: ${variant.ean})`)
  }
  return errors
}

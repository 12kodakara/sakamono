/**
 * LiverpoolAdapter — 生データをサカモノ内部モデルへ写す。
 *
 *   LiverpoolRawProduct
 *        ↓
 *   Product / StoreListing / ProductVariant / PriceSnapshot
 *
 * ★画面（components / app）は LiverpoolRawProduct を絶対に参照しない。★
 *   外部の形が変わってもここだけ直せば済むようにするため。
 *
 * ★分からない値は推測で埋めない。★
 *   シーズン・レプリカ/オーセンティック・対象などは、
 *   商品名にはっきり書かれている場合だけ設定する（classify.ts）。
 */

import type {
  Currency,
  PriceSnapshot,
  Product,
  ProductImage,
  ProductVariant,
  StoreListing,
  VariantAvailability,
} from '@/domain/types'
import { isSupportedCurrency } from '@/domain/money'
import { evaluateDiscount } from '@/domain/services/discount'
import { toSlug } from '@/lib/slug'
import { classifyFromTitle, normalizeProductUrl } from './classify'
import type { IngestionIssue } from './errors'
import type { LiverpoolRawProduct, LiverpoolRawVariant } from './types'

/* ------------------------------------------------------------
 * 変換先で使う固定値
 * ---------------------------------------------------------- */

/** この取り込みが対象とするクラブ・ストア。 */
export const LIVERPOOL_CLUB_ID = 'club-liverpool'
export const LIVERPOOL_STORE_ID = 'store-lfc-official'

/**
 * 画像のプレースホルダー。
 *
 * ★取得元の画像URLを表示に使わない。★
 *   外部画像の利用条件が未確認のため（docs/data-sources/liverpool.md 第7章）。
 *   URLは image.sourceUrl に記録だけしておき、許諾が取れたら src へ移す。
 */
function buildImage(rawImageUrl: string | null, nameJa: string): ProductImage {
  return {
    src: '/images/placeholder-kit-home.svg',
    alt: `${nameJa}（商品画像は準備中のため、サカモノのプレースホルダー画像を表示しています）`,
    width: 800,
    height: 800,
    source: 'placeholder',
    sourceUrl: rawImageUrl,
  }
}

/* ------------------------------------------------------------
 * ID / slug
 * ---------------------------------------------------------- */

/**
 * 商品の識別子を作る。
 *
 * externalId があればそれを使う。無ければURLのパス末尾を使う。
 * どちらも使えなければ null（＝取り込まない）。
 */
export function buildExternalKey(raw: LiverpoolRawProduct): string | null {
  if (raw.externalId && raw.externalId.trim()) return toSlug(raw.externalId)

  const normalized = normalizeProductUrl(raw.url)
  if (!normalized) return null

  try {
    const segments = new URL(normalized).pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    return last ? toSlug(last) : null
  } catch {
    return null
  }
}

/**
 * 商品ページのURL（slug）を作る。
 *
 * 同じ名前の商品が複数あってもURLが衝突しないよう、
 * 呼び出し側が使用済みのslugを渡して重複を避ける。
 */
export function buildProductSlugFrom(
  title: string,
  externalKey: string,
  used: Set<string>,
): string {
  const base = toSlug(`liverpool ${title}`).slice(0, 90) || `liverpool ${externalKey}`
  let slug = toSlug(base)
  if (!slug) slug = toSlug(`liverpool ${externalKey}`)

  if (!used.has(slug)) {
    used.add(slug)
    return slug
  }

  // 衝突したら外部キーを足す。それでも衝突するなら連番を足す。
  let candidate = toSlug(`${slug} ${externalKey}`)
  let counter = 2
  while (used.has(candidate)) {
    candidate = toSlug(`${slug} ${externalKey} ${counter}`)
    counter += 1
  }
  used.add(candidate)
  return candidate
}

/* ------------------------------------------------------------
 * 在庫
 * ---------------------------------------------------------- */

function toAvailability(available: boolean | null): VariantAvailability {
  if (available === true) return 'available'
  if (available === false) return 'unavailable'
  // ★取れなかったものを「在庫あり」にしない★
  return 'unknown'
}

/**
 * バリエーションから、掲載全体の在庫状況を決める。
 *
 * ★「ページに In Stock と書いてある」だけで全サイズ在庫ありとしない。★
 *   1サイズでも買えるなら available。
 *   全サイズ売り切れなら unavailable。
 *   情報が無い／全部不明なら unknown（★在庫ありにしない★）。
 */
export function deriveStockStatus(variants: ProductVariant[]): VariantAvailability {
  if (variants.length === 0) return 'unknown'
  if (variants.some((variant) => variant.availability === 'available')) return 'available'
  if (variants.every((variant) => variant.availability === 'unavailable')) return 'unavailable'
  return 'unknown'
}

/* ------------------------------------------------------------
 * 変換
 * ---------------------------------------------------------- */

export interface NormalizedLiverpoolData {
  products: Product[]
  listings: StoreListing[]
  variants: ProductVariant[]
  snapshots: PriceSnapshot[]
  issues: IngestionIssue[]
}

export interface NormalizeOptions {
  /** 日本語の商品名を作れない場合に使う（第3段階では原文をそのまま使う）。 */
  now?: string
}

function normalizeVariant(
  rawVariant: LiverpoolRawVariant,
  listingId: string,
  index: number,
): ProductVariant {
  return {
    id: `${listingId}-v${index + 1}`,
    storeListingId: listingId,
    size: rawVariant.size?.trim() || null,
    sku: rawVariant.sku?.trim() || null,
    ean: rawVariant.ean?.trim() || null,
    jan: null,
    availability: toAvailability(rawVariant.available),
  }
}

/**
 * 生データの配列をサカモノ内部モデルへ変換する。
 *
 * 変換できなかった商品は落とし、理由を issues へ残す。
 * ★中途半端なデータを本番モデルへ流さない。★
 */
export function normalizeLiverpoolProducts(
  rawProducts: LiverpoolRawProduct[],
  options: NormalizeOptions = {},
): NormalizedLiverpoolData {
  const products: Product[] = []
  const listings: StoreListing[] = []
  const variants: ProductVariant[] = []
  const snapshots: PriceSnapshot[] = []
  const issues: IngestionIssue[] = []

  const usedSlugs = new Set<string>()
  const usedKeys = new Set<string>()

  for (const raw of rawProducts) {
    const ref = raw.url || raw.externalId || raw.title

    /* ---- 識別子 ---- */
    const externalKey = buildExternalKey(raw)
    if (!externalKey) {
      issues.push({
        kind: 'unexpected-schema',
        message: '商品を識別できる値（externalId / URL）がありません',
        productRef: ref,
      })
      continue
    }
    if (usedKeys.has(externalKey)) {
      issues.push({
        kind: 'unexpected-schema',
        message: `同じ商品が2回含まれています: ${externalKey}`,
        productRef: ref,
      })
      continue
    }
    usedKeys.add(externalKey)

    /* ---- URL ---- */
    const externalUrl = normalizeProductUrl(raw.url)
    if (!externalUrl) {
      issues.push({ kind: 'unexpected-schema', message: '商品URLが不正です', productRef: ref })
      continue
    }

    /* ---- 通貨 ---- */
    // ★取得元が返した通貨をそのまま保持する。★
    //   日本向けストアが円で返すならJPY、英国向けならGBP。
    //   「日本向けだから円だろう」と決めつけない。
    const currencyRaw = raw.currency?.trim().toUpperCase() ?? ''
    if (!isSupportedCurrency(currencyRaw)) {
      issues.push({
        kind: 'unexpected-schema',
        message: `サカモノが対応していない通貨です: ${raw.currency ?? '(なし)'}`,
        productRef: ref,
      })
      continue
    }
    const currency: Currency = currencyRaw

    /* ---- 価格 ---- */
    if (raw.currentPrice === null || !Number.isFinite(raw.currentPrice) || raw.currentPrice < 0) {
      issues.push({
        kind: 'invalid-price',
        message: '現在価格が取得できていないため取り込みません',
        productRef: ref,
      })
      continue
    }

    const currentPrice = raw.currentPrice
    // 通常価格が取れない場合は「値下げしていない」として現在価格と同値にする。
    // ★存在しない値下げを作り出さないための扱い。★
    // 通常価格が現在価格より安い（＝値上げ）場合も、セール扱いにはしない。
    const hasRegular =
      raw.regularPrice !== null &&
      Number.isFinite(raw.regularPrice) &&
      raw.regularPrice >= currentPrice
    const regularPrice = hasRegular ? (raw.regularPrice as number) : currentPrice
    const discount = evaluateDiscount(regularPrice, currentPrice)

    /* ---- 属性 ---- */
    const attributes = classifyFromTitle(raw.title)
    const name = raw.title.trim()
    // 第3段階では日本語名を持たない。翻訳を推測で作らず、原文をそのまま見せる。
    const nameJa = name

    const productId = `product-lfc-ext-${externalKey}`
    const listingId = `listing-lfc-ext-${externalKey}`
    const slug = buildProductSlugFrom(name, externalKey, usedSlugs)

    /* ---- バリエーション ---- */
    const productVariants = raw.variants.map((rawVariant, index) =>
      normalizeVariant(rawVariant, listingId, index),
    )
    const stockStatus = deriveStockStatus(productVariants)

    /* ---- 組み立て ---- */
    products.push({
      id: productId,
      clubId: LIVERPOOL_CLUB_ID,
      slug,
      name,
      nameJa,
      season: attributes.season,
      // 取得元にメーカー名の項目が無いため未確認。★Nike と決めつけない。★
      manufacturer: '確認中',
      manufacturerSku: raw.sku?.trim() || null,
      jan: null,
      ean: raw.ean?.trim() || null,
      category: attributes.category,
      kitType: attributes.kitType,
      authenticity: attributes.authenticity,
      sleeve: attributes.sleeve,
      gender: attributes.gender,
      player: attributes.player,
      image: buildImage(raw.imageUrl?.trim() || null, nameJa),
      active: true,
    })

    listings.push({
      id: listingId,
      productId,
      storeId: LIVERPOOL_STORE_ID,
      externalId: raw.externalId?.trim() || externalKey,
      externalUrl,
      currency,
      currentPrice,
      regularPrice,
      discountRate: discount.rate,
      // unknown のときは false を入れるが、画面は stockStatus を見て
      // 「在庫切れ」ではなく「確認できていません」と表示する
      inStock: stockStatus === 'available',
      stockStatus,
      lastCheckedAt: raw.fetchedAt,
    })

    variants.push(...productVariants)

    snapshots.push({
      id: `snapshot-${listingId}-${raw.fetchedAt}`,
      storeListingId: listingId,
      price: currentPrice,
      currency,
      recordedAt: raw.fetchedAt,
    })

    if (!hasRegular && raw.regularPrice !== null) {
      issues.push({
        kind: 'invalid-price',
        message: '通常価格が現在価格より安いため、セール扱いにしませんでした',
        productRef: ref,
      })
    }
  }

  void options.now

  return { products, listings, variants, snapshots, issues }
}

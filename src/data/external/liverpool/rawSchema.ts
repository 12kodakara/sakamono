/**
 * 生データの検証。
 *
 * ★外部データを信用しない。★
 *   取得元が何を返すかは制御できない。
 *   文字列だと思っていた項目に数値が入っていたり、価格が負だったり、
 *   まるごと欠けていたりする。
 *   検証を通らなかったものは本番モデルへ流さない。
 *
 * 例外を投げず、問題の一覧を返す。1件ずつ止まるより、
 * 「何件中どこがおかしいか」をまとめて見られる方が直しやすいため。
 */

import type { IngestionIssue } from './errors'
import type { LiverpoolRawFeed, LiverpoolRawProduct, LiverpoolRawVariant } from './types'

export interface RawValidationResult {
  /** 検証を通ったか。 */
  valid: boolean
  /** 取り込みを止めるほどの問題。 */
  errors: IngestionIssue[]
  /** 取り込みは続けられるが、記録しておきたい問題。 */
  warnings: IngestionIssue[]
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isHttpsUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return false
  return !Number.isNaN(new Date(value).getTime())
}

/* ------------------------------------------------------------
 * バリエーション
 * ---------------------------------------------------------- */

export function validateRawVariant(
  variant: unknown,
  productRef: string,
  index: number,
): RawValidationResult {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []
  const ref = `${productRef}#variant[${index}]`

  if (typeof variant !== 'object' || variant === null) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: 'variant がオブジェクトではありません', productRef: ref }],
      warnings,
    }
  }

  const v = variant as Partial<LiverpoolRawVariant>

  if (!isNullableString(v.externalId)) {
    errors.push({ kind: 'unexpected-schema', message: 'variant.externalId が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(v.size)) {
    errors.push({ kind: 'unexpected-schema', message: 'variant.size が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(v.sku)) {
    errors.push({ kind: 'unexpected-schema', message: 'variant.sku が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(v.ean)) {
    errors.push({ kind: 'unexpected-schema', message: 'variant.ean が文字列でも null でもありません', productRef: ref })
  }
  if (!(v.available === null || typeof v.available === 'boolean')) {
    errors.push({ kind: 'unexpected-schema', message: 'variant.available が真偽値でも null でもありません', productRef: ref })
  }
  if (v.available === null) {
    warnings.push({ kind: 'unexpected-schema', message: 'variant の在庫が取得できていません（unknown として扱います）', productRef: ref })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/* ------------------------------------------------------------
 * 商品
 * ---------------------------------------------------------- */

export function validateRawProduct(product: unknown): RawValidationResult {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []

  if (typeof product !== 'object' || product === null) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: '商品がオブジェクトではありません' }],
      warnings,
    }
  }

  const p = product as Partial<LiverpoolRawProduct>
  const ref = typeof p.url === 'string' ? p.url : (p.externalId ?? '(識別子なし)')

  /* ---- 必須 ---- */

  if (!isNonEmptyString(p.title)) {
    errors.push({ kind: 'unexpected-schema', message: 'title が空です', productRef: ref })
  }
  if (!isHttpsUrl(p.url)) {
    errors.push({ kind: 'unexpected-schema', message: 'url が https のURLではありません', productRef: ref })
  }
  if (!isIsoDateTime(p.fetchedAt)) {
    errors.push({ kind: 'unexpected-schema', message: 'fetchedAt が ISO 8601 形式ではありません', productRef: ref })
  }
  if (!Array.isArray(p.variants)) {
    errors.push({ kind: 'unexpected-schema', message: 'variants が配列ではありません', productRef: ref })
  }

  /* ---- 価格 ---- */

  if (!isNullableNumber(p.currentPrice)) {
    errors.push({ kind: 'invalid-price', message: 'currentPrice が数値でも null でもありません', productRef: ref })
  } else if (p.currentPrice !== null && p.currentPrice < 0) {
    errors.push({ kind: 'invalid-price', message: `currentPrice がマイナスです: ${p.currentPrice}`, productRef: ref })
  }

  if (!isNullableNumber(p.regularPrice)) {
    errors.push({ kind: 'invalid-price', message: 'regularPrice が数値でも null でもありません', productRef: ref })
  } else if (p.regularPrice !== null && p.regularPrice < 0) {
    errors.push({ kind: 'invalid-price', message: `regularPrice がマイナスです: ${p.regularPrice}`, productRef: ref })
  }

  // ★価格が無いまま取り込むと「0円の商品」になりかねないので、ここで止める★
  if (p.currentPrice === null || p.currentPrice === undefined) {
    errors.push({ kind: 'invalid-price', message: '現在価格が取得できていないため取り込めません', productRef: ref })
  }

  // 通常価格が現在価格より安い = 値上げ。データの誤りの可能性が高い
  if (
    typeof p.regularPrice === 'number' &&
    typeof p.currentPrice === 'number' &&
    p.regularPrice < p.currentPrice
  ) {
    warnings.push({
      kind: 'invalid-price',
      message: `regularPrice(${p.regularPrice}) が currentPrice(${p.currentPrice}) より安いため、セール扱いにしません`,
      productRef: ref,
    })
  }

  if (p.regularPrice === null || p.regularPrice === undefined) {
    warnings.push({ kind: 'unexpected-schema', message: '通常価格が取得できていません（セール判定はできません）', productRef: ref })
  }

  /* ---- 通貨 ---- */

  if (!isNullableString(p.currency)) {
    errors.push({ kind: 'unexpected-schema', message: 'currency が文字列でも null でもありません', productRef: ref })
  } else if (p.currency === null) {
    errors.push({ kind: 'unexpected-schema', message: '通貨が分からないため取り込めません', productRef: ref })
  }

  /* ---- 任意項目（取れなくてもよいが記録する）---- */

  if (!isNullableString(p.externalId)) {
    errors.push({ kind: 'unexpected-schema', message: 'externalId が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(p.sku)) {
    errors.push({ kind: 'unexpected-schema', message: 'sku が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(p.ean)) {
    errors.push({ kind: 'unexpected-schema', message: 'ean が文字列でも null でもありません', productRef: ref })
  }
  if (!isNullableString(p.imageUrl)) {
    errors.push({ kind: 'unexpected-schema', message: 'imageUrl が文字列でも null でもありません', productRef: ref })
  }

  if (p.sku === null) {
    warnings.push({ kind: 'unexpected-schema', message: 'SKU が取得できていません', productRef: ref })
  }
  if (p.ean === null) {
    warnings.push({ kind: 'unexpected-schema', message: 'EAN が取得できていません', productRef: ref })
  }
  if (Array.isArray(p.variants) && p.variants.length === 0) {
    warnings.push({ kind: 'unexpected-schema', message: 'サイズのバリエーションが取得できていません', productRef: ref })
  }

  /* ---- バリエーション ---- */

  if (Array.isArray(p.variants)) {
    p.variants.forEach((variant, index) => {
      const result = validateRawVariant(variant, ref, index)
      errors.push(...result.errors)
      warnings.push(...result.warnings)
    })
  }

  return { valid: errors.length === 0, errors, warnings }
}

/* ------------------------------------------------------------
 * フィード全体
 * ---------------------------------------------------------- */

export interface RawFeedValidationResult extends RawValidationResult {
  /** 検証を通った商品だけ。 */
  validProducts: LiverpoolRawProduct[]
  /** 検証で落ちた商品の件数。 */
  rejectedCount: number
}

export function validateRawFeed(feed: unknown): RawFeedValidationResult {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []
  const validProducts: LiverpoolRawProduct[] = []

  if (typeof feed !== 'object' || feed === null) {
    return {
      valid: false,
      errors: [{ kind: 'parse', message: '取り込みファイルがオブジェクトではありません' }],
      warnings,
      validProducts,
      rejectedCount: 0,
    }
  }

  const f = feed as Partial<LiverpoolRawFeed>

  if (!['affiliate-feed', 'manual', 'sample'].includes(String(f.origin))) {
    errors.push({
      kind: 'unexpected-schema',
      message: `origin が不正です: ${String(f.origin)}。どの経路で入手したデータか必ず記録してください`,
    })
  }
  if (!isNonEmptyString(f.sourceNote)) {
    errors.push({ kind: 'unexpected-schema', message: 'sourceNote が空です（入手元を記録してください）' })
  }
  if (!isIsoDateTime(f.fetchedAt)) {
    errors.push({ kind: 'unexpected-schema', message: 'fetchedAt が ISO 8601 形式ではありません' })
  }
  if (!Array.isArray(f.products)) {
    errors.push({ kind: 'unexpected-schema', message: 'products が配列ではありません' })
    return { valid: false, errors, warnings, validProducts, rejectedCount: 0 }
  }

  let rejectedCount = 0
  for (const product of f.products) {
    const result = validateRawProduct(product)
    warnings.push(...result.warnings)

    if (result.valid) {
      validProducts.push(product as LiverpoolRawProduct)
    } else {
      rejectedCount += 1
      // 1商品の問題でフィード全体を止めない。その商品だけ落とす。
      errors.push(...result.errors)
    }
  }

  return {
    // フィード自体の形が壊れていなければ、商品が何件か落ちても続行できる
    valid: Array.isArray(f.products) && isNonEmptyString(f.sourceNote),
    errors,
    warnings,
    validProducts,
    rejectedCount,
  }
}

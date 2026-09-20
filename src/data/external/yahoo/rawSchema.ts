/**
 * Yahoo! APIレスポンスの検証。
 *
 * ★外部から来たデータを信用しない。★
 *   仕様に「必ず入る」と書かれていても、実際には欠けたり型が違ったりします。
 *   おかしなデータを照合エンジンへ流すと、誤った価格比較になります。
 *
 * 例外は投げず、問題の一覧を返します。
 * 1件おかしくても他の候補は使えるので、その商品だけ落とします。
 */

import type { IngestionIssue } from '../ingestionErrors'
import type { YahooApiHit, YahooApiResponse, YahooRawProduct } from './types'

export interface YahooValidationResult {
  valid: boolean
  errors: IngestionIssue[]
  warnings: IngestionIssue[]
}

export interface YahooResponseValidationResult extends YahooValidationResult {
  products: YahooRawProduct[]
  totalResultsAvailable: number
  totalResultsReturned: number
  /** 検証で落ちた件数。 */
  rejectedCount: number
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/**
 * 商品ページURLからトラッキング用のパラメータを取り除く。
 *
 * ★アフィリエイトURLは作りません（第4段階では対象外）。★
 *   ここでやるのは、素の商品ページURLへそろえることだけです。
 */
export function normalizeYahooUrl(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const trackingPrefixes = ['utm_', 'sc_']
  const trackingNames = ['sc_e', 'sc_i', 'sc_cid', 'gclid', 'yclid', 'aq', 'oq', 'vc_url', 'rafcid']

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase()
    if (trackingNames.includes(lower) || trackingPrefixes.some((p) => lower.startsWith(p))) {
      url.searchParams.delete(key)
    }
  }
  url.hash = ''
  return url.toString()
}

/** condition の値を安全に読み取る。★不明を new にしない。★ */
function readCondition(value: unknown): YahooRawProduct['condition'] {
  if (value === 'new') return 'new'
  if (value === 'used') return 'used'
  return 'unknown'
}

/** inStock を安全に読み取る。★不明を available にしない。★ */
function readAvailability(value: unknown): YahooRawProduct['availability'] {
  if (value === true) return 'available'
  if (value === false) return 'unavailable'
  return 'unknown'
}

/**
 * 通常価格を読み取る。
 *
 * priceLabel.defaultPrice が通常価格にあたる。
 * ★現在価格より安い defaultPrice は採用しない。★
 *   値上げをセール扱いしてしまうため（第2段階の方針と同じ）。
 */
function readRegularPrice(hit: YahooApiHit, price: number): number | null {
  const candidates = [hit.priceLabel?.defaultPrice, hit.priceLabel?.fixedPrice]
  for (const candidate of candidates) {
    const value = asFiniteNumber(candidate)
    if (value !== null && value >= price) return value
  }
  return null
}

/* ------------------------------------------------------------
 * 1商品分
 * ---------------------------------------------------------- */

export function validateYahooHit(
  hit: unknown,
  fetchedAt: string,
): YahooValidationResult & { product: YahooRawProduct | null } {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []

  if (typeof hit !== 'object' || hit === null) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: '検索結果の要素がオブジェクトではありません' }],
      warnings,
      product: null,
    }
  }

  const raw = hit as YahooApiHit
  const ref = asNonEmptyString(raw.url) ?? asNonEmptyString(raw.code) ?? '(識別子なし)'

  /* ---- 商品名 ---- */
  const name = asNonEmptyString(raw.name)
  if (!name) {
    errors.push({ kind: 'unexpected-schema', message: '商品名がありません', productRef: ref })
  }

  /* ---- URL ---- */
  if (!isHttpsUrl(raw.url)) {
    errors.push({ kind: 'unexpected-schema', message: '商品URLが https のURLではありません', productRef: ref })
  }
  const url = isHttpsUrl(raw.url) ? normalizeYahooUrl(raw.url) : null
  if (isHttpsUrl(raw.url) && !url) {
    errors.push({ kind: 'unexpected-schema', message: '商品URLを解釈できませんでした', productRef: ref })
  }

  /* ---- 価格 ---- */
  const price = asFiniteNumber(raw.price)
  if (price === null) {
    // ★価格が無い商品は取り込まない。0円の商品を作らないため。★
    errors.push({ kind: 'invalid-price', message: '価格がありません', productRef: ref })
  } else if (price <= 0) {
    errors.push({ kind: 'invalid-price', message: `価格が0以下です: ${price}`, productRef: ref })
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, product: null }
  }

  /* ---- ここから先は必須項目がそろっている ---- */

  const externalId =
    asNonEmptyString(raw.code) ??
    (url ? new URL(url).pathname.split('/').filter(Boolean).slice(-1)[0] : null) ??
    ref

  const janCode = asNonEmptyString(raw.janCode)
  const brandName = asNonEmptyString(raw.brand?.name)
  const condition = readCondition(raw.condition)
  const availability = readAvailability(raw.inStock)

  if (!janCode) {
    warnings.push({ kind: 'unexpected-schema', message: 'JANコードが取得できていません', productRef: ref })
  }
  if (!brandName) {
    warnings.push({ kind: 'unexpected-schema', message: 'ブランド名が取得できていません', productRef: ref })
  }
  if (condition === 'unknown') {
    warnings.push({
      kind: 'unexpected-schema',
      message: '新品／中古を判別できませんでした（新品としては扱いません）',
      productRef: ref,
    })
  }
  if (availability === 'unknown') {
    warnings.push({
      kind: 'unexpected-schema',
      message: '在庫を判別できませんでした（在庫ありとしては扱いません）',
      productRef: ref,
    })
  }

  const product: YahooRawProduct = {
    externalId,
    name: name as string,
    url: url as string,
    price: price as number,
    regularPrice: readRegularPrice(raw, price as number),
    janCode,
    brandName,
    sellerId: asNonEmptyString(raw.seller?.sellerId),
    sellerName: asNonEmptyString(raw.seller?.name),
    // ★画像は記録のみ。利用条件が未確認のうちは表示に使わない。★
    imageUrl: asNonEmptyString(raw.image?.medium) ?? asNonEmptyString(raw.image?.small),
    availability,
    condition,
    shippingLabel: asNonEmptyString(raw.shipping?.name),
    fetchedAt,
  }

  return { valid: true, errors, warnings, product }
}

/* ------------------------------------------------------------
 * レスポンス全体
 * ---------------------------------------------------------- */

export function validateYahooResponse(
  response: unknown,
  fetchedAt: string,
): YahooResponseValidationResult {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []
  const products: YahooRawProduct[] = []

  if (typeof response !== 'object' || response === null) {
    return {
      valid: false,
      errors: [{ kind: 'parse', message: 'APIレスポンスがオブジェクトではありません' }],
      warnings,
      products,
      totalResultsAvailable: 0,
      totalResultsReturned: 0,
      rejectedCount: 0,
    }
  }

  const body = response as YahooApiResponse

  if (!Array.isArray(body.hits)) {
    // 0件のときは hits が無いことがある。件数が0なら異常ではない。
    const total = asFiniteNumber(body.totalResultsAvailable)
    if (total === 0) {
      return {
        valid: true,
        errors,
        warnings,
        products,
        totalResultsAvailable: 0,
        totalResultsReturned: 0,
        rejectedCount: 0,
      }
    }
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: 'hits が配列ではありません' }],
      warnings,
      products,
      totalResultsAvailable: total ?? 0,
      totalResultsReturned: 0,
      rejectedCount: 0,
    }
  }

  let rejectedCount = 0
  for (const hit of body.hits) {
    const result = validateYahooHit(hit, fetchedAt)
    warnings.push(...result.warnings)
    if (result.valid && result.product) {
      products.push(result.product)
    } else {
      rejectedCount += 1
      errors.push(...result.errors)
    }
  }

  return {
    valid: true,
    errors,
    warnings,
    products,
    totalResultsAvailable: asFiniteNumber(body.totalResultsAvailable) ?? products.length,
    totalResultsReturned: asFiniteNumber(body.totalResultsReturned) ?? products.length,
    rejectedCount,
  }
}

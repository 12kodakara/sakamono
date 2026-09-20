/**
 * 楽天 APIレスポンスの検証。
 *
 * ★外部から来たデータを信用しない。★
 *   仕様に「必ず入る」と書かれていても、実際には欠けたり型が違ったりします。
 *   おかしなデータを照合エンジンへ流すと、誤った価格比較になります。
 *
 * 例外は投げず、問題の一覧を返します。
 * 1件おかしくても他の候補は使えるので、その商品だけ落とします。
 */

import type { IngestionIssue } from '../ingestionErrors'
import type { RakutenApiItem, RakutenApiResponse, RakutenRawItem } from './types'

export interface RakutenValidationResult {
  valid: boolean
  errors: IngestionIssue[]
  warnings: IngestionIssue[]
}

export interface RakutenResponseValidationResult extends RakutenValidationResult {
  items: RakutenRawItem[]
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

/** 配列の先頭の文字列を取り出す（画像URLの配列用）。 */
function firstImageUrl(value: unknown): string | null {
  if (!Array.isArray(value)) return null
  for (const entry of value) {
    // formatVersion=1 は { imageUrl: '...' }、2 は素の文字列
    const candidate =
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry !== null
          ? (entry as { imageUrl?: unknown }).imageUrl
          : null
    const url = asNonEmptyString(candidate)
    if (url) return url
  }
  return null
}

/**
 * 商品ページURLからトラッキング用のパラメータを取り除く。
 *
 * ★アフィリエイトURLは作りません（第5段階では対象外）。★
 *   指示書26のとおり、通常の商品ページURLだけを保持します。
 *   レスポンスに affiliateUrl が入っていても使いません。
 */
export function normalizeRakutenUrl(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null

  const trackingPrefixes = ['utm_', 'scid', 'rafcid']
  const trackingNames = ['scid', 'rafcid', 'gclid', 'yclid', 'iasid', 'trflg', 's-id']

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase()
    if (trackingNames.includes(lower) || trackingPrefixes.some((p) => lower.startsWith(p))) {
      url.searchParams.delete(key)
    }
  }
  url.hash = ''
  return url.toString()
}

/** availability を安全に読み取る。★不明を available にしない。★ */
function readAvailability(value: unknown): RakutenRawItem['availability'] {
  if (value === 1) return 'available'
  if (value === 0) return 'unavailable'
  return 'unknown'
}

/** taxFlag を読み取る。★0=税込 / 1=税別★ */
function readTaxBasis(value: unknown): RakutenRawItem['taxBasis'] {
  if (value === 0) return 'tax-included'
  if (value === 1) return 'tax-excluded'
  return 'unknown'
}

/** postageFlag を読み取る。★0=送料込み / 1=送料別★ */
function readPostageBasis(value: unknown): RakutenRawItem['postageBasis'] {
  if (value === 0) return 'included'
  if (value === 1) return 'excluded'
  return 'unknown'
}

/* ------------------------------------------------------------
 * 1商品分
 * ---------------------------------------------------------- */

export function validateRakutenItem(
  item: unknown,
  fetchedAt: string,
): RakutenValidationResult & { item: RakutenRawItem | null } {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []

  if (typeof item !== 'object' || item === null) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: '検索結果の要素がオブジェクトではありません' }],
      warnings,
      item: null,
    }
  }

  const raw = item as RakutenApiItem
  const ref = asNonEmptyString(raw.itemCode) ?? asNonEmptyString(raw.itemUrl) ?? '(識別子なし)'

  /* ---- 商品名 ---- */
  const name = asNonEmptyString(raw.itemName)
  if (!name) {
    errors.push({ kind: 'unexpected-schema', message: '商品名がありません', productRef: ref })
  }

  /* ---- URL ---- */
  if (!isHttpsUrl(raw.itemUrl)) {
    errors.push({
      kind: 'unexpected-schema',
      message: '商品URLが https のURLではありません',
      productRef: ref,
    })
  }
  const url = isHttpsUrl(raw.itemUrl) ? normalizeRakutenUrl(raw.itemUrl as string) : null
  if (isHttpsUrl(raw.itemUrl) && !url) {
    errors.push({
      kind: 'unexpected-schema',
      message: '商品URLを解釈できませんでした',
      productRef: ref,
    })
  }

  /* ---- 価格 ---- */
  const price = asFiniteNumber(raw.itemPrice)
  if (price === null) {
    // ★価格が無い商品は取り込まない。0円の商品を作らないため。★
    errors.push({ kind: 'invalid-price', message: '価格がありません', productRef: ref })
  } else if (price <= 0) {
    errors.push({ kind: 'invalid-price', message: `価格が0以下です: ${price}`, productRef: ref })
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings, item: null }
  }

  /* ---- ここから先は必須項目がそろっている ---- */

  const externalId =
    asNonEmptyString(raw.itemCode) ??
    (url ? new URL(url).pathname.split('/').filter(Boolean).slice(-1)[0] : null) ??
    ref

  const availability = readAvailability(raw.availability)
  const taxBasis = readTaxBasis(raw.taxFlag)
  const postageBasis = readPostageBasis(raw.postageFlag)

  if (availability === 'unknown') {
    warnings.push({
      kind: 'unexpected-schema',
      message: '在庫を判別できませんでした（在庫ありとしては扱いません）',
      productRef: ref,
    })
  }
  if (taxBasis === 'unknown') {
    warnings.push({
      kind: 'unexpected-schema',
      message: '税込か税別かを判別できませんでした（税込としては扱いません）',
      productRef: ref,
    })
  }
  if (postageBasis === 'unknown') {
    warnings.push({
      kind: 'unexpected-schema',
      message: '送料込みかどうかを判別できませんでした（送料0円としては扱いません）',
      productRef: ref,
    })
  }

  const validated: RakutenRawItem = {
    externalId,
    name: name as string,
    url: url as string,
    price: price as number,
    shopCode: asNonEmptyString(raw.shopCode),
    shopName: asNonEmptyString(raw.shopName),
    // ★楽天の商品検索APIはJANを返さない。商品説明から拾わない。★
    janCode: null,
    // ★ブランド名の単独項目も無い。商品名から照合エンジンが判定する。★
    manufacturer: null,
    // ★画像は記録のみ。利用条件が未確認のうちは表示に使わない。★
    imageUrl: firstImageUrl(raw.mediumImageUrls) ?? firstImageUrl(raw.smallImageUrls),
    availability,
    taxBasis,
    postageBasis,
    pointRate: asFiniteNumber(raw.pointRate),
    fetchedAt,
  }

  return { valid: true, errors, warnings, item: validated }
}

/* ------------------------------------------------------------
 * レスポンス全体
 * ---------------------------------------------------------- */

/**
 * Items の包み方の違いをほどく。
 *
 *   formatVersion=1 … [{ Item: {...} }]
 *   formatVersion=2 … [{...}]
 *
 * ★どちらでも読めるようにしておきます。★
 *   設定を1つ間違えただけで全件落ちる、という壊れ方を避けるためです。
 */
function unwrapItems(items: unknown): unknown[] {
  if (!Array.isArray(items)) return []
  return items.map((entry) => {
    if (typeof entry === 'object' && entry !== null && 'Item' in entry) {
      return (entry as { Item: unknown }).Item
    }
    return entry
  })
}

export function validateRakutenResponse(
  body: unknown,
  fetchedAt: string,
): RakutenResponseValidationResult {
  const errors: IngestionIssue[] = []
  const warnings: IngestionIssue[] = []

  if (typeof body !== 'object' || body === null) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: '応答がオブジェクトではありません' }],
      warnings,
      items: [],
      totalResultsAvailable: 0,
      totalResultsReturned: 0,
      rejectedCount: 0,
    }
  }

  const response = body as RakutenApiResponse

  /* ---- APIが明示的にエラーを返した場合 ---- */
  const apiError = asNonEmptyString(response.error)
  if (apiError) {
    return {
      valid: false,
      errors: [
        {
          kind: 'unexpected-schema',
          message: `楽天APIがエラーを返しました: ${apiError}${
            asNonEmptyString(response.error_description)
              ? `（${asNonEmptyString(response.error_description)}）`
              : ''
          }`,
        },
      ],
      warnings,
      items: [],
      totalResultsAvailable: 0,
      totalResultsReturned: 0,
      rejectedCount: 0,
    }
  }

  if (response.Items !== undefined && !Array.isArray(response.Items)) {
    return {
      valid: false,
      errors: [{ kind: 'unexpected-schema', message: 'Items が配列ではありません' }],
      warnings,
      items: [],
      totalResultsAvailable: 0,
      totalResultsReturned: 0,
      rejectedCount: 0,
    }
  }

  const rawItems = unwrapItems(response.Items)
  const items: RakutenRawItem[] = []
  let rejectedCount = 0

  for (const rawItem of rawItems) {
    const result = validateRakutenItem(rawItem, fetchedAt)
    warnings.push(...result.warnings)
    if (result.valid && result.item) {
      items.push(result.item)
    } else {
      rejectedCount += 1
      warnings.push(...result.errors)
    }
  }

  // ★0件は「エラー」ではありません。★
  //   条件に合う商品が無かっただけです。0件を失敗として扱うと、
  //   「見つからなかった」を「取得できなかった」と取り違えます。
  return {
    valid: true,
    errors,
    warnings,
    items,
    totalResultsAvailable: asFiniteNumber(response.count) ?? items.length,
    totalResultsReturned: asFiniteNumber(response.hits) ?? items.length,
    rejectedCount,
  }
}

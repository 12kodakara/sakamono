/**
 * 取り込みの流れをまとめる場所。
 *
 *   取得元（LiverpoolRawSource）
 *      ↓ 読み込み
 *   生データ（LiverpoolRawFeed）
 *      ↓ 検証（★外部データを信用しない★）
 *   検証を通った商品だけ
 *      ↓ 正規化（LiverpoolAdapter）
 *   Product / StoreListing / ProductVariant / PriceSnapshot
 *      ↓ 書き出し
 *   normalized/liverpool/latest.json
 *
 * 途中で落ちた商品は件数と理由を残す。
 * 「10件取ったつもりが7件しか入っていない」ことに気付けるようにするため。
 */

import type { IngestionIssue } from './errors'
import { IngestionError } from './errors'
import { validateRawFeed } from './rawSchema'
import { normalizeLiverpoolProducts, type NormalizedLiverpoolData } from './normalize'
import type { LiverpoolRawSource } from './rawSource'
import type { LiverpoolRawFeed, LiverpoolRawProduct } from './types'

/* ------------------------------------------------------------
 * 取得状況の集計
 * ---------------------------------------------------------- */

export interface IngestionCoverage {
  /** 検証を通った商品の件数。これが分母。 */
  total: number
  /** 各項目が取れた件数と割合（0〜1）。 */
  price: CoverageEntry
  regularPrice: CoverageEntry
  sku: CoverageEntry
  ean: CoverageEntry
  variants: CoverageEntry
  /** バリエーションの在庫が1つでも確定している商品の件数。 */
  stock: CoverageEntry
  imageUrl: CoverageEntry
  season: CoverageEntry
  authenticity: CoverageEntry
}

export interface CoverageEntry {
  count: number
  rate: number
}

function entry(count: number, total: number): CoverageEntry {
  return { count, rate: total === 0 ? 0 : count / total }
}

/**
 * 生データ側の取得状況を数える。
 *
 * ★「何が取れなかったか」を必ず見えるようにする。★
 *   取得率が低い項目は、そのまま比較の精度に直結する。
 */
export function measureCoverage(
  rawProducts: LiverpoolRawProduct[],
  normalized: NormalizedLiverpoolData,
): IngestionCoverage {
  const total = rawProducts.length

  const hasVariantStock = rawProducts.filter((product) =>
    product.variants.some((variant) => variant.available !== null),
  ).length

  const seasonCount = normalized.products.filter((product) => product.season !== null).length
  const authenticityCount = normalized.products.filter(
    (product) => product.authenticity === 'replica' || product.authenticity === 'authentic',
  ).length

  return {
    total,
    price: entry(rawProducts.filter((p) => p.currentPrice !== null).length, total),
    regularPrice: entry(rawProducts.filter((p) => p.regularPrice !== null).length, total),
    sku: entry(rawProducts.filter((p) => Boolean(p.sku)).length, total),
    ean: entry(rawProducts.filter((p) => Boolean(p.ean)).length, total),
    variants: entry(rawProducts.filter((p) => p.variants.length > 0).length, total),
    stock: entry(hasVariantStock, total),
    imageUrl: entry(rawProducts.filter((p) => Boolean(p.imageUrl)).length, total),
    season: entry(seasonCount, normalized.products.length),
    authenticity: entry(authenticityCount, normalized.products.length),
  }
}

/* ------------------------------------------------------------
 * 正規化済みデータのファイル形式
 * ---------------------------------------------------------- */

export interface NormalizedLiverpoolFile {
  /** このファイルを作った日時。 */
  generatedAt: string
  /** 生データの入手経路。 */
  origin: LiverpoolRawFeed['origin']
  /** 入手元の説明。 */
  sourceNote: string
  /**
   * 表示している価格がサンプル値かどうか。
   * origin が 'sample' のときだけ true。
   */
  isSampleData: boolean
  products: NormalizedLiverpoolData['products']
  listings: NormalizedLiverpoolData['listings']
  variants: NormalizedLiverpoolData['variants']
  snapshots: NormalizedLiverpoolData['snapshots']
}

/* ------------------------------------------------------------
 * 実行
 * ---------------------------------------------------------- */

export interface IngestOptions {
  /** 取り込む最大件数。指示書のとおり、まずは少量にとどめる。 */
  limit?: number
}

export interface IngestResult {
  feed: LiverpoolRawFeed
  /** 生データの件数（limit を適用した後）。 */
  fetchedCount: number
  /** 検証を通った件数。 */
  validCount: number
  /** 検証で落ちた件数。 */
  rejectedCount: number
  errors: IngestionIssue[]
  warnings: IngestionIssue[]
  normalized: NormalizedLiverpoolData
  coverage: IngestionCoverage
  file: NormalizedLiverpoolFile
}

/** 1回の取り込みを実行する（書き出しは行わない）。 */
export async function runIngestion(
  source: LiverpoolRawSource,
  options: IngestOptions = {},
): Promise<IngestResult> {
  const feed = await source.load()

  if (!feed || !Array.isArray((feed as LiverpoolRawFeed).products)) {
    throw new IngestionError('unexpected-schema', '生データに products の配列がありません')
  }

  // ★まず件数を絞る。相手にも自分にも負荷をかけないため。★
  const limited =
    options.limit && options.limit > 0
      ? { ...feed, products: feed.products.slice(0, options.limit) }
      : feed

  const validation = validateRawFeed(limited)
  if (!validation.valid) {
    throw new IngestionError(
      'unexpected-schema',
      `生データの形が想定と違います:\n${validation.errors.map((e) => `  - ${e.message}`).join('\n')}`,
    )
  }

  const normalized = normalizeLiverpoolProducts(validation.validProducts)
  const coverage = measureCoverage(validation.validProducts, normalized)

  const generatedAt = new Date(limited.fetchedAt).toISOString()

  return {
    feed: limited,
    fetchedCount: limited.products.length,
    validCount: validation.validProducts.length,
    rejectedCount: validation.rejectedCount,
    errors: [...validation.errors, ...normalized.issues.filter((i) => i.kind === 'invalid-price')],
    warnings: validation.warnings,
    normalized,
    coverage,
    file: {
      generatedAt,
      origin: limited.origin,
      sourceNote: limited.sourceNote,
      isSampleData: limited.origin === 'sample',
      products: normalized.products,
      listings: normalized.listings,
      variants: normalized.variants,
      snapshots: normalized.snapshots,
    },
  }
}

/** 取得状況を人が読める形へ整える。 */
export function formatCoverage(coverage: IngestionCoverage): string[] {
  const percent = (value: CoverageEntry) => `${Math.round(value.rate * 100)}%`.padStart(4)

  return [
    `  価格取得率          ${percent(coverage.price)}  (${coverage.price.count}/${coverage.total})`,
    `  通常価格取得率      ${percent(coverage.regularPrice)}  (${coverage.regularPrice.count}/${coverage.total})`,
    `  SKU取得率           ${percent(coverage.sku)}  (${coverage.sku.count}/${coverage.total})`,
    `  EAN取得率           ${percent(coverage.ean)}  (${coverage.ean.count}/${coverage.total})`,
    `  variant取得率       ${percent(coverage.variants)}  (${coverage.variants.count}/${coverage.total})`,
    `  在庫取得率          ${percent(coverage.stock)}  (${coverage.stock.count}/${coverage.total})`,
    `  画像URL取得率       ${percent(coverage.imageUrl)}  (${coverage.imageUrl.count}/${coverage.total})`,
    `  シーズン判別率      ${percent(coverage.season)}  (${coverage.season.count}/${coverage.total})`,
    `  レプリカ/オーセン   ${percent(coverage.authenticity)}  (${coverage.authenticity.count}/${coverage.total})`,
  ]
}

/**
 * Yahoo!検索の実行と、結果のまとめ。
 *
 *   Product
 *     ↓ YahooQueryBuilder（強い手掛かりの順に検索条件を作る）
 *   検索（1件ずつ・間隔を空けて）
 *     ↓ validation
 *   YahooRawProduct
 *     ↓ YahooAdapter ＋ 照合エンジン
 *   DomesticOffer
 *     ↓
 *   Store / StoreListing / DomesticMatch / ShippingRule
 *
 * ★一度に大量の検索を投げないこと。★
 *   強い手掛かり（JAN）で十分な候補が見つかったら、
 *   弱い手掛かり（属性検索）は実行しません。
 *   API利用量を抑えるためでもあり、誤一致を減らすためでもあります。
 */

import type { Product } from '@/domain/types'
import type { DomesticOffer } from '@/domain/domesticOffer'
import type { MatchContext } from '@/lib/matching/engine'
import type { IngestionIssue } from '../ingestionErrors'
import {
  buildYahooSearchPlans,
  type QueryBuilderOptions,
  type YahooSearchPlan,
} from './queryBuilder'
import {
  summarizeOffers,
  toDomesticOffers,
  toSakamonoModels,
  type YahooNormalizedModels,
  type YahooOfferSummary,
} from './normalize'
import { validateYahooResponse } from './rawSchema'
import { yahooSampleResponse } from './sampleResponse'
import type { YahooRawProduct, YahooSearchResult } from './types'

/** 検索を実行するもの（本物のAPI / サンプル）。 */
export interface YahooSearchExecutor {
  search(plan: YahooSearchPlan): Promise<YahooSearchResult>
}

/**
 * サンプル応答を返す実行器。
 *
 * ★外部への通信は一切しません。★
 *   Client ID が無くてもパイプラインを確かめられるようにするためのものです。
 */
export class SampleSearchExecutor implements YahooSearchExecutor {
  async search(plan: YahooSearchPlan): Promise<YahooSearchResult> {
    const fetchedAt = new Date().toISOString()
    const validation = validateYahooResponse(yahooSampleResponse, fetchedAt)

    return {
      requestParams: plan.params,
      level: plan.level,
      totalResultsAvailable: validation.totalResultsAvailable,
      totalResultsReturned: validation.totalResultsReturned,
      products: validation.products,
      fetchedAt,
      fromCache: false,
    }
  }
}

/* ------------------------------------------------------------
 * 実行
 * ---------------------------------------------------------- */

export interface YahooIngestOptions {
  product: Product
  clubSlug: string
  clubName: string
  /**
   * 妥当な価格帯の目安（円）。
   * 極端に安い出品を「要確認」へ送るために使う。
   */
  referencePriceJpy?: number | null
  /**
   * サイズ（ProductVariant）ごとのJAN。分かっている分だけ。
   *
   * ★国内ECのJANはサイズ単位で付くことが多いためです。★
   *   商品の代表JANだけで照合すると、同じ商品でもサイズが違うだけで
   *   「JANが違う」ことになります。
   */
  variantJans?: readonly (string | null)[]
  /** 実行する検索の最大数。★API利用量を抑えるため既定は2。★ */
  maxSearches?: number
  /** 採用候補がこの件数に達したら、弱い手掛かりの検索を打ち切る。 */
  enoughAdopted?: number
  queryOptions?: QueryBuilderOptions
}

export interface YahooIngestResult {
  product: Product
  /** 作られた検索条件（実行しなかったものを含む）。 */
  plans: YahooSearchPlan[]
  /** 実際に実行した検索。 */
  searches: YahooSearchResult[]
  /** 重複を除いた候補。 */
  offers: DomesticOffer[]
  summary: YahooOfferSummary
  models: YahooNormalizedModels
  warnings: IngestionIssue[]
}

const DEFAULT_MAX_SEARCHES = 2
const DEFAULT_ENOUGH_ADOPTED = 3

/** Yahoo!検索を実行して、候補と変換結果を返す。 */
export async function runYahooSearch(
  executor: YahooSearchExecutor,
  options: YahooIngestOptions,
): Promise<YahooIngestResult> {
  const { product, clubSlug, clubName } = options

  const plans = buildYahooSearchPlans(product, clubSlug, clubName, options.queryOptions)
  const maxSearches = options.maxSearches ?? DEFAULT_MAX_SEARCHES
  const enoughAdopted = options.enoughAdopted ?? DEFAULT_ENOUGH_ADOPTED

  const context: MatchContext = {
    product,
    clubSlug,
    referencePriceJpy: options.referencePriceJpy ?? null,
    variantJans: options.variantJans ?? [],
  }

  const searches: YahooSearchResult[] = []
  const rawByUrl = new Map<string, { raw: YahooRawProduct; level: string }>()
  const warnings: IngestionIssue[] = []

  for (const plan of plans.slice(0, maxSearches)) {
    const result = await executor.search(plan)
    searches.push(result)

    for (const raw of result.products) {
      // 先に見つかった（＝より強い手掛かりの）ものを優先して残す
      if (!rawByUrl.has(raw.url)) {
        rawByUrl.set(raw.url, { raw, level: plan.level })
      }
    }

    // 十分な採用候補が見つかったら、弱い手掛かりの検索はしない
    const provisional = toDomesticOffers(
      [...rawByUrl.values()].map((entry) => entry.raw),
      context,
      plan.level,
    )
    if (summarizeOffers(provisional).adoptedCount >= enoughAdopted) break
  }

  /* ---- 候補の組み立て ---- */
  const entries = [...rawByUrl.values()]
  const offers: DomesticOffer[] = entries.map((entry) => {
    const [offer] = toDomesticOffers([entry.raw], context, entry.level)
    return offer
  })

  const summary = summarizeOffers(offers)

  /* ---- 送料の情報（総額を出せるかの判断に使う）---- */
  const shippingLabels = new Map<string, string | null>(
    entries.map((entry) => [entry.raw.externalId, entry.raw.shippingLabel]),
  )
  const models = toSakamonoModels(product, offers, shippingLabels)

  return { product, plans, searches, offers, summary, models, warnings }
}

/* ------------------------------------------------------------
 * dry-run レポート
 * ---------------------------------------------------------- */

/**
 * 確認用のレポートを組み立てる。
 *
 * ★APIキーや個人情報は出力しません。★
 *   検索条件は appid を除いたものだけを表示します。
 */
export function formatIngestReport(result: YahooIngestResult): string[] {
  const { product, summary } = result
  const yen = (value: number | null) =>
    value === null ? '—' : `¥${Math.round(value).toLocaleString('ja-JP')}`

  const lines: string[] = []

  lines.push('── 対象商品 ────────────────────────────────────────')
  lines.push(`  ${product.nameJa}`)
  lines.push(`  ID: ${product.id}`)
  lines.push(
    `  シーズン: ${product.season ?? '未確認'} / 種類: ${product.kitType ?? '—'} / 仕様: ${product.authenticity ?? '—'}`,
  )
  lines.push(`  メーカー: ${product.manufacturer} / 品番: ${product.manufacturerSku ?? '—'}`)
  lines.push(`  JAN: ${product.jan ?? '—'} / EAN: ${product.ean ?? '—'}`)
  lines.push('')

  lines.push('── 検索条件 ────────────────────────────────────────')
  if (result.plans.length === 0) {
    lines.push('  使える検索条件がありませんでした（手掛かり不足）')
  }
  result.plans.forEach((plan, index) => {
    const executed = index < result.searches.length ? '実行' : 'スキップ'
    lines.push(`  [${plan.level}] ${plan.description} … ${executed}`)
  })
  lines.push('')

  lines.push('── 候補 ────────────────────────────────────────────')
  lines.push(`  Yahoo候補:      ${summary.candidateCount}件`)
  lines.push(`  重大不一致で除外: ${summary.hardRejectedCount}件`)
  lines.push(`  要確認:         ${summary.reviewCount}件`)
  lines.push(
    `  ランク A:${summary.gradeCounts.A}  B:${summary.gradeCounts.B}  C:${summary.gradeCounts.C}  D:${summary.gradeCounts.D}`,
  )
  lines.push(`  自動採用:       ${summary.adoptedCount}件`)
  if (summary.shippingUnknownCount > 0) {
    lines.push(
      `  送料条件が不明:   ${summary.shippingUnknownCount}件（照合は通りましたが総額を出せません）`,
    )
  }
  lines.push('')

  lines.push('── 国内価格（送料込みの総額）───────────────────────')
  lines.push(`  最安:   ${yen(summary.lowestPriceJpy)}`)
  lines.push(`  中央値: ${yen(summary.medianPriceJpy)}`)
  lines.push(`  店舗数: ${summary.adoptedCount}`)
  lines.push('')

  if (summary.adopted.length > 0) {
    lines.push('── 採用した候補 ────────────────────────────────────')
    // ★「なぜ採用したのか」を必ず書き出す。★
    //   件数と価格だけでは、誤一致が混ざっていても気付けません。
    //   人が目で確かめられるように、一致した項目と未確認の項目を並べます。
    for (const offer of summary.adopted) {
      lines.push(
        `  ${yen(offer.totalPriceJpy)}  [${offer.matchGrade}] ${offer.sellerName ?? '出品者不明'}` +
          (offer.shippingJpy === 0 ? '（送料無料）' : ''),
      )
      lines.push(`      ${offer.title}`)
      lines.push(`      一致の手掛かり: ${offer.matchLevel}（信頼度 ${offer.matchConfidence.toFixed(2)}）`)
      for (const evidence of offer.positiveEvidence) {
        lines.push(`        ○ ${evidence}`)
      }
      for (const evidence of offer.negativeEvidence) {
        lines.push(`        × ${evidence}`)
      }
      if (offer.unknownAttributes.length > 0) {
        // ★未確認の項目は「一致」ではありません。必ず見えるようにします。★
        lines.push(`        ? 未確認: ${offer.unknownAttributes.join('・')}`)
      }
    }
    lines.push('')
  }

  const rejected = result.offers.filter((offer) => offer.rejectReasons.length > 0)
  if (rejected.length > 0) {
    lines.push('── 除外した候補 ────────────────────────────────────')
    for (const offer of rejected) {
      const codes = offer.rejectCodes.length > 0 ? ` [${offer.rejectCodes.join(', ')}]` : ''
      lines.push(`  ${yen(offer.priceJpy)}  ${offer.rejectReasons.join('・')}${codes}`)
      lines.push(`      ${offer.title}`)
    }
    lines.push('')
  }

  const review = result.offers.filter(
    (offer) => offer.rejectReasons.length === 0 && offer.reviewReasons.length > 0,
  )
  if (review.length > 0) {
    lines.push('── 要確認 ──────────────────────────────────────────')
    for (const offer of review) {
      lines.push(`  ${yen(offer.priceJpy)}  ${offer.reviewReasons.join('・')}`)
      lines.push(`      ${offer.title}`)
    }
    lines.push('')
  }

  return lines
}

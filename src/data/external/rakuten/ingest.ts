/**
 * 楽天検索の実行と、結果のまとめ。
 *
 *   Product
 *     ↓ RakutenQueryBuilder（強い手掛かりの順に検索条件を作る）
 *   検索（1件ずつ・間隔を空けて）
 *     ↓ validation
 *   RakutenRawItem
 *     ↓ RakutenAdapter ＋ ★共通の照合エンジン★
 *   DomesticOffer
 *     ↓
 *   Store / StoreListing / DomesticMatch / ShippingRule
 *
 * ★一度に大量の検索を投げないこと。★
 *   強い手掛かり（品番）で十分な候補が見つかったら、
 *   弱い手掛かり（属性検索）は実行しません。
 *   API利用量を抑えるためでもあり、誤一致を減らすためでもあります。
 */

import type { Product } from '@/domain/types'
import type { DomesticOffer } from '@/domain/domesticOffer'
import { countWouldBeAdopted, isAdoptableOffer } from '@/domain/domesticOffer'
import type { MatchContext } from '@/lib/matching/engine'
import type { IngestionIssue } from '../ingestionErrors'
import {
  buildRakutenSearchPlans,
  type RakutenQueryBuilderOptions,
  type RakutenSearchPlan,
} from './queryBuilder'
import {
  toDomesticOffers,
  toSakamonoModels,
  type RakutenNormalizedModels,
} from './normalize'
import { validateRakutenResponse } from './rawSchema'
import { rakutenSampleResponse } from './sampleResponse'
import type { RakutenRawItem, RakutenSearchResult } from './types'

/** 検索を実行するもの（本物のAPI / サンプル）。 */
export interface RakutenSearchExecutor {
  search(plan: RakutenSearchPlan): Promise<RakutenSearchResult>
}

/**
 * サンプル応答を返す実行器。
 *
 * ★外部への通信は一切しません。★
 *   認証情報が無くてもパイプラインを確かめられるようにするためのものです。
 */
export class SampleRakutenExecutor implements RakutenSearchExecutor {
  async search(plan: RakutenSearchPlan): Promise<RakutenSearchResult> {
    const fetchedAt = new Date().toISOString()
    const validation = validateRakutenResponse(rakutenSampleResponse, fetchedAt)

    return {
      requestParams: plan.params,
      level: plan.level,
      totalResultsAvailable: validation.totalResultsAvailable,
      totalResultsReturned: validation.totalResultsReturned,
      items: validation.items,
      fetchedAt,
      fromCache: false,
    }
  }
}

/* ------------------------------------------------------------
 * 実行
 * ---------------------------------------------------------- */

export interface RakutenIngestOptions {
  product: Product
  clubSlug: string
  clubName: string
  /**
   * 妥当な価格帯の目安（円）。
   * 極端に安い出品を「要確認」へ送るために使う。
   */
  referencePriceJpy?: number | null
  /**
   * サイズ（ProductVariant）ごとのJAN。
   * ★楽天はJANを返さないので、実際には使われません。★
   *   共通の照合エンジンへ同じ形で渡すために受け取っています。
   */
  variantJans?: readonly (string | null)[]
  /** 実行する検索の最大数。★API利用量を抑えるため既定は2。★ */
  maxSearches?: number
  /** 採用候補がこの件数に達したら、弱い手掛かりの検索を打ち切る。 */
  enoughAdopted?: number
  queryOptions?: RakutenQueryBuilderOptions
}

export interface RakutenIngestResult {
  product: Product
  /** 作られた検索条件（実行しなかったものを含む）。 */
  plans: RakutenSearchPlan[]
  /** 実際に実行した検索。 */
  searches: RakutenSearchResult[]
  /** 重複を除いた候補。 */
  offers: DomesticOffer[]
  models: RakutenNormalizedModels
  warnings: IngestionIssue[]
}

const DEFAULT_MAX_SEARCHES = 2
const DEFAULT_ENOUGH_ADOPTED = 3

/** 楽天検索を実行して、候補と変換結果を返す。 */
export async function runRakutenSearch(
  executor: RakutenSearchExecutor,
  options: RakutenIngestOptions,
): Promise<RakutenIngestResult> {
  const { product, clubSlug, clubName } = options

  const plans = buildRakutenSearchPlans(product, clubSlug, clubName, options.queryOptions)
  const maxSearches = options.maxSearches ?? DEFAULT_MAX_SEARCHES
  const enoughAdopted = options.enoughAdopted ?? DEFAULT_ENOUGH_ADOPTED

  const context: MatchContext = {
    product,
    clubSlug,
    referencePriceJpy: options.referencePriceJpy ?? null,
    variantJans: options.variantJans ?? [],
  }

  const searches: RakutenSearchResult[] = []
  const rawByKey = new Map<string, RakutenRawItem>()
  const warnings: IngestionIssue[] = []

  for (const plan of plans.slice(0, maxSearches)) {
    const result = await executor.search(plan)
    searches.push(result)

    for (const raw of result.items) {
      // 先に見つかった（＝より強い手掛かりの）ものを優先して残す
      const key = raw.externalId || raw.url
      if (!rawByKey.has(key)) rawByKey.set(key, raw)
    }

    // 十分な採用候補が見つかったら、弱い手掛かりの検索はしない
    const provisional = toDomesticOffers([...rawByKey.values()], context)
    if (provisional.filter((offer) => isAdoptableOffer(offer)).length >= enoughAdopted) break
  }

  /* ---- 候補の組み立て ---- */
  const items = [...rawByKey.values()]
  const offers = toDomesticOffers(items, context)

  /* ---- 送料の情報（総額を出せるかの判断に使う）---- */
  const postageByExternalId = new Map<string, RakutenRawItem['postageBasis']>(
    items.map((raw) => [raw.externalId, raw.postageBasis]),
  )
  const models = toSakamonoModels(product, offers, postageByExternalId)

  return { product, plans, searches, offers, models, warnings }
}

/* ------------------------------------------------------------
 * dry-run レポート
 * ---------------------------------------------------------- */

export function formatRakutenIngestReport(result: RakutenIngestResult): string[] {
  const { product, offers } = result
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
  lines.push('')

  lines.push('── 検索条件 ────────────────────────────────────────')
  if (result.plans.length === 0) {
    lines.push('  使える検索条件がありませんでした（手掛かり不足）')
  }
  result.plans.forEach((plan, index) => {
    const executed = index < result.searches.length ? '実行' : 'スキップ'
    lines.push(`  [${plan.level}] ${plan.description} … ${executed}`)
  })
  lines.push('  ※楽天の商品検索APIはJAN検索に対応していないため、JAN段階はありません')
  lines.push('')

  const accepted = offers.filter((offer) => isAdoptableOffer(offer))
  const rejected = offers.filter((offer) => offer.rejectReasons.length > 0)
  const review = offers.filter(
    (offer) => offer.rejectReasons.length === 0 && offer.reviewReasons.length > 0,
  )

  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 }
  for (const offer of offers) gradeCounts[offer.matchGrade] += 1

  lines.push('── 候補 ────────────────────────────────────────────')
  lines.push(`  楽天候補:       ${offers.length}件`)
  lines.push(`  重大不一致で除外: ${rejected.length}件`)
  lines.push(`  要確認:         ${review.length}件`)
  lines.push(
    `  ランク A:${gradeCounts.A}  B:${gradeCounts.B}  C:${gradeCounts.C}  D:${gradeCounts.D}`,
  )
  lines.push(`  自動採用:       ${accepted.length}件`)

  /* ---- ★方針を決めるための材料★ ---- */
  //   楽天の商品検索APIには新品／中古の項目がありません。
  //   そのため既定では、照合に通っていても「新品か確認できていない」
  //   として全件が自動採用から外れます。
  //   「商品名に中古を示す語が無いこと」を根拠にしてよいと決めた場合に
  //   何件増えるのかを出して、人が判断できるようにします。
  const wouldBeAdopted = countWouldBeAdopted(offers, { acceptTitleCheckedCondition: true })
  if (wouldBeAdopted > accepted.length) {
    lines.push('')
    lines.push('  ★新品／中古の扱いについて★')
    lines.push(
      '    楽天の商品検索APIには新品／中古の項目がありません。',
    )
    lines.push(
      '    そのため既定では「新品か確認できていない」として自動採用しません。',
    )
    lines.push(
      `    商品名に中古を示す語が無いことを根拠にしてよい場合: ${wouldBeAdopted}件が採用対象になります。`,
    )
    lines.push(
      '    ★これは推測です。出品者が書き忘れていれば中古が混ざります。★',
    )
  }
  lines.push('')

  if (accepted.length > 0) {
    lines.push('── 採用した候補 ────────────────────────────────────')
    for (const offer of [...accepted].sort(
      (a, b) => (a.totalPriceJpy ?? a.priceJpy) - (b.totalPriceJpy ?? b.priceJpy),
    )) {
      lines.push(
        `  ${yen(offer.totalPriceJpy ?? offer.priceJpy)}  [${offer.matchGrade}] ${offer.sellerName ?? 'ショップ不明'}` +
          (offer.totalPriceJpy === null ? '（★送料別・商品価格のみ★）' : '（送料込み）'),
      )
      lines.push(`      ${offer.title}`)
      lines.push(
        `      一致の手掛かり: ${offer.matchLevel}（信頼度 ${offer.matchConfidence.toFixed(2)}）`,
      )
      for (const evidence of offer.positiveEvidence) lines.push(`        ○ ${evidence}`)
      for (const evidence of offer.negativeEvidence) lines.push(`        × ${evidence}`)
      if (offer.unknownAttributes.length > 0) {
        lines.push(`        ? 未確認: ${offer.unknownAttributes.join('・')}`)
      }
      if (offer.rewardNote) lines.push(`        ＋ ${offer.rewardNote}`)
    }
    lines.push('')
  }

  if (rejected.length > 0) {
    lines.push('── 除外した候補 ────────────────────────────────────')
    for (const offer of rejected) {
      const codes = offer.rejectCodes.length > 0 ? ` [${offer.rejectCodes.join(', ')}]` : ''
      lines.push(`  ${yen(offer.priceJpy)}  ${offer.rejectReasons.join('・')}${codes}`)
      lines.push(`      ${offer.title}`)
    }
    lines.push('')
  }

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

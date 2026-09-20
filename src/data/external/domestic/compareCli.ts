/**
 * Yahoo! と楽天を横断した国内価格の確認コマンド。
 *
 *   npm run data:domestic:compare -- --product=<id> --sample
 *   npm run data:domestic:compare -- --product=<id> --dry-run
 *
 * ★書き出しはしません（確認専用）。★
 *   それぞれの取り込みは data:yahoo:search / data:rakuten:search が行います。
 *   ここは「両方を並べて、どちらが安いか・食い違いが無いか」を見るためのものです。
 *
 * ★片方の認証情報しか無くても動きます。★
 *   使えない提供元は「未設定」と表示して飛ばします。
 *   楽天の認証情報が無い段階でも、Yahoo!側はこれまでどおり確認できます。
 */

import { IngestionError, INGESTION_ERROR_LABEL_JA } from '../ingestionErrors'
import type { DomesticOffer } from '@/domain/domesticOffer'
import { isAdoptableOffer } from '@/domain/domesticOffer'
import { listProductViews } from '@/data/repository'

import { YahooShoppingClient, readYahooAppId } from '../yahoo/client'
import { SampleSearchExecutor, runYahooSearch } from '../yahoo/ingest'
import { RakutenIchibaClient, readRakutenCredentials } from '../rakuten/client'
import { SampleRakutenExecutor, runRakutenSearch } from '../rakuten/ingest'

import { PRICE_BASIS_LABEL_JA, aggregateDomesticOffers } from './aggregate'

export interface CompareCliOptions {
  productIds: string[]
  useSample: boolean
  noCache: boolean
  maxSearches: number
}

export function parseArgs(argv: string[]): CompareCliOptions {
  const options: CompareCliOptions = {
    productIds: [],
    useSample: false,
    noCache: false,
    maxSearches: 2,
  }

  for (const arg of argv) {
    if (arg === '--sample') {
      options.useSample = true
    } else if (arg === '--no-cache') {
      options.noCache = true
    } else if (arg === '--dry-run') {
      // 元から書き出さないので、指定されても何もしない（指示書29の互換のため受け付ける）
    } else if (arg.startsWith('--product=')) {
      const value = arg.slice('--product='.length).trim()
      if (value) {
        options.productIds.push(
          ...value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
        )
      }
    } else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(value) || value <= 0) {
        throw new IngestionError('unknown', `--limit は1以上の整数で指定してください: ${arg}`)
      }
      options.maxSearches = value
    } else if (arg === '--help' || arg === '-h') {
      console.log(
        [
          '国内価格の横断確認コマンド（Yahoo! + 楽天）',
          '',
          '  --product=<id>   対象のサカモノ商品ID（カンマ区切りで複数可）',
          '  --sample         保存済みのサンプル応答を使う（外部通信なし）',
          '  --limit=<n>      1商品・1提供元あたりの検索数（既定: 2）',
          '  --no-cache       キャッシュを使わない',
          '',
          '★書き出しは行いません。確認専用です。★',
        ].join('\n'),
      )
      process.exit(0)
    } else {
      throw new IngestionError('unknown', `知らないオプションです: ${arg}`)
    }
  }

  return options
}

const yen = (value: number | null): string =>
  value === null ? '—' : `¥${Math.round(value).toLocaleString('ja-JP')}`

export async function main(argv: string[]): Promise<number> {
  let options: CompareCliOptions
  try {
    options = parseArgs(argv)
  } catch (error) {
    if (error instanceof IngestionError) {
      console.error(`[${INGESTION_ERROR_LABEL_JA[error.kind]}] ${error.message}`)
      return 1
    }
    throw error
  }

  console.log('── 国内価格の横断確認（Yahoo! + 楽天）─────────────')

  const yahooAppId = readYahooAppId()
  const rakutenCredentials = readRakutenCredentials()

  // ★値そのものは絶対に出さない。設定されているかどうかだけ。★
  console.log(`  Yahoo!:  ${options.useSample ? 'サンプル' : yahooAppId ? '設定あり' : '未設定'}`)
  console.log(
    `  楽天:    ${options.useSample ? 'サンプル' : rakutenCredentials ? '設定あり' : '未設定'}`,
  )
  console.log('')

  const views = await listProductViews()
  const targets =
    options.productIds.length > 0
      ? views.filter((view) => options.productIds.includes(view.product.id))
      : views.slice(0, 1)

  if (targets.length === 0) {
    console.error('対象の商品が見つかりませんでした。--product=<商品ID> を確認してください。')
    return 1
  }

  for (const view of targets) {
    console.log('════════════════════════════════════════════════════')
    console.log(`  ${view.product.nameJa}`)
    console.log(`  ID: ${view.product.id}`)
    console.log('')

    const referencePriceJpy = view.overseas?.landedCost.productPriceJpy ?? null
    const variantJans = view.overseas?.variants.map((variant) => variant.jan) ?? []
    const allOffers: DomesticOffer[] = []

    /* ---- Yahoo! ---- */
    if (options.useSample || yahooAppId) {
      try {
        const result = await runYahooSearch(
          options.useSample
            ? new SampleSearchExecutor()
            : new YahooShoppingClient({ appId: yahooAppId as string, noCache: options.noCache }),
          {
            product: view.product,
            clubSlug: view.club.slug,
            clubName: view.club.name,
            referencePriceJpy,
            variantJans,
            maxSearches: options.maxSearches,
          },
        )
        allOffers.push(...result.offers)
      } catch (error) {
        const message =
          error instanceof IngestionError
            ? `[${INGESTION_ERROR_LABEL_JA[error.kind]}] ${error.message}`
            : String(error)
        console.log(`  Yahoo!: 取得できませんでした … ${message}`)
      }
    } else {
      console.log('  Yahoo!: 認証情報が未設定のため飛ばしました')
    }

    /* ---- 楽天 ---- */
    if (options.useSample || rakutenCredentials) {
      try {
        const result = await runRakutenSearch(
          options.useSample
            ? new SampleRakutenExecutor()
            : new RakutenIchibaClient({
                credentials: rakutenCredentials!,
                noCache: options.noCache,
              }),
          {
            product: view.product,
            clubSlug: view.club.slug,
            clubName: view.club.name,
            referencePriceJpy,
            variantJans,
            maxSearches: options.maxSearches,
          },
        )
        allOffers.push(...result.offers)
      } catch (error) {
        const message =
          error instanceof IngestionError
            ? `[${INGESTION_ERROR_LABEL_JA[error.kind]}] ${error.message}`
            : String(error)
        console.log(`  楽天: 取得できませんでした … ${message}`)
      }
    } else {
      console.log('  楽天: 認証情報が未設定のため飛ばしました')
    }

    /* ---- 集計 ---- */
    const aggregate = aggregateDomesticOffers(allOffers)

    for (const breakdown of aggregate.bySource) {
      console.log(`── ${breakdown.sourceLabel} ─────────────────────────`)
      console.log(`  candidates: ${breakdown.candidateCount}`)
      console.log(`  rejected:   ${breakdown.rejectedCount}`)
      console.log(`  review:     ${breakdown.reviewCount}`)
      console.log(`  accepted:   ${breakdown.acceptedCount}`)
      console.log(`  lowest（送料込み）:   ${yen(breakdown.lowestDeliveredJpy)}`)
      console.log(`  lowest（商品価格のみ）: ${yen(breakdown.lowestItemJpy)}`)
      console.log('')
    }

    if (aggregate.bySource.length === 0) {
      console.log('  どの提供元からも候補が得られませんでした。')
      console.log('')
      continue
    }

    console.log('── Combined ────────────────────────────────────────')
    if (aggregate.lowest) {
      console.log(
        `  lowest:     ${yen(aggregate.lowest.amountJpy)}  ${aggregate.lowest.sourceLabel}` +
          `（${PRICE_BASIS_LABEL_JA[aggregate.lowest.basis]}）`,
      )
      if (aggregate.lowest.basis === 'item-only') {
        console.log('    ★送料が分からないため「送料込み最安」ではありません。★')
      }
    } else {
      // ★0件を0円と書かない。★
      console.log('  lowest:     — （採用できた候補がありません）')
    }
    console.log(`  median:     ${yen(aggregate.medianDeliveredJpy)}（送料込みで比べられるもの）`)
    console.log(`  offerCount: ${aggregate.offerCount}`)
    if (aggregate.duplicateCount > 0) {
      console.log(`  重複を除外: ${aggregate.duplicateCount}件`)
    }
    console.log('')

    /* ---- 価格の食い違い（指示書33）---- */
    const acceptedBySource = new Map<string, DomesticOffer[]>()
    for (const offer of allOffers.filter((offer) => isAdoptableOffer(offer))) {
      const list = acceptedBySource.get(offer.source) ?? []
      list.push(offer)
      acceptedBySource.set(offer.source, list)
    }

    if (aggregate.priceOutliers.length > 0) {
      console.log('── ★価格が大きく外れている候補★ ───────────────────')
      console.log('  自動では除外していません。目視で確認してください。')
      for (const outlier of aggregate.priceOutliers) {
        console.log(
          `  ${yen(outlier.amountJpy)}（中央値の${Math.round(outlier.ratio * 100)}%）` +
            ` ${outlier.offer.sellerName ?? '出品者不明'}`,
        )
        console.log(`      ${outlier.offer.title}`)
        console.log(`      → ${outlier.reason}`)
      }
      console.log('')
    }
  }

  console.log('確認専用のため、ファイルへは書き出していません。')
  return 0
}

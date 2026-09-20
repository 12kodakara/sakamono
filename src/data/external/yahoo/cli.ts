/**
 * Yahoo!ショッピング検索コマンドの中身。
 *
 *   npm run data:yahoo:search -- --product=product-lfc-2526-home-replica --sample
 *   npm run data:yahoo:search -- --product=<id> --dry-run
 *   npm run data:yahoo:search -- --product=<id> --limit=1
 *
 * ★--dry-run では書き出しを行いません。★
 * ★APIキーが無くても --sample なら動きます（外部通信なし）。★
 * ★HTMLスクレイピングは行いません。公式APIのみ使用します。★
 */

import { IngestionError, INGESTION_ERROR_LABEL_JA, mustStopOnError } from '../ingestionErrors'
import { YahooShoppingClient, missingAppIdError, readYahooAppId } from './client'
import {
  SampleSearchExecutor,
  formatIngestReport,
  runYahooSearch,
  type YahooSearchExecutor,
} from './ingest'
import { listProductViews } from '@/data/repository'

const OUTPUT_DIR = 'normalized/yahoo'
const OUTPUT_FILE = `${OUTPUT_DIR}/latest.json`

/** 一度に検索してよい商品数の上限。★API利用量を抑えるため。★ */
/**
 * 1回のCLI実行で扱える商品の上限。
 *
 * ★大量取得をしないための歯止めです。★
 *   第4.5段階では、まず1件、問題が無ければ5件までにしていました。
 *   第4.6段階で照合の精度を測るため、種類の違う商品を並べて
 *   確かめる必要が出たので20件へ広げています。
 *   それ以上を一度に投げないでください。
 */
const MAX_TARGET_PRODUCTS = 20

export interface YahooCliOptions {
  productIds: string[]
  dryRun: boolean
  useSample: boolean
  noCache: boolean
  /** 1商品あたりに実行する検索の最大数。 */
  maxSearches: number
}

export function parseArgs(argv: string[]): YahooCliOptions {
  const options: YahooCliOptions = {
    productIds: [],
    dryRun: false,
    useSample: false,
    noCache: false,
    maxSearches: 2,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--sample') {
      options.useSample = true
    } else if (arg === '--no-cache') {
      options.noCache = true
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
      printHelp()
      process.exit(0)
    } else {
      throw new IngestionError('unknown', `知らないオプションです: ${arg}`)
    }
  }

  return options
}

function printHelp(): void {
  console.log(
    [
      'Yahoo!ショッピング 商品検索コマンド',
      '',
      '  --product=<id>    対象のサカモノ商品ID（カンマ区切りで複数可）',
      '  --sample          保存済みのサンプル応答を使う（外部通信なし・APIキー不要）',
      '  --limit=<n>       1商品あたりに実行する検索の最大数（既定: 2）',
      '  --dry-run         ファイルへ書き出さず、結果だけ表示する',
      '  --no-cache        キャッシュを使わない',
      '',
      '★一度に多くの商品を検索しないでください。まず1商品から始めます。★',
      '★HTMLスクレイピングは行いません。公式APIのみ使用します。★',
    ].join('\n'),
  )
}

/** ★APIキーそのものは出力しない。★ 設定の有無だけ示す。 */
function describeAuth(appId: string | null): string {
  return appId ? 'YAHOO_CLIENT_ID: 設定あり' : 'YAHOO_CLIENT_ID: 未設定'
}

export async function main(argv: string[]): Promise<number> {
  let options: YahooCliOptions
  try {
    options = parseArgs(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  console.log('── Yahoo!ショッピング 商品検索 ─────────────────────')

  const appId = readYahooAppId()
  console.log(`  ${describeAuth(appId)}`)

  let executor: YahooSearchExecutor
  if (options.useSample) {
    console.log('  モード: サンプル応答（外部通信は行いません）')
    console.log('  ⚠ 表示される商品名・価格・出品者はすべて架空のものです。')
    executor = new SampleSearchExecutor()
  } else {
    if (!appId) {
      const error = missingAppIdError()
      console.error(`\n[${INGESTION_ERROR_LABEL_JA[error.kind]}] ${error.message}`)
      return 1
    }
    console.log('  モード: 公式API（1.5秒以上の間隔をあけて、1件ずつ実行）')
    executor = new YahooShoppingClient({
      appId,
      noCache: options.noCache,
      onProgress: (message) => console.log(message),
    })
  }

  if (options.dryRun) console.log('  出力: dry-run（書き出しません）')
  console.log('')

  /* ---- 対象商品 ---- */
  const views = await listProductViews()
  const targets =
    options.productIds.length > 0
      ? views.filter((view) => options.productIds.includes(view.product.id))
      : views.slice(0, 1)

  if (targets.length === 0) {
    console.error('対象の商品が見つかりませんでした。--product=<商品ID> を確認してください。')
    console.error('利用できる商品ID:')
    views.slice(0, 10).forEach((view) => console.error(`  ${view.product.id}`))
    return 1
  }

  if (targets.length > MAX_TARGET_PRODUCTS) {
    console.error(
      `対象が${targets.length}件あります。まずは${MAX_TARGET_PRODUCTS}件以下で確認してください。`,
    )
    return 1
  }

  /* ---- 実行 ---- */
  const outputs: unknown[] = []

  for (const view of targets) {
    let result
    try {
      result = await runYahooSearch(executor, {
        product: view.product,
        clubSlug: view.club.slug,
        clubName: view.club.name,
        // 海外側の商品価格（円換算）を「相場の目安」に使う。
        // ★安いことを理由に信頼度を上げるためではなく、
        //   極端に安い出品を要確認へ送るために使う。★
        referencePriceJpy: view.overseas?.landedCost.productPriceJpy ?? null,
        // サイズごとのJANが分かっていれば、それも照合に使う
        variantJans: view.overseas?.variants.map((variant) => variant.jan) ?? [],
        maxSearches: options.maxSearches,
      })
    } catch (error) {
      if (error instanceof IngestionError) {
        console.error(`\n[${INGESTION_ERROR_LABEL_JA[error.kind]}] ${error.message}`)
        if (mustStopOnError(error.kind)) {
          console.error('\n★これ以上リクエストを続けないでください。★')
        }
        return 1
      }
      console.error(`\n[想定外のエラー] ${String(error)}`)
      return 1
    }

    formatIngestReport(result).forEach((line) => console.log(line))

    outputs.push({
      productId: view.product.id,
      offers: result.offers,
      stores: result.models.stores,
      listings: result.models.listings,
      matches: result.models.matches,
      shippingRules: result.models.shippingRules,
    })
  }

  /* ---- 書き出し ---- */
  if (options.dryRun) {
    console.log('dry-run のため、ファイルへは書き出していません。')
    return 0
  }

  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(
    OUTPUT_FILE,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        isSampleData: options.useSample,
        products: outputs,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`書き出しました: ${OUTPUT_FILE}`)
  console.log('')
  console.log('画面で確認するには、.env.local に次を書いて npm run dev を実行してください:')
  console.log('  SAKAMONO_DATA_SOURCE=fixture-yahoo')
  console.log('')
  console.log('★この状態のまま公開しないでください。★')
  console.log('  海外価格は開発用データのままで、国内価格だけが取得データです。')

  return 0
}

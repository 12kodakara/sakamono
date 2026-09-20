/**
 * 取り込みコマンドの中身。
 *
 * 実行方法（scripts/liverpool-ingest.mjs 経由）:
 *
 *   npm run data:liverpool:fetch -- --sample
 *   npm run data:liverpool:fetch -- --sample --limit=5
 *   npm run data:liverpool:fetch -- --sample --dry-run
 *   npm run data:liverpool:fetch -- --input=external/liverpool/raw.json
 *
 * ★--dry-run では書き出しを行わない。★
 *   取得状況だけ確かめたいときに、既存の正規化済みデータを壊さないため。
 */

import { INGESTION_ERROR_LABEL_JA, IngestionError, mustStopOnError } from './errors'
import { formatCoverage, runIngestion, type NormalizedLiverpoolFile } from './ingest'
import { FileRawSource, InMemoryRawSource, type LiverpoolRawSource } from './rawSource'
import { liverpoolSampleFeed } from './sampleRaw'
import { DEFAULT_CACHE_TTL_MS, readCache, writeCache } from './cache'
import type { LiverpoolRawFeed } from './types'

const DEFAULT_INPUT = 'external/liverpool/raw.json'
const OUTPUT_DIR = 'normalized/liverpool'
const OUTPUT_FILE = `${OUTPUT_DIR}/latest.json`
const CACHE_DIR = '.cache/liverpool'

export interface CliOptions {
  limit: number | null
  dryRun: boolean
  useSample: boolean
  inputPath: string
  noCache: boolean
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    limit: null,
    dryRun: false,
    useSample: false,
    inputPath: DEFAULT_INPUT,
    noCache: false,
  }

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true
    else if (arg === '--sample') options.useSample = true
    else if (arg === '--no-cache') options.noCache = true
    else if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length))
      if (!Number.isInteger(value) || value <= 0) {
        throw new IngestionError('unknown', `--limit は1以上の整数で指定してください: ${arg}`)
      }
      options.limit = value
    } else if (arg.startsWith('--input=')) {
      options.inputPath = arg.slice('--input='.length)
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
      'Liverpool 取り込みコマンド',
      '',
      '  --sample          サカモノが用意した架空のサンプルデータを使う',
      '  --input=<path>    生データのJSONファイルを指定する（既定: ' + DEFAULT_INPUT + '）',
      '  --limit=<n>       取り込む最大件数',
      '  --dry-run         ファイルへ書き出さず、集計だけ表示する',
      '  --no-cache        キャッシュを使わない',
      '',
      '★ 公式サイトへ自動アクセスする機能はありません。',
      '   利用規約の確認結果は docs/data-sources/liverpool.md を参照してください。',
    ].join('\n'),
  )
}

/** 取得元をキャッシュで包む。 */
function withCache(source: LiverpoolRawSource, disabled: boolean): LiverpoolRawSource {
  return {
    description: `${source.description}（キャッシュ${disabled ? '無効' : '有効'}）`,
    async load(): Promise<LiverpoolRawFeed> {
      const key = source.description
      const cached = await readCache<LiverpoolRawFeed>(key, {
        directory: CACHE_DIR,
        ttlMs: DEFAULT_CACHE_TTL_MS,
        disabled,
      })
      if (cached) {
        console.log('  キャッシュを使用しました（--no-cache で無効化できます）')
        return cached
      }

      const feed = await source.load()
      await writeCache(key, feed, source.description, {
        directory: CACHE_DIR,
        ttlMs: DEFAULT_CACHE_TTL_MS,
        disabled,
      })
      return feed
    },
  }
}

function buildSource(options: CliOptions): LiverpoolRawSource {
  if (options.useSample) {
    return new InMemoryRawSource(
      liverpoolSampleFeed,
      'サンプル（架空データ。公式ストアから取得したものではありません）',
    )
  }
  return new FileRawSource(options.inputPath)
}

async function writeOutput(file: NormalizedLiverpoolFile): Promise<void> {
  const { mkdir, writeFile } = await import('node:fs/promises')
  await mkdir(OUTPUT_DIR, { recursive: true })
  await writeFile(OUTPUT_FILE, `${JSON.stringify(file, null, 2)}\n`, 'utf8')
}

export async function main(argv: string[]): Promise<number> {
  let options: CliOptions
  try {
    options = parseArgs(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  console.log('── Liverpool 取り込み ──────────────────────────────')

  const source = withCache(buildSource(options), options.noCache || options.useSample)
  console.log(`  取得元: ${source.description}`)
  if (options.limit) console.log(`  上限:   ${options.limit}件`)
  if (options.dryRun) console.log('  モード: dry-run（書き出しません）')

  let result
  try {
    result = await runIngestion(source, { limit: options.limit ?? undefined })
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

  console.log('')
  console.log(`  入手経路: ${result.feed.origin}`)
  console.log(`  入手元:   ${result.feed.sourceNote}`)
  if (result.file.isSampleData) {
    console.log('  ⚠ これは架空のサンプルデータです。実在の商品・価格ではありません。')
  }

  console.log('')
  console.log('── 件数 ────────────────────────────────────────────')
  console.log(`  取得商品数: ${result.fetchedCount}`)
  console.log(`  正常:       ${result.validCount}`)
  console.log(`  エラー:     ${result.rejectedCount}（本番モデルへ流していません）`)
  console.log(`  警告:       ${result.warnings.length}`)
  console.log(`  生成: 商品 ${result.normalized.products.length} / 掲載 ${result.normalized.listings.length} / バリエーション ${result.normalized.variants.length} / 価格履歴 ${result.normalized.snapshots.length}`)

  console.log('')
  console.log('── 取得状況 ────────────────────────────────────────')
  formatCoverage(result.coverage).forEach((line) => console.log(line))

  if (result.errors.length > 0) {
    console.log('')
    console.log('── エラー ──────────────────────────────────────────')
    for (const issue of result.errors.slice(0, 20)) {
      console.log(`  [${INGESTION_ERROR_LABEL_JA[issue.kind]}] ${issue.message}`)
      if (issue.productRef) console.log(`      ${issue.productRef}`)
    }
    if (result.errors.length > 20) console.log(`  ... 他 ${result.errors.length - 20} 件`)
  }

  if (result.warnings.length > 0) {
    console.log('')
    console.log('── 警告（取り込みは継続）───────────────────────────')
    for (const issue of result.warnings.slice(0, 20)) {
      console.log(`  [${INGESTION_ERROR_LABEL_JA[issue.kind]}] ${issue.message}`)
      if (issue.productRef) console.log(`      ${issue.productRef}`)
    }
    if (result.warnings.length > 20) console.log(`  ... 他 ${result.warnings.length - 20} 件`)
  }

  console.log('')
  if (options.dryRun) {
    console.log('dry-run のため、ファイルへは書き出していません。')
  } else {
    await writeOutput(result.file)
    console.log(`書き出しました: ${OUTPUT_FILE}`)
    console.log('')
    console.log('画面で確認するには、.env.local に次を書いて npm run dev を実行してください:')
    console.log('  SAKAMONO_DATA_SOURCE=liverpool')
    console.log('')
    console.log('★このデータのまま公開しないでください（第3段階はローカル検証のみ）。★')
  }

  return 0
}

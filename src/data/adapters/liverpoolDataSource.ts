/**
 * Liverpool 実データ用のデータ取得層。
 *
 *   normalized/liverpool/latest.json（取り込みコマンドが作る）
 *        ↓
 *   LiverpoolDataSource
 *        ↓
 *   既存の repository → 価格計算エンジン → 画面（すべて変更なし）
 *
 * ★開発用 fixture とは完全に別物として扱う。★
 *   fixtureAdapter は残したまま、環境変数で切り替えます。
 *   取り込みに失敗しても、fixture 側でサイト開発は続けられます。
 *
 * ★第3段階ではローカル検証専用です。★
 *   meta.publishable を false にしてあり、画面には
 *   「この内容のまま公開しないでください」という帯が出ます。
 */

import type {
  Club,
  DomesticMatch,
  ExchangeRate,
  ImportCostRule,
  League,
  PriceSnapshot,
  Product,
  ProductVariant,
  ShippingRule,
  Store,
  StoreListing,
} from '@/domain/types'
import { exchangeRateFixtures } from '@/data/fixtures/exchangeRates'
import { importCostRuleFixtures } from '@/data/fixtures/importCostRules'
import { LIVERPOOL_CLUB_ID, LIVERPOOL_STORE_ID } from '@/data/external/liverpool/normalize'
import type { NormalizedLiverpoolFile } from '@/data/external/liverpool/ingest'
import type { DataSourceMeta, SakamonoDataSource } from './types'

const NORMALIZED_PATH = 'normalized/liverpool/latest.json'

/* ------------------------------------------------------------
 * 基礎データ
 *
 * リーグ名・クラブ名・公式ストアURLは、取得したデータではなく
 * 公開されている事実です。取り込み結果とは別にここで定義します。
 * ---------------------------------------------------------- */

const league: League = {
  id: 'league-premier-league',
  slug: 'premier-league',
  name: 'Premier League',
  nameJa: 'プレミアリーグ',
  country: 'イングランド',
  displayOrder: 1,
  active: true,
}

const club: Club = {
  id: LIVERPOOL_CLUB_ID,
  leagueId: league.id,
  slug: 'liverpool',
  name: 'Liverpool FC',
  nameJa: 'リヴァプール',
  country: 'イングランド',
  officialStoreUrl: 'https://store.liverpoolfc.com/',
  displayOrder: 1,
  active: true,
}

const store: Store = {
  id: LIVERPOOL_STORE_ID,
  slug: 'liverpool-official-store',
  name: 'Liverpool FC Official Store',
  type: 'official',
  // 取り込んだ掲載ごとの通貨を使うため、ここは代表値
  currency: 'GBP',
  country: 'イギリス',
  japanShippingAvailable: true,
  shippingType: 'direct',
  affiliateAvailable: true,
  active: true,
}

/**
 * 送料の決まり。
 *
 * ★★ 日本向けの送料を確認できていないため 'unknown' にしています。★★
 *
 *   根拠のない固定送料を置くと、実際より安い「日本到着推定額」を
 *   出してしまいます（第2段階で作った「不明を0円にしない」仕組みの出番です）。
 *
 *   結果として、画面では
 *     「国際送料を除く参考額」
 *   と表示され、日本到着推定額は算出されません。これは正しい挙動です。
 *
 *   送料の根拠が得られたら、type を 'fixed' / 'threshold' / 'estimated' へ
 *   変えるだけで、表示は自動的に切り替わります。
 */
const shippingRules: ShippingRule[] = [
  {
    id: 'ship-lfc-official-jp-unknown',
    storeId: LIVERPOOL_STORE_ID,
    destinationCountry: 'JP',
    type: 'unknown',
    currency: 'GBP',
    note: '日本向けの送料を確認できていないため、日本到着推定額は算出できません。',
    source: 'docs/data-sources/liverpool.md 第8章',
  },
]

/* ------------------------------------------------------------
 * 正規化済みデータの読み込み
 * ---------------------------------------------------------- */

let cache: Promise<NormalizedLiverpoolFile> | null = null

async function loadNormalized(): Promise<NormalizedLiverpoolFile> {
  if (cache) return cache

  cache = (async () => {
    const { readFile } = await import('node:fs/promises')
    let text: string
    try {
      text = await readFile(NORMALIZED_PATH, 'utf8')
    } catch {
      throw new Error(
        [
          `Liverpool の正規化済みデータが見つかりません: ${NORMALIZED_PATH}`,
          '',
          '先に取り込みコマンドを実行してください:',
          '  npm run data:liverpool:fetch -- --sample',
          '',
          'fixture へ戻す場合は .env.local を SAKAMONO_DATA_SOURCE=fixture にしてください。',
        ].join('\n'),
      )
    }

    try {
      return JSON.parse(text) as NormalizedLiverpoolFile
    } catch (error) {
      throw new Error(`${NORMALIZED_PATH} のJSONを読めませんでした: ${String(error)}`)
    }
  })()

  return cache
}

/* ------------------------------------------------------------
 * データ取得層
 * ---------------------------------------------------------- */

/**
 * meta は読み込み後に確定するため、既定値を置いてから上書きする。
 * （isSampleData は取り込んだデータの origin で決まる）
 */
const meta: DataSourceMeta = {
  kind: 'liverpool',
  isSampleData: true,
  publishable: false,
  generatedAt: new Date(0).toISOString(),
  label: 'Liverpool 実データ（ローカル検証専用）',
}

export const liverpoolDataSource: SakamonoDataSource = {
  meta,

  async getLeagues(): Promise<League[]> {
    // 読み込み時に meta を実際の値へそろえる（最初に呼ばれるのがここ）
    const file = await loadNormalized()
    meta.isSampleData = file.isSampleData
    meta.generatedAt = file.generatedAt
    meta.label = file.isSampleData
      ? 'Liverpool 取り込みパイプラインのサンプル（架空データ・ローカル検証専用）'
      : `Liverpool 実データ（${file.sourceNote}・ローカル検証専用）`
    return [league]
  },

  async getClubs(): Promise<Club[]> {
    return [club]
  },

  async getStores(): Promise<Store[]> {
    return [store]
  },

  async getProducts(): Promise<Product[]> {
    return (await loadNormalized()).products
  },

  async getListings(): Promise<StoreListing[]> {
    return (await loadNormalized()).listings
  },

  async getPriceSnapshots(): Promise<PriceSnapshot[]> {
    return (await loadNormalized()).snapshots
  },

  async getDomesticMatches(): Promise<DomesticMatch[]> {
    // 国内価格の取得は第4段階。まだ比較対象は無い。
    return []
  },

  async getExchangeRates(): Promise<ExchangeRate[]> {
    // 為替APIは未接続のため、開発用の想定レートを使う。
    // kind: 'development-fixture' が入っているので、画面にもその旨が出る。
    return exchangeRateFixtures
  },

  async getShippingRules(): Promise<ShippingRule[]> {
    return shippingRules
  },

  async getImportCostRules(): Promise<ImportCostRule[]> {
    return importCostRuleFixtures
  },

  async getVariants(): Promise<ProductVariant[]> {
    return (await loadNormalized()).variants
  },
}

/** テスト用にキャッシュを捨てる。 */
export function resetLiverpoolDataSourceCache(): void {
  cache = null
}

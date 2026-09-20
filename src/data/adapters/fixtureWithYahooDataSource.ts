/**
 * 開発用fixture（海外価格）＋ Yahoo!取得データ（国内価格）を混ぜたデータ取得層。
 *
 * ══════════════════════════════════════════════════════════
 * ★★ これは「混ざっている」状態です ★★
 *
 *   海外価格 … 開発用のサンプルデータ（架空の価格）
 *   国内価格 … Yahoo!ショッピングから取得したデータ
 *
 *   実データと開発用データを同じものとして見せてはいけないので、
 *   Store.dataOrigin でどちらかを区別できるようにし、
 *   画面には両方の素性を表示します。
 *
 *   ★この状態のまま公開しないでください。★
 *   meta.publishable を false にしてあり、画面上部に帯が出ます。
 * ══════════════════════════════════════════════════════════
 *
 * 第3段階の liverpoolDataSource と同じく、fixture は消しません。
 * 取得に失敗しても fixture だけでサイト開発を続けられます。
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
import { fixtureAdapter } from './fixtureAdapter'
import type { DataSourceMeta, SakamonoDataSource } from './types'

const NORMALIZED_PATH = 'normalized/yahoo/latest.json'

/** 取り込みコマンドが書き出すファイルの形。 */
interface YahooNormalizedFile {
  generatedAt: string
  isSampleData: boolean
  products: Array<{
    productId: string
    stores: Store[]
    listings: StoreListing[]
    matches: DomesticMatch[]
    shippingRules: ShippingRule[]
  }>
}

const EMPTY: YahooNormalizedFile = { generatedAt: '', isSampleData: true, products: [] }

let cache: Promise<YahooNormalizedFile> | null = null

/**
 * 取得済みデータを読む。
 *
 * ★ファイルが無くても落とさない。★
 *   国内データが無いだけで、海外側（fixture）は問題なく表示できます。
 *   「国内価格を確認できませんでした」と出るのが正しい挙動です。
 */
async function loadYahoo(): Promise<YahooNormalizedFile> {
  if (cache) return cache

  cache = (async () => {
    const { readFile } = await import('node:fs/promises')
    try {
      const text = await readFile(NORMALIZED_PATH, 'utf8')
      return JSON.parse(text) as YahooNormalizedFile
    } catch {
      return EMPTY
    }
  })()

  return cache
}

/* ------------------------------------------------------------
 * データ取得層
 * ---------------------------------------------------------- */

const meta: DataSourceMeta = {
  kind: 'fixture-yahoo',
  // 海外価格が開発用のサンプルなので true のまま
  isSampleData: true,
  publishable: false,
  generatedAt: new Date(0).toISOString(),
  label: '海外価格＝開発用データ ／ 国内価格＝Yahoo!ショッピング取得データ',
}

export const fixtureWithYahooDataSource: SakamonoDataSource = {
  meta,

  async getLeagues(): Promise<League[]> {
    const file = await loadYahoo()
    meta.generatedAt = file.generatedAt || new Date(0).toISOString()
    meta.label = file.isSampleData
      ? '海外価格＝開発用データ ／ 国内価格＝Yahoo!パイプラインのサンプル応答（いずれも架空）'
      : '海外価格＝開発用データ ／ 国内価格＝Yahoo!ショッピング取得データ'
    return fixtureAdapter.getLeagues()
  },

  getClubs(): Promise<Club[]> {
    return fixtureAdapter.getClubs()
  },

  async getStores(): Promise<Store[]> {
    const [base, file] = await Promise.all([fixtureAdapter.getStores(), loadYahoo()])
    return [...base, ...file.products.flatMap((entry) => entry.stores)]
  },

  getProducts(): Promise<Product[]> {
    return fixtureAdapter.getProducts()
  },

  async getListings(): Promise<StoreListing[]> {
    const [base, file] = await Promise.all([fixtureAdapter.getListings(), loadYahoo()])
    return [...base, ...file.products.flatMap((entry) => entry.listings)]
  },

  getPriceSnapshots(): Promise<PriceSnapshot[]> {
    return fixtureAdapter.getPriceSnapshots()
  },

  async getDomesticMatches(): Promise<DomesticMatch[]> {
    const [base, file] = await Promise.all([fixtureAdapter.getDomesticMatches(), loadYahoo()])
    return [...base, ...file.products.flatMap((entry) => entry.matches)]
  },

  getExchangeRates(): Promise<ExchangeRate[]> {
    return fixtureAdapter.getExchangeRates()
  },

  async getShippingRules(): Promise<ShippingRule[]> {
    const [base, file] = await Promise.all([fixtureAdapter.getShippingRules(), loadYahoo()])
    return [...base, ...file.products.flatMap((entry) => entry.shippingRules)]
  },

  getImportCostRules(): Promise<ImportCostRule[]> {
    return fixtureAdapter.getImportCostRules()
  },

  getVariants(): Promise<ProductVariant[]> {
    return fixtureAdapter.getVariants()
  },
}

/** テスト用にキャッシュを捨てる。 */
export function resetYahooDataSourceCache(): void {
  cache = null
}

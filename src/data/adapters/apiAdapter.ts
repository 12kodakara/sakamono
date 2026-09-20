/**
 * 外部APIから取得するアダプタ。
 *
 * ★★★ ここが第2段階の作業場所です。★★★
 *
 * 第1段階では中身を実装しません。
 * 「未実装である」ことをはっきりさせるため、呼ばれたら例外を投げます。
 * ダミーの値をそれらしく返してしまうと、本物のデータだと勘違いする事故につながるためです。
 *
 * 第2段階で実装するときの想定:
 *
 *   海外公式ストア → 商品取得 → 商品正規化 → 国内API → 価格比較 → 画面表示
 *
 *   1. 取得    : ストアごとの取得処理を src/data/sources/<store>.ts に置く
 *   2. 正規化  : 取得結果を Product / StoreListing の形へ変換する
 *   3. 国内検索: 楽天・Yahoo! などのAPIで国内の掲載を探す
 *   4. 照合    : src/lib/matching/engine.ts で confidence を算出し DomesticMatch を作る
 *   5. 保存    : 結果をJSONとして書き出し、このアダプタがそれを読む
 *
 *   静的サイトとして公開するため、取得はビルド時（またはバッチ）に行い、
 *   ブラウザから直接外部APIを叩かない方針です。
 *   APIキーは .env.local から読み、NEXT_PUBLIC_ を付けない変数名にしてください
 *   （NEXT_PUBLIC_ を付けるとブラウザへ露出します）。
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
import type { DataSourceMeta, SakamonoDataSource } from './types'

const meta: DataSourceMeta = {
  kind: 'api',
  isSampleData: false,
  publishable: true,
  generatedAt: '',
  label: '外部データ（未実装）',
}

function notImplemented(method: string): never {
  throw new Error(
    [
      `apiAdapter.${method}() はまだ実装されていません（第2段階の作業対象）。`,
      'SAKAMONO_DATA_SOURCE=fixture に戻すか、src/data/adapters/apiAdapter.ts を実装してください。',
    ].join('\n'),
  )
}

export const apiAdapter: SakamonoDataSource = {
  meta,
  async getLeagues(): Promise<League[]> {
    notImplemented('getLeagues')
  },
  async getClubs(): Promise<Club[]> {
    notImplemented('getClubs')
  },
  async getStores(): Promise<Store[]> {
    notImplemented('getStores')
  },
  async getProducts(): Promise<Product[]> {
    notImplemented('getProducts')
  },
  async getListings(): Promise<StoreListing[]> {
    notImplemented('getListings')
  },
  async getPriceSnapshots(): Promise<PriceSnapshot[]> {
    notImplemented('getPriceSnapshots')
  },
  async getDomesticMatches(): Promise<DomesticMatch[]> {
    notImplemented('getDomesticMatches')
  },
  async getExchangeRates(): Promise<ExchangeRate[]> {
    notImplemented('getExchangeRates')
  },
  async getShippingRules(): Promise<ShippingRule[]> {
    notImplemented('getShippingRules')
  },
  async getImportCostRules(): Promise<ImportCostRule[]> {
    notImplemented('getImportCostRules')
  },
  async getVariants(): Promise<ProductVariant[]> {
    notImplemented('getVariants')
  },
}

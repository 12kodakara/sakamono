/**
 * fixture（サンプルデータ）から読み込むアダプタ。第1段階の既定値。
 *
 * ここでは「無効なデータを画面へ渡さない」ことだけを行い、
 * 計算や並び替えは repository.ts 側で行います。
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
import {
  clubFixtures,
  exchangeRateFixtures,
  importCostRuleFixtures,
  shippingRuleFixtures,
  domesticMatchFixtures,
  leagueFixtures,
  listingFixtures,
  priceSnapshotFixtures,
  productFixtures,
  storeFixtures,
} from '@/data/fixtures'
import type { DataSourceMeta, SakamonoDataSource } from './types'

const meta: DataSourceMeta = {
  kind: 'fixture',
  isSampleData: true,
  // サンプル価格なので公開してはいけない
  publishable: false,
  generatedAt: '2026-09-18T09:00:00.000Z',
  label: 'サンプルデータ（開発用）',
}

export const fixtureAdapter: SakamonoDataSource = {
  meta,

  async getLeagues(): Promise<League[]> {
    return leagueFixtures.filter((league) => league.active)
  },

  async getClubs(): Promise<Club[]> {
    return clubFixtures.filter((club) => club.active)
  },

  async getStores(): Promise<Store[]> {
    return storeFixtures.filter((store) => store.active)
  },

  async getProducts(): Promise<Product[]> {
    return productFixtures.filter((product) => product.active)
  },

  async getListings(): Promise<StoreListing[]> {
    return listingFixtures
  },

  async getPriceSnapshots(): Promise<PriceSnapshot[]> {
    return priceSnapshotFixtures
  },

  async getDomesticMatches(): Promise<DomesticMatch[]> {
    return domesticMatchFixtures
  },

  async getExchangeRates(): Promise<ExchangeRate[]> {
    return exchangeRateFixtures
  },

  async getShippingRules(): Promise<ShippingRule[]> {
    return shippingRuleFixtures
  },

  async getImportCostRules(): Promise<ImportCostRule[]> {
    return importCostRuleFixtures
  },

  async getVariants(): Promise<ProductVariant[]> {
    // 開発用fixtureはサイズ違いを扱っていない。
    return []
  },
}

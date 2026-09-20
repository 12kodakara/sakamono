/**
 * fixture データのまとめ。
 *
 * ★ここから下はすべて開発用のサンプルデータです。★
 *
 * 画面（src/app, src/components）からこのファイルを直接 import しないでください。
 * 必ず src/data/repository.ts 経由で取得します。
 * そうしておくことで、第2段階でデータの出どころを外部APIへ変えても
 * 画面側のコードを書き換えずに済みます。
 */

export { leagueFixtures } from './leagues'
export { clubFixtures } from './clubs'
export { storeFixtures } from './stores'
export { productFixtures } from './products'
export { listingFixtures } from './listings'
export { priceSnapshotFixtures } from './snapshots'
export { domesticMatchFixtures } from './matches'
// --- 第2段階で追加 ---
export { exchangeRateFixtures } from './exchangeRates'
export { shippingRuleFixtures } from './shippingRules'
export { importCostRuleFixtures } from './importCostRules'

import type { Dataset } from '@/domain/validation'
import { clubFixtures } from './clubs'
import { domesticMatchFixtures } from './matches'
import { leagueFixtures } from './leagues'
import { listingFixtures } from './listings'
import { productFixtures } from './products'
import { storeFixtures } from './stores'
import { exchangeRateFixtures } from './exchangeRates'
import { shippingRuleFixtures } from './shippingRules'
import { importCostRuleFixtures } from './importCostRules'

/** 検証（validateDataset）へそのまま渡せる形のデータセット。 */
export const fixtureDataset: Dataset = {
  leagues: leagueFixtures,
  clubs: clubFixtures,
  stores: storeFixtures,
  products: productFixtures,
  listings: listingFixtures,
  matches: domesticMatchFixtures,
  exchangeRates: exchangeRateFixtures,
  shippingRules: shippingRuleFixtures,
  importCostRules: importCostRuleFixtures,
  // 開発用fixtureはサイズ違いを扱っていないため空。
  // 第3段階の実データ取り込みではここへバリエーションが入る。
  variants: [],
}

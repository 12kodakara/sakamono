/**
 * 為替レートの fixture データ。
 *
 * ★★★ これは開発用の固定値です。実勢レートではありません。★★★
 *
 * 第2段階では為替APIへ接続しません。
 * 「画面に出ているレートが本物のレートだ」と誤解されないよう、
 *   - kind: 'development-fixture'
 *   - source に開発用である旨の文字列
 * を必ず入れています。
 *
 * 画面側はこの kind を見て「開発用の想定値」と明示します
 * （src/components/product/LandedCostTable.tsx）。
 *
 * 第3段階で為替APIへ接続したら、kind: 'live' のデータへ置き換えます。
 */

import type { ExchangeRate } from '@/domain/types'
import { FX_RATES_JPY } from '@/lib/pricing/config'

/** fixture のレートを取得したことにしている日時。 */
const FETCHED_AT = '2026-09-01T00:00:00.000Z'

const SOURCE = 'サカモノ開発用の固定値（実勢レートではありません）'

export const exchangeRateFixtures: ExchangeRate[] = [
  {
    baseCurrency: 'GBP',
    quoteCurrency: 'JPY',
    rate: FX_RATES_JPY.GBP,
    fetchedAt: FETCHED_AT,
    source: SOURCE,
    kind: 'development-fixture',
  },
  {
    baseCurrency: 'EUR',
    quoteCurrency: 'JPY',
    rate: FX_RATES_JPY.EUR,
    fetchedAt: FETCHED_AT,
    source: SOURCE,
    kind: 'development-fixture',
  },
  {
    baseCurrency: 'USD',
    quoteCurrency: 'JPY',
    rate: FX_RATES_JPY.USD,
    fetchedAt: FETCHED_AT,
    source: SOURCE,
    kind: 'development-fixture',
  },
  // JPY は換算しないのでレートを持たない（円→円はそのまま扱う）。
]

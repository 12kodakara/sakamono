/**
 * 輸入コストの決まり（ImportCostRule）の fixture データ。
 *
 * ★★★ ここにあるのは「確定税額」ではなく「見積りの前提」です。★★★
 *
 * サカモノは税関ではないため、関税・輸入消費税の確定額は出せません。
 * そこで、
 *   「どういう前提で見積もるか」
 * をデータとして持ち、計算処理（src/domain/services/importCost.ts）は
 * その前提どおりに足し算をするだけにしています。
 *
 * 前提を変えたいときは、コードではなくこのファイルを直します。
 *
 * ■ 適用の優先順位（services/importCost.ts の findImportCostRule）
 *     1. ストアとカテゴリの両方が一致
 *     2. ストアが一致（カテゴリは any）
 *     3. カテゴリが一致（ストアは any）
 *     4. どちらも any
 *
 *   国内ストアは 2 で「かからない（not-applicable）」に当たるため、
 *   3 のカテゴリ別ルールより先に判定されます。
 */

import type { ImportCostRule } from '@/domain/types'
import { ALL_PRODUCT_CATEGORIES, buildSimplifiedImportParameters } from '@/lib/pricing/config'

const UPDATED_AT = '2026-09-18T09:00:00.000Z'
const SOURCE = 'サンプル（開発用の前提値）'

/** 国内ストアの一覧。国内購入なので輸入コストはかからない。 */
const DOMESTIC_STORE_IDS = ['store-jp-sample-a', 'store-jp-sample-b', 'store-jp-marketplace-c']

/** 国内ストア用: 輸入コストはかからない。 */
const domesticRules: ImportCostRule[] = DOMESTIC_STORE_IDS.map((storeId) => ({
  id: `import-${storeId}`,
  storeId,
  category: 'any',
  destinationCountry: 'JP',
  method: 'not-applicable',
  note: '国内での購入のため、関税・輸入消費税はかかりません。',
  updatedAt: UPDATED_AT,
  source: SOURCE,
}))

/**
 * 海外ストア共通: カテゴリごとの簡易計算。
 *
 * カテゴリによって関税率の目安が違うため、カテゴリ単位で前提値を持つ。
 * 前提値そのものは src/lib/pricing/config.ts から取得しており、
 * 数値をこのファイルへ書き写してはいない。
 */
const overseasRules: ImportCostRule[] = ALL_PRODUCT_CATEGORIES.map((category) => ({
  id: `import-any-${category}`,
  storeId: 'any',
  category,
  destinationCountry: 'JP',
  method: 'simplified-personal-import',
  parameters: buildSimplifiedImportParameters(category),
  note: '個人輸入の簡易計算による推定です。実際の税額は税関の判断で変わります。',
  updatedAt: UPDATED_AT,
  source: SOURCE,
}))

export const importCostRuleFixtures: ImportCostRule[] = [...domesticRules, ...overseasRules]

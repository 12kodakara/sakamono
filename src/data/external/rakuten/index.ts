/**
 * 楽天市場 商品検索の取り込みパイプライン。
 *
 *   Product → QueryBuilder → 公式API → validation → RakutenAdapter
 *           → DomesticOffer → ★共通の照合エンジン★ → DomesticMatch → 価格比較
 *
 * ★公式APIのみ使用します。★
 *   楽天市場の商品ページや検索結果ページのHTMLスクレイピング、
 *   非公開APIの利用はしません。
 */

export type {
  RakutenApiItem,
  RakutenApiResponse,
  RakutenRawItem,
  RakutenSearchLevel,
  RakutenSearchResult,
} from './types'

export {
  normalizeRakutenUrl,
  validateRakutenItem,
  validateRakutenResponse,
  type RakutenResponseValidationResult,
  type RakutenValidationResult,
} from './rawSchema'

export {
  MAX_HITS,
  buildRakutenAttributeQuery,
  buildRakutenSearchPlans,
  isUsableKeyword,
  type RakutenQueryBuilderOptions,
  type RakutenSearchPlan,
} from './queryBuilder'

export {
  MAX_RETRIES,
  MIN_REQUEST_INTERVAL_MS,
  RAKUTEN_CACHE_DIR,
  RAKUTEN_ITEM_SEARCH_ENDPOINT,
  REQUEST_TIMEOUT_MS,
  RakutenIchibaClient,
  describeMissingCredentials,
  missingCredentialsError,
  readRakutenCredentials,
  redactCredentials,
  type RakutenClientOptions,
  type RakutenCredentials,
  type RakutenEnv,
} from './client'

export {
  buildShippingRuleFromPostage,
  describePointReward,
  describeTaxBasis,
  readRakutenShippingJpy,
  toDomesticOffer,
  toDomesticOffers,
  toSakamonoModels,
  type RakutenNormalizedModels,
} from './normalize'

export {
  SampleRakutenExecutor,
  formatRakutenIngestReport,
  runRakutenSearch,
  type RakutenIngestOptions,
  type RakutenIngestResult,
  type RakutenSearchExecutor,
} from './ingest'

export { SAMPLE_TARGET_SKU, rakutenSampleResponse } from './sampleResponse'

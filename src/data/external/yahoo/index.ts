/**
 * Yahoo!ショッピング 商品検索の取り込みパイプライン。
 *
 *   Product → QueryBuilder → 公式API → validation → YahooAdapter
 *           → DomesticOffer → 照合 → DomesticMatch → 価格比較
 *
 * ★公式APIのみ使用します。★
 *   検索結果ページのHTMLスクレイピングや、非公開APIの利用はしません。
 */

export type {
  YahooApiHit,
  YahooApiResponse,
  YahooRawProduct,
  YahooSearchResult,
} from './types'

export {
  normalizeYahooUrl,
  validateYahooHit,
  validateYahooResponse,
  type YahooResponseValidationResult,
  type YahooValidationResult,
} from './rawSchema'

export {
  buildAttributeQuery,
  buildYahooSearchPlans,
  type QueryBuilderOptions,
  type YahooSearchPlan,
} from './queryBuilder'

export {
  MIN_REQUEST_INTERVAL_MS,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  YAHOO_CACHE_DIR,
  YAHOO_ITEM_SEARCH_ENDPOINT,
  YahooShoppingClient,
  missingAppIdError,
  readYahooAppId,
  type YahooClientOptions,
} from './client'

export {
  buildShippingRuleFromLabel,
  summarizeOffers,
  toDomesticOffer,
  toDomesticOffers,
  toSakamonoModels,
  type YahooNormalizedModels,
  type YahooOfferSummary,
} from './normalize'

export {
  SampleSearchExecutor,
  formatIngestReport,
  runYahooSearch,
  type YahooIngestOptions,
  type YahooIngestResult,
  type YahooSearchExecutor,
} from './ingest'

export { SAMPLE_TARGET_JAN, yahooSampleResponse } from './sampleResponse'

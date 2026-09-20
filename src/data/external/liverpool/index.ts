/**
 * Liverpool 取り込みパイプラインのまとめ。
 *
 * 流れ:
 *   LiverpoolRawSource → 検証 → 正規化 → Product / StoreListing / Variant / PriceSnapshot
 *
 * ★画面（app / components）はこのフォルダを直接 import しない。★
 *   取り込み結果は normalized/liverpool/latest.json へ書き出され、
 *   liverpoolDataSource 経由で repository が読みます。
 *
 * ★公式サイトへ自動アクセスする実装はありません。★
 *   理由は docs/data-sources/liverpool.md を参照してください。
 */

export type {
  LiverpoolRawFeed,
  LiverpoolRawProduct,
  LiverpoolRawVariant,
} from './types'
export { isSampleFeed } from './types'

export {
  IngestionError,
  INGESTION_ERROR_LABEL_JA,
  mustStopOnError,
  type IngestionErrorKind,
  type IngestionIssue,
} from './errors'

export {
  validateRawFeed,
  validateRawProduct,
  validateRawVariant,
  type RawValidationResult,
  type RawFeedValidationResult,
} from './rawSchema'

export {
  classifyAuthenticity,
  classifyCategory,
  classifyFromTitle,
  classifyGender,
  classifyKitType,
  classifySeason,
  classifySleeve,
  normalizeProductUrl,
  type ClassifiedAttributes,
} from './classify'

export {
  LIVERPOOL_CLUB_ID,
  LIVERPOOL_STORE_ID,
  buildExternalKey,
  deriveStockStatus,
  normalizeLiverpoolProducts,
  type NormalizedLiverpoolData,
} from './normalize'

export {
  FileRawSource,
  InMemoryRawSource,
  createHttpRawSource,
  type LiverpoolRawSource,
} from './rawSource'

export {
  DEFAULT_CACHE_TTL_MS,
  isFresh,
  readCache,
  writeCache,
  type CacheEntry,
  type CacheOptions,
} from './cache'

export {
  formatCoverage,
  measureCoverage,
  runIngestion,
  type IngestResult,
  type IngestionCoverage,
  type NormalizedLiverpoolFile,
} from './ingest'

export { liverpoolSampleFeed } from './sampleRaw'

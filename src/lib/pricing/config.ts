/**
 * 日本到着推定額の計算に使う「前提値」をまとめた場所。
 *
 * ★重要★
 * ここの数値はすべて第1段階の仮の値（推定用パラメータ）です。
 * 実際の関税率・送料・為替とは一致しません。
 * 画面では必ず「推定」と分かる表記で出すこと。
 *
 * 第2段階では
 *   - 為替: 外部APIから日次取得した値へ差し替え
 *   - 送料: 各ストアの実送料表へ差し替え
 *   - 関税: 実際の税率表と課税ルールへ差し替え
 * を行う。差し替え箇所をこのファイルへ集約してある。
 */

import type {
  CurrencyCode,
  ProductCategory,
  ShippingType,
  SimplifiedImportParameters,
} from '@/domain/types'

/** 計算前提のバージョン。表示やテストで「いつ時点の前提か」を示すために使う。 */
export const PRICING_ASSUMPTIONS_VERSION = '2026-09-fixture-v1'

/**
 * 為替レート（1外貨 = 何円か）。
 * 第1段階は固定値。自動取得は第2段階（本指示書では対象外）。
 */
export const FX_RATES_JPY: Record<CurrencyCode, number> = {
  JPY: 1,
  GBP: 198.0,
  EUR: 168.0,
  USD: 155.0,
}

/** 為替レートの基準日（表示用）。 */
export const FX_RATE_AS_OF = '2026-09-01'

/**
 * 国際送料の推定値（円）。カテゴリごとのおおよその容積・重量帯で分けている。
 * 実際はストア・配送方法・購入点数で変わるため、あくまで1点購入時の目安。
 */
const INTERNATIONAL_SHIPPING_JPY: Record<ProductCategory, number> = {
  kits: 2600,
  training: 2900,
  jackets: 3600,
  't-shirts': 2200,
  hoodies: 3400,
  scarves: 1800,
  caps: 2000,
  bags: 3200,
  limited: 2800,
  collaboration: 2800,
  // 分類できなかった商品。ユニフォーム相当の目安を置く。
  other: 2600,
}

/** 転送サービスを挟む場合に上乗せする手数料の推定値（円）。 */
const FORWARDER_SURCHARGE_JPY = 1800

/**
 * 課税価格の算出係数。
 * 個人輸入では海外小売価格の60%を課税価格とする簡易計算が用いられる。
 */
export const PERSONAL_IMPORT_TAX_BASE_RATE = 0.6

/** 課税価格がこの額以下なら関税・消費税がかからない（少額免税）。 */
export const DUTY_FREE_THRESHOLD_JPY = 10_000

/** 消費税率（地方消費税を含む）。 */
export const CONSUMPTION_TAX_RATE = 0.1

/**
 * カテゴリ別の関税率の目安。
 * 実際の税率は素材・編み方・形状で細かく分かれるため、ここでは代表値を置く。
 */
const DUTY_RATE_BY_CATEGORY: Record<ProductCategory, number> = {
  kits: 0.1,
  training: 0.1,
  jackets: 0.09,
  't-shirts': 0.1,
  hoodies: 0.1,
  scarves: 0.07,
  caps: 0.05,
  bags: 0.03,
  limited: 0.1,
  collaboration: 0.1,
  // 分類できなかった商品。衣料品の代表値を置く。
  other: 0.1,
}

/** 課税された場合にかかる通関手数料・配送業者立替手数料の推定値（円）。 */
export const CUSTOMS_HANDLING_FEE_JPY = 1_100

/** クレジットカードの海外事務手数料の目安（商品代金に対する割合）。 */
export const FOREIGN_TRANSACTION_FEE_RATE = 0.022

/** カテゴリと配送形態から国際送料の推定値を返す。 */
export function estimateInternationalShippingJpy(
  category: ProductCategory,
  shippingType: ShippingType,
): number {
  if (shippingType === 'domestic') return 0
  const base = INTERNATIONAL_SHIPPING_JPY[category]
  return shippingType === 'forwarder' ? base + FORWARDER_SURCHARGE_JPY : base
}

/** カテゴリ別の関税率の目安を返す。 */
export function dutyRateFor(category: ProductCategory): number {
  return DUTY_RATE_BY_CATEGORY[category]
}

/* ============================================================
 * 第2段階で追加した前提値
 *
 * 第2段階からは、送料・輸入コストの「決まり」をデータ（fixture）側へ移した。
 *   送料     → src/data/fixtures/shippingRules.ts
 *   輸入コスト → src/data/fixtures/importCostRules.ts
 *
 * このファイルは、その fixture が使う「素の数値」を置く場所として残している。
 * 数値を見直すときは、まずここを見ればよい。
 * ========================================================== */

/**
 * カテゴリごとの簡易輸入コスト計算の前提値を組み立てる。
 *
 * ★これは税関の計算ではない。★
 *   サカモノが置いた推定用の前提であり、実際の税額とは異なる。
 */
export function buildSimplifiedImportParameters(
  category: ProductCategory,
): SimplifiedImportParameters {
  return {
    taxBaseRate: PERSONAL_IMPORT_TAX_BASE_RATE,
    dutyFreeThresholdJpy: DUTY_FREE_THRESHOLD_JPY,
    dutyRate: dutyRateFor(category),
    consumptionTaxRate: CONSUMPTION_TAX_RATE,
    handlingFeeJpy: CUSTOMS_HANDLING_FEE_JPY,
  }
}

/** 扱うカテゴリの一覧（ルールをカテゴリごとに作るときに使う）。 */
export const ALL_PRODUCT_CATEGORIES: ProductCategory[] = [
  'kits',
  'training',
  'jackets',
  't-shirts',
  'hoodies',
  'scarves',
  'caps',
  'bags',
  'limited',
  'collaboration',
  'other',
]

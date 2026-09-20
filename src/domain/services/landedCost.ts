/**
 * 日本到着推定額（landed cost）。
 *
 *   商品価格の円換算
 * ＋ 国際送料
 * ＋ 輸入コスト推定
 * ＋ 決済・為替関連コスト
 * ＝ 日本到着推定額
 *
 * ★このファイルのいちばん大事な決まり★
 *
 *   不明な項目を 0 として足さない。
 *
 *   例）商品代 7,000円 ／ 送料 不明 ／ 輸入コスト 1,000円
 *       → 「日本到着推定額 8,000円」とは絶対に出さない。
 *       → totalJpy は null にし、
 *          partialTotalJpy（＝ 8,000円）を「送料を除く参考額」として渡す。
 *
 *   0円（not_applicable）と 不明（unknown）は別物。
 *   0円は「本当にかからない」、不明は「いくらか分からない」。
 */

import type {
  Currency,
  ExchangeRate,
  ImportCostRule,
  Money,
  ProductCategory,
  ShippingRule,
} from '@/domain/types'
import { err, ok, type Result } from '@/lib/result'
import {
  convertMoneyToJpy,
  type ExchangeError,
  type ExchangeRateTable,
} from './exchange'
import { resolveShipping, type ShippingResolution } from './shipping'
import { resolveImportCost, type ImportCostEstimate } from './importCost'
import { estimatePaymentCost, type PaymentCostEstimate } from './paymentCost'

/** 合計が出せない原因になり得る項目。 */
export type LandedCostPart = 'shipping' | 'importCost' | 'paymentCost'

export const LANDED_COST_PART_LABEL_JA: Record<LandedCostPart, string> = {
  shipping: '国際送料',
  importCost: '輸入コスト',
  paymentCost: '決済・為替関連コスト',
}

export interface LandedCost {
  /** 商品価格の円換算。ここは必ず値がある（換算できない場合は LandedCost 自体を作らない）。 */
  productPriceJpy: number
  /** 国際送料。不明なら null。 */
  shippingJpy: number | null
  /** 輸入コスト推定。不明なら null。 */
  importCostJpy: number | null
  /** 決済・為替関連コスト。不明なら null。 */
  paymentCostJpy: number | null
  /**
   * 日本到着推定額。
   * ★1つでも不明な項目があれば null。★
   */
  totalJpy: number | null
  /**
   * 不明な項目を除いた参考額。
   * totalJpy が null のときに「○○を除く参考額」として画面へ出す。
   */
  partialTotalJpy: number
  /** 合計を出せなかった原因の項目。 */
  missing: LandedCostPart[]
  /**
   * 状態。
   *  - complete   : すべて確定値（円建てストアで送料も確定、税もかからない場合など）
   *  - estimated  : すべてそろっているが推定を含む（海外購入は基本これ）
   *  - incomplete : 不明な項目があり合計を出せない
   */
  status: 'complete' | 'estimated' | 'incomplete'
  /** 推定を含むか。true なら画面で必ず「推定」と示す。 */
  isEstimate: boolean
  /** 各項目の詳細（画面の内訳表と説明文に使う）。 */
  components: {
    shipping: ShippingResolution
    importCost: ImportCostEstimate
    paymentCost: PaymentCostEstimate
  }
  /** 使った為替レート。円建てで換算していない場合は null。 */
  exchangeRate: ExchangeRate | null
}

/* ------------------------------------------------------------
 * 合計の組み立て（純粋な足し算。ここだけ切り出してテストしやすくする）
 * ---------------------------------------------------------- */

export interface LandedCostParts {
  productPriceJpy: number
  shipping: ShippingResolution
  importCost: ImportCostEstimate
  paymentCost: PaymentCostEstimate
  exchangeRate: ExchangeRate | null
}

export function buildLandedCost(parts: LandedCostParts): LandedCost {
  const { productPriceJpy, shipping, importCost, paymentCost, exchangeRate } = parts

  const missing: LandedCostPart[] = []
  if (shipping.amountJpy === null) missing.push('shipping')
  if (importCost.amountJpy === null) missing.push('importCost')
  if (paymentCost.amountJpy === null) missing.push('paymentCost')

  // 分かっている項目だけを足した参考額
  const partialTotalJpy =
    productPriceJpy +
    (shipping.amountJpy ?? 0) +
    (importCost.amountJpy ?? 0) +
    (paymentCost.amountJpy ?? 0)

  const totalJpy = missing.length === 0 ? partialTotalJpy : null

  const hasEstimate =
    exchangeRate !== null ||
    shipping.isEstimate ||
    importCost.status === 'estimated' ||
    paymentCost.status === 'estimated'

  const status: LandedCost['status'] =
    missing.length > 0 ? 'incomplete' : hasEstimate ? 'estimated' : 'complete'

  return {
    productPriceJpy,
    shippingJpy: shipping.amountJpy,
    importCostJpy: importCost.amountJpy,
    paymentCostJpy: paymentCost.amountJpy,
    totalJpy,
    partialTotalJpy,
    missing,
    status,
    isEstimate: hasEstimate,
    components: { shipping, importCost, paymentCost },
    exchangeRate,
  }
}

/* ------------------------------------------------------------
 * データから一気に組み立てる
 * ---------------------------------------------------------- */

export interface CalculateLandedCostInput {
  /** ストアでの販売価格（ストアの通貨建て）。 */
  itemPrice: Money
  /** ストアの通貨（決済手数料の判定に使う）。 */
  storeCurrency: Currency
  /** 商品のカテゴリ（輸入コストの決まりを引くのに使う）。 */
  category: ProductCategory
  shippingRule: ShippingRule | null
  importCostRule: ImportCostRule | null
  rates: ExchangeRateTable
  /** 海外事務手数料の率（0〜1）。 */
  foreignTransactionFeeRate: number
}

/**
 * 日本到着推定額を計算する。
 *
 * 商品価格が円へ換算できない場合（未対応通貨・レート無し）だけ失敗を返す。
 * 送料や税が不明なだけなら失敗ではなく、status: 'incomplete' の LandedCost を返す。
 */
export function calculateLandedCost(
  input: CalculateLandedCostInput,
): Result<LandedCost, ExchangeError> {
  const converted = convertMoneyToJpy(input.itemPrice, input.rates)
  if (!converted.ok) return err(converted.error)

  const productPriceJpy = converted.value.value.amount

  const shippingResult = resolveShipping({
    rule: input.shippingRule,
    itemPrice: input.itemPrice,
    rates: input.rates,
  })
  if (!shippingResult.ok) return err(shippingResult.error)

  const importCost = resolveImportCost(productPriceJpy, input.importCostRule)

  const paymentCost = estimatePaymentCost({
    itemPriceJpy: productPriceJpy,
    storeCurrency: input.storeCurrency,
    foreignTransactionFeeRate: input.foreignTransactionFeeRate,
  })

  return ok(
    buildLandedCost({
      productPriceJpy,
      shipping: shippingResult.value,
      importCost,
      paymentCost,
      exchangeRate: converted.value.rate,
    }),
  )
}

/* ------------------------------------------------------------
 * 表示の補助
 * ---------------------------------------------------------- */

/**
 * 画面に出す見出しを作る。
 * 合計が出せないときは「何を除いた参考額なのか」を必ず言葉にする。
 */
export function describeLandedCost(landedCost: LandedCost): {
  /** 総額を表示してよいか。 */
  hasTotal: boolean
  /** 表示する金額（総額、または参考額）。 */
  displayAmountJpy: number
  /** 金額の見出し。 */
  label: string
  /** 補足説明。 */
  note: string
} {
  if (landedCost.totalJpy !== null) {
    return {
      hasTotal: true,
      displayAmountJpy: landedCost.totalJpy,
      label: '日本到着推定額',
      note:
        landedCost.status === 'complete'
          ? '確定している費用だけで計算した金額です。'
          : '送料・輸入コストなどの推定を含む金額です。確定額ではありません。',
    }
  }

  const missingLabel = landedCost.missing
    .map((part) => LANDED_COST_PART_LABEL_JA[part])
    .join('・')

  return {
    hasTotal: false,
    displayAmountJpy: landedCost.partialTotalJpy,
    label: `${missingLabel}を除く参考額`,
    note: `${missingLabel}が分からないため、日本到着推定額は算出できません。`,
  }
}

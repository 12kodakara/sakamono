/**
 * 輸入コスト（関税・輸入消費税・通関手数料）の見積り。
 *
 * ★★ サカモノは税関ではないので、確定税額は出せない。 ★★
 *
 * そこで、
 *   「どういう前提で見積もるか」を ImportCostRule として **データ側** に持ち、
 *   このファイルはその前提どおりに計算するだけにしている。
 *
 * 税関の判定ロジックを推測してコードへ埋め込まない。
 * 前提を変えたいときは fixture（第3段階では取得したデータ）を差し替える。
 *
 * 結果は必ず status を伴う。
 *   estimated      … 前提にもとづく推定額
 *   not_applicable … かからないと判断できる（国内購入など）
 *   unknown        … 見積もれない（★0円にしない★）
 */

import type { ImportCostRule, ProductCategory, SimplifiedImportParameters } from '@/domain/types'
import { money } from '@/domain/money'

export interface ImportCostEstimate {
  /** 輸入コストの推定額（円）。見積もれない場合は null。★unknown を 0 にしない★ */
  amountJpy: number | null
  status: 'estimated' | 'not_applicable' | 'unknown'
  /** 画面や管理者向けの説明。 */
  note?: string
  /** 内訳（simplified-personal-import のときだけ入る）。画面の説明に使う。 */
  breakdown?: SimplifiedImportBreakdown
  /** 使った決まり。 */
  rule?: ImportCostRule
}

export interface SimplifiedImportBreakdown {
  /** 課税価格（商品代金 × taxBaseRate）。 */
  taxableValueJpy: number
  dutyJpy: number
  consumptionTaxJpy: number
  handlingFeeJpy: number
  /** 少額免税の範囲内と判断したか。 */
  dutyFree: boolean
}

/**
 * 簡易計算（個人輸入）の内訳を求める。
 *
 * これは「税関の計算」ではなく、**サカモノが置いた前提**にもとづく試算。
 * 前提値（課税価格の割合・免税ライン・税率）はすべて引数で受け取る。
 */
export function calculateSimplifiedImportBreakdown(
  itemPriceJpy: number,
  parameters: SimplifiedImportParameters,
): SimplifiedImportBreakdown {
  const taxableValueJpy = money(itemPriceJpy * parameters.taxBaseRate, 'JPY').amount
  const dutyFree = taxableValueJpy <= parameters.dutyFreeThresholdJpy

  if (dutyFree) {
    return {
      taxableValueJpy,
      dutyJpy: 0,
      consumptionTaxJpy: 0,
      handlingFeeJpy: 0,
      dutyFree: true,
    }
  }

  const dutyJpy = money(taxableValueJpy * parameters.dutyRate, 'JPY').amount
  const consumptionTaxJpy = money(
    (taxableValueJpy + dutyJpy) * parameters.consumptionTaxRate,
    'JPY',
  ).amount

  return {
    taxableValueJpy,
    dutyJpy,
    consumptionTaxJpy,
    handlingFeeJpy: parameters.handlingFeeJpy,
    dutyFree: false,
  }
}

/**
 * 商品価格（円換算後）と適用する決まりから、輸入コストの推定を作る。
 */
export function resolveImportCost(
  itemPriceJpy: number,
  rule: ImportCostRule | null | undefined,
): ImportCostEstimate {
  if (!rule) {
    return {
      amountJpy: null,
      status: 'unknown',
      note: 'このストア・カテゴリの輸入コストの前提が未設定のため、見積もれません。',
    }
  }

  if (rule.method === 'unknown') {
    return {
      amountJpy: null,
      status: 'unknown',
      note: rule.note ?? '輸入コストを見積もるための情報がそろっていません。',
      rule,
    }
  }

  if (rule.method === 'not-applicable') {
    return {
      amountJpy: 0,
      status: 'not_applicable',
      note: rule.note ?? '国内での購入のため、関税・輸入消費税はかかりません。',
      rule,
    }
  }

  if (rule.method === 'flat') {
    if (rule.flatAmountJpy === undefined || !Number.isFinite(rule.flatAmountJpy)) {
      return {
        amountJpy: null,
        status: 'unknown',
        note: '定額の輸入コストが設定されていないため、見積もれません。',
        rule,
      }
    }
    return {
      amountJpy: money(rule.flatAmountJpy, 'JPY').amount,
      status: 'estimated',
      note: rule.note ?? 'サカモノが置いた定額の推定値です。',
      rule,
    }
  }

  // ---- simplified-personal-import ----
  if (!rule.parameters) {
    return {
      amountJpy: null,
      status: 'unknown',
      note: '簡易計算の前提値が設定されていないため、見積もれません。',
      rule,
    }
  }

  const breakdown = calculateSimplifiedImportBreakdown(itemPriceJpy, rule.parameters)
  const amountJpy = breakdown.dutyJpy + breakdown.consumptionTaxJpy + breakdown.handlingFeeJpy

  return {
    amountJpy,
    status: 'estimated',
    note: breakdown.dutyFree
      ? `課税価格が${rule.parameters.dutyFreeThresholdJpy.toLocaleString('ja-JP')}円以下のため、非課税と想定しています。`
      : '個人輸入の簡易計算による推定額です。実際の税額は税関の判断で変わります。',
    breakdown,
    rule,
  }
}

/**
 * ストアとカテゴリに合う決まりを探す。
 * 「ストア・カテゴリの両方が一致」→「ストアのみ一致」→「どちらも any」の順に見る。
 */
export function findImportCostRule(
  rules: ImportCostRule[],
  storeId: string,
  category: ProductCategory,
): ImportCostRule | null {
  const forJapan = rules.filter((rule) => rule.destinationCountry === 'JP')

  return (
    forJapan.find((rule) => rule.storeId === storeId && rule.category === category) ??
    forJapan.find((rule) => rule.storeId === storeId && rule.category === 'any') ??
    forJapan.find((rule) => rule.storeId === 'any' && rule.category === category) ??
    forJapan.find((rule) => rule.storeId === 'any' && rule.category === 'any') ??
    null
  )
}

/** 画面に出す日本語ラベル。 */
export const IMPORT_COST_STATUS_LABEL_JA: Record<ImportCostEstimate['status'], string> = {
  estimated: '推定',
  not_applicable: 'かからない',
  unknown: '不明',
}

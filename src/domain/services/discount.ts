/**
 * 割引率（セール）の判定。
 *
 * regularPrice（通常価格）と currentPrice（現在価格）から割引率を出す共通処理。
 * 価格を扱う場所が増えても、セールの判定はここ1か所だけにする。
 *
 * ★「値上げ」をセールとして扱わない。★
 *   currentPrice が regularPrice より高い場合、割引率はマイナスにせず0にし、
 *   status で「値上げ」と分かるようにする。
 *
 * 想定している異常値:
 *   regularPrice = 0        … 割る数が0。計算できないので invalid
 *   currentPrice < 0        … あり得ない値。invalid
 *   regularPrice < 0        … あり得ない値。invalid
 *   currentPrice > regular  … 値上げ。セールではない
 *   数値でない / 無限大      … invalid
 */

export type DiscountStatus =
  /** 値下げされている */
  | 'sale'
  /** 値下げされていない（同額） */
  | 'no-discount'
  /** 値上げされている */
  | 'price-increase'
  /** 価格データが不正で判定できない */
  | 'invalid'

export interface DiscountEvaluation {
  /** 割引率（0〜1）。セール以外は必ず0。 */
  rate: number
  /** 割引率のパーセント表示用（整数）。 */
  percent: number
  /** セールとして扱ってよいか。 */
  isSale: boolean
  status: DiscountStatus
  /** 管理者向けの説明（異常値のときだけ入る）。 */
  note?: string
}

function invalid(note: string): DiscountEvaluation {
  return { rate: 0, percent: 0, isSale: false, status: 'invalid', note }
}

/**
 * 割引率を評価する。例外は投げない（異常値は status: 'invalid' で返す）。
 */
export function evaluateDiscount(regularPrice: number, currentPrice: number): DiscountEvaluation {
  if (!Number.isFinite(regularPrice) || !Number.isFinite(currentPrice)) {
    return invalid(`価格が数値ではありません（通常: ${regularPrice} / 現在: ${currentPrice}）`)
  }
  if (regularPrice < 0 || currentPrice < 0) {
    return invalid(`価格がマイナスです（通常: ${regularPrice} / 現在: ${currentPrice}）`)
  }
  if (regularPrice === 0) {
    // 0で割れないため割引率は出せない。0%として扱うのではなく不正として返す。
    return invalid('通常価格が0のため、割引率を計算できません')
  }

  if (currentPrice > regularPrice) {
    return {
      rate: 0,
      percent: 0,
      isSale: false,
      status: 'price-increase',
      note: '現在価格が通常価格を上回っています（値上げ）',
    }
  }

  if (currentPrice === regularPrice) {
    return { rate: 0, percent: 0, isSale: false, status: 'no-discount' }
  }

  const rate = (regularPrice - currentPrice) / regularPrice
  return {
    rate,
    percent: Math.round(rate * 100),
    isSale: true,
    status: 'sale',
  }
}

/** 割引率（0〜1）をパーセントの整数へ丸める。 */
export function discountRateToPercent(discountRate: number): number {
  if (!Number.isFinite(discountRate)) return 0
  return Math.round(discountRate * 100)
}

export const DISCOUNT_STATUS_LABEL_JA: Record<DiscountStatus, string> = {
  sale: 'セール中',
  'no-discount': '通常価格',
  'price-increase': '値上げ',
  invalid: '価格情報に不備',
}

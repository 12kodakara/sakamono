/**
 * Money 型 — 金額と通貨を必ずセットで扱う。
 *
 * なぜ必要か:
 *   `79.95` という数字だけを関数から関数へ渡していると、
 *   それがポンドなのか円なのか分からなくなる。
 *   「ポンドの金額に円の送料を足してしまった」という間違いは、
 *   数字だけで扱っているかぎりコンパイラには見つけられない。
 *   Money にしておけば、通貨違いの足し算はその場でエラーになる。
 *
 * ── 丸めの方針 ──────────────────────────────────
 *   JPY : 小数を持たない。常に整数円へ丸める。
 *   外貨: その通貨の最小単位（ここでは2桁）まで保持する。
 *
 *   丸めは「0から遠い方へ half up」（roundHalfAwayFromZero）で統一する。
 *   JavaScript の Math.round() は -0.5 を 0 にする（＋∞方向へ丸める）ため、
 *   マイナス金額を扱ったときに符号で挙動が変わってしまう。それを避けるため。
 *
 *   丸めるタイミングは「通貨をまたぐ計算の直後」と「表示の直前」。
 *   途中の計算では丸めない（丸め誤差を積み重ねないため）。
 * ──────────────────────────────────────────────
 */

/** 扱う通貨。ここに無い通貨は「未対応」として明示的に失敗させる。 */
export type Currency = 'JPY' | 'GBP' | 'EUR' | 'USD'

/** 実行時に「未対応の通貨」を判定するための一覧。 */
export const SUPPORTED_CURRENCIES: readonly Currency[] = ['JPY', 'GBP', 'EUR', 'USD'] as const

/** 通貨ごとの小数桁数。 */
export const CURRENCY_DECIMALS: Record<Currency, number> = {
  JPY: 0,
  GBP: 2,
  EUR: 2,
  USD: 2,
}

export interface Money {
  /** 金額。通貨の主単位（円・ポンドなど）で表す。マイナスも取り得る（差額など）。 */
  amount: number
  currency: Currency
}

/** 与えられた文字列が対応通貨かどうか。 */
export function isSupportedCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (SUPPORTED_CURRENCIES as readonly string[]).includes(value)
}

/**
 * 0から遠い方へ half up で丸める。
 *   2.5 -> 3 / -2.5 -> -3 / 2.4 -> 2 / -2.4 -> -2
 */
export function roundHalfAwayFromZero(value: number, decimals = 0): number {
  if (!Number.isFinite(value)) {
    throw new Error(`丸められない値です: ${value}`)
  }
  const factor = 10 ** decimals
  const scaled = value * factor
  // 浮動小数の誤差（例: 1.005 * 100 = 100.49999…）を吸収する
  const corrected = Number(scaled.toPrecision(12))
  const rounded = corrected < 0 ? -Math.round(-corrected) : Math.round(corrected)
  // -0 を 0 に正規化する
  return rounded === 0 ? 0 : rounded / factor
}

/** Money を作る。通貨の小数桁数に合わせて丸めた値を持つ。 */
export function money(amount: number, currency: Currency): Money {
  if (!Number.isFinite(amount)) {
    throw new Error(`金額が数値ではありません: ${amount}`)
  }
  if (!isSupportedCurrency(currency)) {
    throw new Error(`未対応の通貨コードです: ${String(currency)}`)
  }
  return { amount: roundHalfAwayFromZero(amount, CURRENCY_DECIMALS[currency]), currency }
}

/** 円建ての Money を作る（整数円へ丸める）。 */
export function jpy(amount: number): Money {
  return money(amount, 'JPY')
}

/** 丸めずに保持したい途中計算用。表示前に必ず round する。 */
export function rawMoney(amount: number, currency: Currency): Money {
  if (!Number.isFinite(amount)) {
    throw new Error(`金額が数値ではありません: ${amount}`)
  }
  return { amount, currency }
}

/** その通貨の小数桁数へ丸め直す。 */
export function roundMoney(value: Money): Money {
  return money(value.amount, value.currency)
}

/** 円建ての Money から整数の円を取り出す。 */
export function toJpyNumber(value: Money): number {
  if (value.currency !== 'JPY') {
    throw new Error(`円建てではない Money から円を取り出そうとしました: ${value.currency}`)
  }
  return roundHalfAwayFromZero(value.amount, 0)
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new Error(
      `通貨が異なる金額を計算しようとしました: ${a.currency} と ${b.currency}。` +
        '先に同じ通貨へ換算してください。',
    )
  }
}

/** 足し算。通貨が違えばエラー。 */
export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return rawMoney(a.amount + b.amount, a.currency)
}

/** 複数の足し算。1件も無ければ指定通貨の0を返す。 */
export function sumMoney(values: Money[], currency: Currency): Money {
  return values.reduce<Money>((total, value) => addMoney(total, value), rawMoney(0, currency))
}

/** 引き算（a - b）。通貨が違えばエラー。 */
export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b)
  return rawMoney(a.amount - b.amount, a.currency)
}

/** 掛け算（手数料率など）。 */
export function multiplyMoney(value: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new Error(`係数が数値ではありません: ${factor}`)
  }
  return rawMoney(value.amount * factor, value.currency)
}

/** 大小比較。a < b なら負、a > b なら正、同じなら0。通貨が違えばエラー。 */
export function compareMoney(a: Money, b: Money): number {
  assertSameCurrency(a, b)
  return a.amount - b.amount
}

/** マイナスかどうか。 */
export function isNegative(value: Money): boolean {
  return value.amount < 0
}

/** 絶対値。 */
export function absMoney(value: Money): Money {
  return rawMoney(Math.abs(value.amount), value.currency)
}

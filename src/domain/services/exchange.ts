/**
 * 円換算サービス。
 *
 *   外貨の商品価格 × 為替レート = 商品価格の円換算
 *
 * ★対応していない通貨を黙って0円にしない。★
 *   0円にしてしまうと「タダで買える商品」に見えてしまう。
 *   換算できない場合は Result の失敗として返し、呼び出し側に必ず処理させる。
 */

import type { Currency, ExchangeRate, Money } from '@/domain/types'
import { isSupportedCurrency, money, rawMoney } from '@/domain/money'
import { err, ok, type Result } from '@/lib/result'

/* ------------------------------------------------------------
 * 失敗の種類
 * ---------------------------------------------------------- */

export type ExchangeErrorReason =
  /** サカモノが扱う通貨一覧に無い */
  | 'unsupported-currency'
  /** 通貨は扱えるが、その日のレートを持っていない */
  | 'rate-not-found'
  /** レートの値がおかしい（0以下など） */
  | 'invalid-rate'
  /** 金額が数値でない */
  | 'invalid-amount'

export interface ExchangeError {
  reason: ExchangeErrorReason
  /** 画面や管理者向けの説明。 */
  message: string
  currency?: string
}

/* ------------------------------------------------------------
 * レート表
 * ---------------------------------------------------------- */

export interface ExchangeRateTable {
  /** その通貨のレートを返す。無ければ null。 */
  find(currency: Currency): ExchangeRate | null
  /** 開発用の固定レートを含んでいるか（画面に「開発用の想定値」と出すため）。 */
  readonly containsDevelopmentFixture: boolean
  /** 一番新しい取得日時。「いつ時点のレートか」を出すのに使う。 */
  readonly latestFetchedAt: string | null
  readonly all: ExchangeRate[]
}

/** ExchangeRate の配列からレート表を作る。同じ通貨が複数あれば新しい方を採用する。 */
export function createExchangeRateTable(rates: ExchangeRate[]): ExchangeRateTable {
  const byCurrency = new Map<Currency, ExchangeRate>()

  for (const rate of rates) {
    const existing = byCurrency.get(rate.baseCurrency)
    if (!existing || rate.fetchedAt > existing.fetchedAt) {
      byCurrency.set(rate.baseCurrency, rate)
    }
  }

  const all = [...byCurrency.values()]

  return {
    find: (currency) => byCurrency.get(currency) ?? null,
    containsDevelopmentFixture: all.some((rate) => rate.kind === 'development-fixture'),
    latestFetchedAt:
      all.length === 0
        ? null
        : all.reduce((latest, rate) => (rate.fetchedAt > latest ? rate.fetchedAt : latest), all[0].fetchedAt),
    all,
  }
}

/* ------------------------------------------------------------
 * 換算
 * ---------------------------------------------------------- */

export interface ConvertedMoney {
  /** 円換算後の金額（整数円）。 */
  value: Money
  /**
   * 使った為替レート。
   * 円→円の場合は換算していないので null。
   */
  rate: ExchangeRate | null
}

/**
 * Money を円へ換算する。
 *
 *  - JPY → JPY はそのまま（レートを引かない）
 *  - GBP / EUR / USD → JPY はレート表を引く
 *  - それ以外の通貨、またはレートが無い場合は失敗を返す
 */
export function convertMoneyToJpy(
  source: Money,
  rates: ExchangeRateTable,
): Result<ConvertedMoney, ExchangeError> {
  if (!Number.isFinite(source.amount)) {
    return err({
      reason: 'invalid-amount',
      message: `金額が数値ではありません: ${source.amount}`,
      currency: source.currency,
    })
  }

  if (!isSupportedCurrency(source.currency)) {
    return err({
      reason: 'unsupported-currency',
      message: `サカモノが対応していない通貨です: ${String(source.currency)}`,
      currency: String(source.currency),
    })
  }

  // 円はそのまま。整数円へ丸めるだけ。
  if (source.currency === 'JPY') {
    return ok({ value: money(source.amount, 'JPY'), rate: null })
  }

  const rate = rates.find(source.currency)
  if (!rate) {
    return err({
      reason: 'rate-not-found',
      message: `${source.currency} の為替レートを持っていません`,
      currency: source.currency,
    })
  }

  if (!Number.isFinite(rate.rate) || rate.rate <= 0) {
    return err({
      reason: 'invalid-rate',
      message: `${source.currency} の為替レートが不正です: ${rate.rate}`,
      currency: source.currency,
    })
  }

  return ok({ value: money(source.amount * rate.rate, 'JPY'), rate })
}

/**
 * 換算せずに「レートを掛けた生の値」を得る（途中計算用、丸めない）。
 * 送料のしきい値比較など、丸めを挟みたくない場面で使う。
 */
export function convertMoneyToJpyRaw(
  source: Money,
  rates: ExchangeRateTable,
): Result<Money, ExchangeError> {
  const converted = convertMoneyToJpy(source, rates)
  if (!converted.ok) return converted
  if (source.currency === 'JPY') return ok(rawMoney(source.amount, 'JPY'))

  const rate = converted.value.rate
  return ok(rawMoney(source.amount * (rate?.rate ?? 1), 'JPY'))
}

/**
 * 為替換算。
 *
 * ★★ 新しいコードでは使わないでください。★★
 *
 * 第2段階で、円換算は src/domain/services/exchange.ts へ移しました。
 * そちらは ExchangeRate（データ）を受け取り、
 * 未対応の通貨やレート無しを Result の失敗として返します。
 *
 * このファイルは第1段階から使っている呼び出し名を残すための薄い層です。
 * 参照しているレートは config.ts の FX_RATES_JPY で、
 * fixture の為替レートも同じ値から作っているため、数値がずれることはありません。
 *
 * @deprecated convertMoneyToJpy()（src/domain/services/exchange.ts）を使ってください。
 */

import type { CurrencyCode } from '@/domain/types'
import { FX_RATES_JPY, FX_RATE_AS_OF } from './config'

/** 1外貨あたりの円レートを返す。 */
export function getRateToJpy(currency: CurrencyCode): number {
  const rate = FX_RATES_JPY[currency]
  if (rate === undefined) {
    throw new Error(`未対応の通貨コードです: ${currency}`)
  }
  return rate
}

/** 外貨建て金額を円へ換算する（1円未満は四捨五入）。 */
export function convertToJpy(amount: number, currency: CurrencyCode): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`金額が数値ではありません: ${amount}`)
  }
  if (amount < 0) {
    throw new Error(`金額が負の値です: ${amount}`)
  }
  return Math.round(amount * getRateToJpy(currency))
}

/** 使用した為替レートの基準日。「いつ時点のレートか」を画面に出すために使う。 */
export function getFxAsOf(): string {
  return FX_RATE_AS_OF
}

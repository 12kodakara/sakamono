/**
 * 価格履歴のまとめ。
 *
 * PriceSnapshot（価格を確認するたびに1件ずつ増える記録）から、
 * 画面で使う数字を取り出す。
 *
 *   現在価格 / 過去最安 / 過去最高 / 直近の変動
 *
 * 第2段階ではグラフ用ライブラリを増やさない。
 * 第1段階で作ったCSSだけの棒表示をそのまま使い、数値だけを充実させる。
 */

import type { Currency, Money, PriceSnapshot } from '@/domain/types'
import { rawMoney } from '@/domain/money'

export type PriceTrend = 'down' | 'up' | 'flat'

export interface PriceChange {
  /** 変動額（後 － 前）。マイナスなら値下がり。 */
  amount: number
  currency: Currency
  trend: PriceTrend
  /** 変動前の記録日時。 */
  fromRecordedAt: string
  /** 変動後の記録日時。 */
  toRecordedAt: string
}

export interface PriceHistorySummary {
  /** 記録の件数。 */
  pointCount: number
  /** いちばん新しい記録の価格。 */
  currentPrice: Money | null
  /** 記録の中でいちばん安かった価格。 */
  lowestPrice: Money | null
  /** 記録の中でいちばん高かった価格。 */
  highestPrice: Money | null
  /** 直近の変動（最後の2件の差）。記録が1件以下なら null。 */
  latestChange: PriceChange | null
  /** 現在価格が記録上の最安と同じか。 */
  isAtLowest: boolean
  firstRecordedAt: string | null
  lastRecordedAt: string | null
}

const EMPTY: PriceHistorySummary = {
  pointCount: 0,
  currentPrice: null,
  lowestPrice: null,
  highestPrice: null,
  latestChange: null,
  isAtLowest: false,
  firstRecordedAt: null,
  lastRecordedAt: null,
}

/**
 * 価格履歴をまとめる。
 * 渡された記録は順不同でもよい（中で日時順に並べ替える）。
 */
export function summarizePriceHistory(snapshots: PriceSnapshot[]): PriceHistorySummary {
  if (snapshots.length === 0) return EMPTY

  const sorted = [...snapshots].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  const currency = sorted[sorted.length - 1].currency

  // 通貨が混ざった履歴は比較できないので、最新の通貨に合うものだけを使う
  const sameCurrency = sorted.filter((snapshot) => snapshot.currency === currency)
  if (sameCurrency.length === 0) return EMPTY

  const prices = sameCurrency.map((snapshot) => snapshot.price)
  const latest = sameCurrency[sameCurrency.length - 1]
  const lowest = Math.min(...prices)
  const highest = Math.max(...prices)

  let latestChange: PriceChange | null = null
  if (sameCurrency.length >= 2) {
    const previous = sameCurrency[sameCurrency.length - 2]
    const amount = latest.price - previous.price
    latestChange = {
      amount,
      currency,
      trend: amount < 0 ? 'down' : amount > 0 ? 'up' : 'flat',
      fromRecordedAt: previous.recordedAt,
      toRecordedAt: latest.recordedAt,
    }
  }

  return {
    pointCount: sameCurrency.length,
    currentPrice: rawMoney(latest.price, currency),
    lowestPrice: rawMoney(lowest, currency),
    highestPrice: rawMoney(highest, currency),
    latestChange,
    isAtLowest: latest.price <= lowest,
    firstRecordedAt: sameCurrency[0].recordedAt,
    lastRecordedAt: latest.recordedAt,
  }
}

export const PRICE_TREND_LABEL_JA: Record<PriceTrend, string> = {
  down: '値下がり',
  up: '値上がり',
  flat: '変動なし',
}

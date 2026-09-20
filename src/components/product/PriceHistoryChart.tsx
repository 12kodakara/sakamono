/**
 * 価格の推移。
 *
 * 第2段階でもグラフ用ライブラリは足さない。
 *  - JavaScriptを増やさない（表示速度のため）
 *  - 第3段階で本格的なグラフへ差し替えるときも、置き換えるのはこのファイルだけ
 *
 * 追加したのは数値のまとめ（現在価格・過去最安・過去最高・直近の変動）。
 * 計算は summarizePriceHistory()（サービス層）が済ませている。
 *
 * 棒グラフは目で見るためのものなので aria-hidden にし、
 * 読み上げソフト向けには同じ内容を表で用意している。
 */

import type { PriceHistorySeries } from '@/data/viewModels'
import { PRICE_TREND_LABEL_JA } from '@/domain/services/priceHistory'
import { formatCurrency, formatDateJa, toDateAttribute } from '@/lib/format'

export interface PriceHistoryChartProps {
  series: PriceHistorySeries
  /** グラフの説明（例: 「海外公式ストアの価格」）。 */
  caption: string
}

export function PriceHistoryChart({ series, caption }: PriceHistoryChartProps) {
  const { snapshots, summary } = series

  if (snapshots.length === 0) {
    return (
      <p className="empty-state">
        価格の記録がまだありません。価格の確認を重ねるごとに、ここへ推移が表示されます。
      </p>
    )
  }

  const prices = snapshots.map((snapshot) => snapshot.price)
  const max = Math.max(...prices)
  const min = Math.min(...prices)
  // すべて同じ価格でも棒が消えないよう、最低の高さを確保する
  const range = max - min || max || 1

  return (
    <div className="price-history">
      <p style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>{caption}</p>

      {/* ----- 数値のまとめ ----- */}
      <dl className="history-stats">
        <div className="history-stats__item">
          <dt>現在価格</dt>
          <dd>
            {summary.currentPrice
              ? formatCurrency(summary.currentPrice.amount, summary.currentPrice.currency)
              : '—'}
          </dd>
        </div>
        <div className="history-stats__item">
          <dt>過去最安</dt>
          <dd>
            {summary.lowestPrice
              ? formatCurrency(summary.lowestPrice.amount, summary.lowestPrice.currency)
              : '—'}
            {summary.isAtLowest ? <span className="badge badge--sale">最安値</span> : null}
          </dd>
        </div>
        <div className="history-stats__item">
          <dt>過去最高</dt>
          <dd>
            {summary.highestPrice
              ? formatCurrency(summary.highestPrice.amount, summary.highestPrice.currency)
              : '—'}
          </dd>
        </div>
        <div className="history-stats__item">
          <dt>直近の変動</dt>
          <dd>
            {summary.latestChange ? (
              <>
                {PRICE_TREND_LABEL_JA[summary.latestChange.trend]}
                {summary.latestChange.trend !== 'flat' ? (
                  <>
                    {' '}
                    {formatCurrency(
                      Math.abs(summary.latestChange.amount),
                      summary.latestChange.currency,
                    )}
                  </>
                ) : null}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
      </dl>

      <div className="price-history__chart" aria-hidden="true">
        {snapshots.map((snapshot) => {
          const ratio = (snapshot.price - min) / range
          const heightPercent = 25 + ratio * 75
          return (
            <div className="price-history__bar" key={snapshot.id}>
              <span style={{ height: `${heightPercent}%` }} />
            </div>
          )
        })}
      </div>

      <ul className="price-history__labels" aria-hidden="true">
        {snapshots.map((snapshot) => (
          <li key={snapshot.id}>{snapshot.recordedAt.slice(5, 7)}月</li>
        ))}
      </ul>

      <details style={{ marginTop: 'var(--space-3)', fontSize: 'var(--text-sm)' }}>
        <summary style={{ cursor: 'pointer' }}>価格の記録を数値で見る</summary>
        <table className="breakdown" style={{ marginTop: 'var(--space-2)' }}>
          <caption className="visually-hidden">{caption}の価格の記録</caption>
          <thead>
            <tr>
              <th scope="col">確認日</th>
              <th scope="col" style={{ textAlign: 'right' }}>
                価格
              </th>
            </tr>
          </thead>
          <tbody>
            {snapshots.map((snapshot) => (
              <tr key={snapshot.id}>
                <th scope="row">
                  <time dateTime={toDateAttribute(snapshot.recordedAt)}>
                    {formatDateJa(snapshot.recordedAt)}
                  </time>
                </th>
                <td>{formatCurrency(snapshot.price, snapshot.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <p className="breakdown__note">
        表示しているのは、サカモノが価格を確認した時点の記録です。
        確認していない期間の値動きは含まれません。
      </p>
    </div>
  )
}

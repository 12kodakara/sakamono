/**
 * 商品詳細ページの「比較結果」欄。
 *
 * 日本到着推定額と国内比較価格を並べ、どちらがいくら安いのかを示す。
 *
 * ★色だけで意味を伝えない。★
 *   「国内より○○円安い」「国内購入の方が○○円安い」と必ず文章で書く。
 *   色は補助にとどめる。
 *
 * ★素性の違うデータ同士の比較には注意書きを出す。★
 *   開発中は「海外＝開発用データ／国内＝取得データ」のように
 *   片方だけ実データ、という状態が起こります。
 *   そのまま差額を見せると、意味のない数字を本物の比較結果として
 *   受け取られてしまうので、必ず断りを入れます。
 */

import type { ProductView } from '@/data/viewModels'
import { describeLandedCost } from '@/domain/services/landedCost'
import { describePriceDifference, formatSavingRate } from '@/domain/services/priceComparison'
import { formatJpy } from '@/lib/format'
import { describeDataOrigin } from '@/lib/labels'

export function ComparisonResult({ view }: { view: ProductView }) {
  const { comparison, overseas } = view
  const described = describePriceDifference(comparison)
  const savingRate = formatSavingRate(comparison.savingRate)

  // 海外側と国内側で、データの素性（開発用 / 取得データ）が食い違っていないか
  const domesticStore = comparison.domesticPrice.reference?.store
  const mixedOrigin =
    overseas !== null &&
    domesticStore !== undefined &&
    describeDataOrigin(overseas.store).isLive !== describeDataOrigin(domesticStore).isLive

  return (
    <div className="comparison">
      <dl className="comparison__rows">
        <div className="price-row">
          <dt className="price-row__label">
            {overseas ? describeLandedCost(overseas.landedCost).label : '日本到着推定額'}
          </dt>
          <dd className="price-row__value">
            {overseas ? formatJpy(describeLandedCost(overseas.landedCost).displayAmountJpy) : '—'}
          </dd>
        </div>
        <div className="price-row">
          <dt className="price-row__label">国内比較価格（送料込み）</dt>
          <dd className="price-row__value">
            {comparison.domesticPrice.referencePriceJpy !== null
              ? formatJpy(comparison.domesticPrice.referencePriceJpy)
              : '—'}
          </dd>
        </div>
      </dl>

      {described.show ? (
        <>
          {described.advantage === 'even' ? (
            <p className="comparison__result comparison__result--even">国内価格とほぼ同じです</p>
          ) : (
            <p
              className={`comparison__result comparison__result--${
                described.advantage === 'overseas' ? 'overseas' : 'domestic'
              }`}
            >
              {described.prefix}
              <strong className="comparison__amount">{formatJpy(described.amountJpy)}</strong>
              {described.suffix}
              {savingRate ? <span className="comparison__rate">（{savingRate}）</span> : null}
            </p>
          )}

          {mixedOrigin ? (
            <p className="alert-note" role="note">
              海外側と国内側で、データの素性が違います
              （{describeDataOrigin(overseas!.store).label} と {describeDataOrigin(domesticStore!).label}）。
              この差額は開発中の確認用で、実際の比較結果ではありません。
            </p>
          ) : (
            <p className="breakdown__note">{comparison.statusNote}</p>
          )}
        </>
      ) : (
        <p className="alert-note" role="note">
          {comparison.statusNote}
        </p>
      )}
    </div>
  )
}

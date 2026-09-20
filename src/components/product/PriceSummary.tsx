/**
 * 商品カードに出す価格のまとめ。
 *
 * 目立たせるのは次の3つ:
 *   1. 海外価格
 *   2. 日本到着推定（最も大きく表示）
 *   3. 国内価格との差
 *
 * 送料・輸入コストの内訳は商品詳細ページへ送る。
 *
 * ★送料が不明な商品では「日本到着推定額」を出さない。★
 *   代わりに「国際送料を除く参考額」と、その理由を表示する。
 *   分からない費用を0円として足した金額を、総額のように見せないため。
 */

import type { ProductView } from '@/data/viewModels'
import { describeLandedCost } from '@/domain/services/landedCost'
import { PriceGap } from './PriceGap'
import { formatCurrency, formatJpy } from '@/lib/format'

export function PriceSummary({ view }: { view: ProductView }) {
  const { overseas, comparison } = view

  if (!overseas) {
    return (
      <div className="price-summary">
        <p className="price-row__label">価格情報を確認できていません。</p>
      </div>
    )
  }

  const { listing, discount, landedCost } = overseas
  const landed = describeLandedCost(landedCost)
  const domesticPriceJpy = comparison.domesticPrice.referencePriceJpy

  return (
    <div className="price-summary">
      <dl className="price-summary__rows">
        <div className="price-row">
          <dt className="price-row__label">海外価格</dt>
          <dd className="price-row__value">
            {discount.isSale ? (
              <>
                <span className="price-row__value--struck">
                  {formatCurrency(listing.regularPrice, listing.currency)}
                </span>{' '}
              </>
            ) : null}
            {formatCurrency(listing.currentPrice, listing.currency)}
          </dd>
        </div>

        <div className="price-row price-row--landed">
          <dt className="price-row__label">
            {landed.hasTotal ? (
              <>
                日本到着 <span className="estimate-mark">推定</span>
              </>
            ) : (
              <>
                送料を除く <span className="estimate-mark">参考額</span>
              </>
            )}
          </dt>
          <dd className="price-row__value">{formatJpy(landed.displayAmountJpy)}</dd>
        </div>

        <div className="price-row">
          <dt className="price-row__label">国内価格</dt>
          <dd className="price-row__value">
            {domesticPriceJpy !== null ? formatJpy(domesticPriceJpy) : '—'}
          </dd>
        </div>
      </dl>

      {landed.hasTotal ? null : <p className="price-gap--unavailable">{landed.note}</p>}

      <PriceGap view={view} />
    </div>
  )
}

/**
 * 「国内より○○円安い」の表示。
 *
 * ★判定はこのコンポーネントでは行わない。★
 *   表示してよいか・どちらが安いかは、すべて価格比較サービス
 *   （src/domain/services/priceComparison.ts）が決めている。
 *   ここは受け取った結果を言葉にするだけ。
 *
 * ★マイナス記号だけで伝えない。★
 *   「国内より安い」のか「国内購入の方が安い」のかを必ず文章で示す。
 *   色（赤・グレー）は補助であって、色だけで意味を伝えない。
 */

import type { ProductView } from '@/data/viewModels'
import { describePriceDifference } from '@/domain/services/priceComparison'
import { formatJpy } from '@/lib/format'

export function PriceGap({ view }: { view: ProductView }) {
  const { comparison } = view
  const described = describePriceDifference(comparison)

  // 比較できないときは、理由をそのまま文章で出す
  if (!described.show) {
    return <p className="price-gap--unavailable">{comparison.statusNote}</p>
  }

  if (described.advantage === 'even') {
    return <p className="price-gap price-gap--even">国内価格とほぼ同じ</p>
  }

  const modifier = described.advantage === 'overseas' ? 'overseas' : 'domestic'

  return (
    <p className={`price-gap price-gap--${modifier}`}>
      {described.prefix}
      <strong className="price-gap__amount">{formatJpy(described.amountJpy)}</strong>
      {described.suffix}
    </p>
  )
}

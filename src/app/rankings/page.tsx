/**
 * 価格差ランキングページ（/rankings/）。
 *
 * ★掲載条件に注意★
 * 海外と国内で「同じ商品」と確認できたものだけを載せる。
 * 商品一致の信頼度が基準未満のものは、repository の listPriceGapRanking() が
 * 自動的に除外する。このページ側で条件を緩めないこと。
 */

import Link from 'next/link'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ProductGrid } from '@/components/product/ProductGrid'
import { listPriceGapRanking } from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

export const metadata = buildPageMetadata({
  title: '価格差ランキング',
  description:
    '日本到着推定額が国内価格より安いサッカーグッズを、差額の大きい順に並べたランキングです。',
  path: '/rankings/',
})

export default async function RankingsPage() {
  const views = await listPriceGapRanking()

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: '価格差ランキング' }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">価格差ランキング</h1>
          <p className="page-lead">
            日本到着推定額が国内価格より安い商品を、差額の大きい順に並べています。
          </p>
        </header>

        <div className="notice">
          <p className="notice__title">このランキングの掲載条件</p>
          <ul>
            <li>海外ストアと国内ストアの両方に取り扱いがあること</li>
            <li>
              海外の商品と国内の商品が同じものだと十分に確認できていること
              （商品コードやメーカー品番の一致など）
            </li>
            <li>日本到着推定額の方が安いこと</li>
          </ul>
          <p style={{ marginTop: 'var(--space-2)' }}>
            同じ商品かどうかを確認できていない組み合わせは、差額が大きく見えても掲載しません。
            サイズ違い・年式違いなど、条件の異なる商品を比べてしまうのを避けるためです。
          </p>
        </div>

        <ProductGrid
          views={views}
          headingLevel="h2"
          emptyMessage="掲載条件を満たす商品が現在ありません。"
          priorityCount={4}
        />

        <p style={{ fontSize: 'var(--text-sm)' }}>
          差額の計算方法は{' '}
          <Link href="/about/#landed-cost" className="text-link">
            日本到着推定額について
          </Link>{' '}
          をご覧ください。
        </p>
      </div>
    </>
  )
}

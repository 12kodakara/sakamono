/**
 * セール情報ページ（/sale/）。
 *
 * 海外公式ストアで値下げ中の商品を、割引率の高い順に並べる。
 */

import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ProductGrid } from '@/components/product/ProductGrid'
import { listSaleProductViews } from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

export async function generateMetadata() {
  const views = await listSaleProductViews()
  return buildPageMetadata({
    title: 'セール情報',
    description:
      '海外クラブ公式ストアで値下げ中のサッカーグッズを、割引率の高い順に紹介します。日本到着推定額つきで比較できます。',
    path: '/sale/',
    // ★値下げ中の商品が1つも無いときは検索に出さない（sitemap と同じ条件）。★
    noindex: views.length === 0,
  })
}

export default async function SalePage() {
  const views = await listSaleProductViews()

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: 'セール情報' }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">セール情報</h1>
          <p className="page-lead">
            海外公式ストアで値下げ中の商品です。割引率の高い順に並べています。
            金額は日本到着推定額（送料・輸入コストの目安を含む推定値）で比較できます。
          </p>
        </header>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {views.length}件の商品が値下げ中です。
        </p>

        <ProductGrid
          views={views}
          headingLevel="h2"
          emptyMessage="現在、値下げ中の商品はありません。"
          priorityCount={4}
        />
      </div>
    </>
  )
}

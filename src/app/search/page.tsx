/**
 * 検索ページ（/search/?q=...）。
 *
 * ビルド時に全商品のデータを埋め込み、絞り込みはブラウザ側で行う。
 * 第1段階は十数件なのでこれで十分。件数が増えたら、
 * 「索引ファイルだけ読み込む」「サーバー検索にする」などへ切り替える。
 */

import { Suspense } from 'react'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { listProductViews } from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'
import { SearchResults } from './SearchResults'

export const metadata = buildPageMetadata({
  title: '商品を検索',
  description: '商品名・クラブ名・選手名からサッカーグッズを検索できます。',
  path: '/search/',
  // 検索結果ページは内容が検索語で変わるため、検索エンジンには登録させない
  noindex: true,
})

export default async function SearchPage() {
  const views = await listProductViews()

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: '商品を検索' }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">商品を検索</h1>
          <p className="page-lead">
            商品名・クラブ名・選手名・シーズンなどから探せます。複数のことばを空白で区切ると、
            すべてを含む商品に絞り込めます。
          </p>
        </header>

        <Suspense fallback={<p className="empty-state">検索結果を準備しています…</p>}>
          <SearchResults views={views} />
        </Suspense>
      </div>
    </>
  )
}

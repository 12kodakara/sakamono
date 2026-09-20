'use client'

/**
 * 検索結果の表示（ブラウザ側で動く部分）。
 *
 * URLの ?q= を読み取り、渡された商品一覧を絞り込む。
 * 絞り込みは純粋関数（lib/search.ts）に任せているので、
 * サンプルデータや取得処理はブラウザへ送られない。
 *
 * useSearchParams() を使うコンポーネントは、
 * 静的サイトとして書き出す都合上 <Suspense> で包む必要がある（page.tsx 側で対応）。
 */

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SearchForm } from '@/components/search/SearchForm'
import type { ProductView } from '@/data/viewModels'
import { searchProductViews } from '@/lib/search'

export function SearchResults({ views }: { views: ProductView[] }) {
  const searchParams = useSearchParams()
  const query = searchParams.get('q') ?? ''

  const results = useMemo(() => searchProductViews(views, query), [views, query])

  return (
    <div className="stack--lg" style={{ display: 'grid' }}>
      <SearchForm
        id="search-page-input"
        defaultValue={query}
        showLabel
        label="商品名・クラブ名・選手名で検索"
      />

      {/* 結果件数の変化を読み上げソフトへ伝える */}
      <p aria-live="polite" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
        {query ? (
          <>
            「{query}」の検索結果: {results.length}件
          </>
        ) : (
          <>すべての商品: {results.length}件</>
        )}
      </p>

      <ProductGrid
        views={results}
        headingLevel="h2"
        emptyMessage="該当する商品が見つかりませんでした。別のことばでお試しください。"
      />
    </div>
  )
}

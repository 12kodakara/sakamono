/**
 * 商品カードを並べるグリッド。
 *
 * 件数が0件のときの表示もここでまとめて面倒を見る。
 * 将来1000件規模になってもよいよう、表示件数を絞る責任は呼び出し側に置き、
 * ここは「渡されたものを並べる」だけにしている
 * （ページングを入れるときもこのコンポーネントは変えずに済む）。
 */

import type { ProductView } from '@/data/viewModels'
import { ProductCard } from './ProductCard'

export interface ProductGridProps {
  views: ProductView[]
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** 0件のときに出す文言。 */
  emptyMessage?: string
  /** 先頭何件の画像を先に読み込むか。 */
  priorityCount?: number
  /** 各カードに販売先（比較に使った海外ストア）の名前を出すか。 */
  showStore?: boolean
}

export function ProductGrid({
  views,
  headingLevel = 'h3',
  emptyMessage = '該当する商品がありません。',
  priorityCount = 0,
  showStore = false,
}: ProductGridProps) {
  if (views.length === 0) {
    return <p className="empty-state">{emptyMessage}</p>
  }

  return (
    <ul className="product-grid">
      {views.map((view, index) => (
        <li key={view.product.id}>
          <ProductCard
            view={view}
            headingLevel={headingLevel}
            priority={index < priorityCount}
            showStore={showStore}
          />
        </li>
      ))}
    </ul>
  )
}

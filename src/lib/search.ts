/**
 * 商品の絞り込み（検索）。
 *
 * データの取得には一切触れない純粋な関数だけを置く。
 * こうしておくと、ブラウザ側（クライアントコンポーネント）から呼んでも
 * サンプルデータや取得処理がブラウザへ送られずに済む。
 *
 * 第1段階の対象は十数件なので単純な部分一致で十分。
 * 件数が増えたら、この関数の中だけを索引方式へ差し替える。
 */

import type { ProductView } from '@/data/viewModels'

/** 検索対象にする文字列を1本につなげる。 */
function buildHaystack(view: ProductView): string {
  return [
    view.product.name,
    view.product.nameJa,
    view.product.season,
    view.product.manufacturer,
    view.product.manufacturerSku ?? '',
    view.product.player ?? '',
    view.club.name,
    view.club.nameJa,
    view.league.name,
    view.league.nameJa,
  ]
    .join(' ')
    .toLowerCase()
}

/**
 * 空白区切りのすべてのキーワードを含む商品だけを返す（AND検索）。
 * 検索語が空のときは、絞り込まずにそのまま返す。
 */
export function searchProductViews(views: ProductView[], query: string): ProductView[] {
  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (keywords.length === 0) return views

  return views.filter((view) => {
    const haystack = buildHaystack(view)
    return keywords.every((keyword) => haystack.includes(keyword))
  })
}

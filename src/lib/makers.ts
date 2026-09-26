/**
 * 掲載商品から「メーカー」の表示を組み立てる。
 *
 * ★クラブページとリーグページで同じものを使うため、ここへ切り出しています。★
 *   同じ内容を2か所に書くと、片方だけ直して食い違う事故が起きます。
 *
 * ★品番を確認できた商品からだけ拾います。★
 *   品番がある＝公式の商品ページと突き合わせ済み、という意味です。
 *   品番の無い商品のメーカー表記（'確認中' やクラブ自身の名前）は、
 *   確かめていない値なので使いません。
 *
 * ★集計（構造）と表示（文字列）を分けています。★
 *   表示文だけを返していると、'・' がメーカーの区切りなのか
 *   シーズンの区切りなのか後から見分けられません
 *   （adidas（2025/26）・Nike（2025/26・2024/25）のような場合）。
 *   数えたい側は summarizeConfirmedMakers、出したい側は formatMakers を使います。
 */

import type { ProductView } from '@/data/viewModels'

/** 1メーカー分の集計。 */
export interface MakerSummary {
  maker: string
  /** そのメーカーの商品があるシーズン（新しい順）。シーズン未設定なら空。 */
  seasons: string[]
}

/** 新しいシーズンを先に並べるための比較（'2025/26' > '2024/25'）。 */
function newestFirst(a: string, b: string): number {
  return b.localeCompare(a)
}

/**
 * 品番を確認できた商品から、メーカーごとのシーズンを集計する。
 * 新しいシーズンを持つメーカーを先に返す。確認できたものが無ければ空配列。
 */
export function summarizeConfirmedMakers(views: ProductView[]): MakerSummary[] {
  const seasonsByMaker = new Map<string, Set<string>>()
  for (const view of views) {
    const { manufacturerSku, manufacturer, season } = view.product
    if (manufacturerSku === null || !manufacturer) continue
    const seasons = seasonsByMaker.get(manufacturer) ?? new Set<string>()
    if (season) seasons.add(season)
    seasonsByMaker.set(manufacturer, seasons)
  }
  return [...seasonsByMaker.entries()]
    .map(([maker, seasons]) => ({ maker, seasons: [...seasons].sort(newestFirst) }))
    .sort((a, b) => newestFirst(a.seasons[0] ?? '', b.seasons[0] ?? ''))
}

/**
 * 集計結果を画面に出す文へ変える。無ければ null。
 *
 * ★2つ以上あるときは、どのシーズンのものかを添えます。★
 *   サプライヤーはシーズンで変わります（リヴァプールは2024/25がNike、2025/26からadidas）。
 *   シーズンを書かずに並べると「このクラブはどっち？」と誤解させてしまい、
 *   前のシーズンの商品を買ってしまう事故につながります。
 *
 * ★1つだけのときはメーカー名だけにします。★（余計な情報を足さない）
 */
export function formatMakers(summaries: MakerSummary[]): string | null {
  if (summaries.length === 0) return null
  if (summaries.length === 1) return summaries[0].maker
  return summaries
    .map(({ maker, seasons }) => (seasons.length > 0 ? `${maker}（${seasons.join('・')}）` : maker))
    .join('・')
}

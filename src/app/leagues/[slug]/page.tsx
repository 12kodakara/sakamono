/**
 * リーグページ（/leagues/premier-league/ など）。
 *
 * 所属クラブ一覧と、そのリーグの商品一覧を表示する雛形。
 * 商品が増えたときは、ここへ絞り込みやページングを足していく。
 */

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ClubCard } from '@/components/club/ClubCard'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  getLeagueBySlug,
  listClubSummaries,
  listLeagues,
  listProductViewsByLeague,
} from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

interface PageProps {
  params: Promise<{ slug: string }>
}

/** 静的に書き出すリーグページのURL一覧。 */
export async function generateStaticParams() {
  const leagues = await listLeagues()
  return leagues.map((league) => ({ slug: league.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const league = await getLeagueBySlug(slug)
  if (!league) {
    return buildPageMetadata({ title: 'リーグが見つかりません', path: `/leagues/${slug}/` })
  }

  return buildPageMetadata({
    title: `${league.nameJa}のクラブ・グッズ価格比較`,
    description: `${league.nameJa}（${league.name}）所属クラブのユニフォーム・グッズを、海外公式ストアの価格と日本到着推定額で比較できます。`,
    path: `/leagues/${league.slug}/`,
  })
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params
  const league = await getLeagueBySlug(slug)
  if (!league) notFound()

  const [clubSummaries, views] = await Promise.all([
    listClubSummaries(league.id),
    listProductViewsByLeague(league.id),
  ])

  return (
    <>
      <div className="container">
        <Breadcrumb
          items={[{ label: 'リーグから探す', href: '/leagues/' }, { label: league.nameJa }]}
        />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">{league.nameJa}</h1>
          <p className="page-lead">
            {league.name}・{league.country}
          </p>
        </header>

        <section className="section" aria-labelledby="league-clubs">
          <SectionHeader id="league-clubs" title="所属クラブ" />
          {clubSummaries.length === 0 ? (
            <p className="empty-state">
              このリーグのクラブは準備中です。順次追加していきます。
            </p>
          ) : (
            <ul className="card-grid">
              {clubSummaries.map((summary) => (
                <li key={summary.club.id}>
                  <ClubCard summary={summary} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="section" aria-labelledby="league-products">
          <SectionHeader
            id="league-products"
            title="取り扱い商品"
            description="海外価格と日本到着推定額を並べて比較できます。"
          />
          <ProductGrid
            views={views}
            emptyMessage="このリーグの商品は準備中です。"
            priorityCount={2}
          />
        </section>
      </div>
    </>
  )
}

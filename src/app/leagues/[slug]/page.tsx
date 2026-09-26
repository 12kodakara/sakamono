/**
 * リーグページ（/leagues/premier-league/ など）。
 *
 * ★リーグから探す人の入口です。★
 *   リーグ → 所属クラブ → 各クラブの商品、と進めるようにしています。
 *
 * 表示する内容は src/lib/leagueProfile.ts が既存データから組み立てます。
 * リーグ名や slug をこのファイルへ直接書かないため、
 * リーグが増えても fixture へ1行足すだけで同じ形になります。
 */

import { Fragment } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ClubCard } from '@/components/club/ClubCard'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  getLeagueBySlug,
  listClubSummaries,
  listLeagueSummaries,
  listLeagues,
  listPriceGapRanking,
  listProductViewsByLeague,
  listSaleProductViews,
} from '@/data/repository'
import { buildLeagueProfile } from '@/lib/leagueProfile'
import { buildPageMetadata } from '@/lib/seo'
import { isLeagueListable } from '@/lib/sitemap'

interface PageProps {
  params: Promise<{ slug: string }>
}

/** 静的に書き出すリーグページのURL一覧。 */
export async function generateStaticParams() {
  const leagues = await listLeagues()
  return leagues.map((league) => ({ slug: league.slug }))
}

/**
 * ページとメタデータで同じ材料を使う。
 * どちらかだけ変えて食い違うことがないよう、1か所にまとめてある。
 */
async function loadProfile(slug: string) {
  const league = await getLeagueBySlug(slug)
  if (!league) return null

  const [summaries, clubSummaries, views, sale, ranking] = await Promise.all([
    listLeagueSummaries(),
    listClubSummaries(league.id),
    listProductViewsByLeague(league.id),
    listSaleProductViews(),
    listPriceGapRanking(),
  ])

  const summary = summaries.find((item) => item.league.id === league.id) ?? null
  const listable = summary
    ? isLeagueListable({
        slug: league.slug,
        clubCount: summary.clubCount,
        productCount: summary.productCount,
      })
    : false

  // 関連リーグは「検索に出している（中身がある）リーグ」だけ。自分は含めない。
  const relatedLeagues = summaries
    .filter((item) => item.league.id !== league.id)
    .filter((item) =>
      isLeagueListable({
        slug: item.league.slug,
        clubCount: item.clubCount,
        productCount: item.productCount,
      }),
    )
    .map((item) => ({ label: item.league.nameJa, href: item.href }))

  const profile = buildLeagueProfile({
    league,
    clubs: clubSummaries.map((item) => ({
      nameJa: item.club.nameJa,
      href: item.href,
      productCount: item.productCount,
    })),
    views,
    relatedLeagues,
    saleCount: sale.length,
    rankingCount: ranking.length,
    kitsIndexHref: '/kits/',
  })

  return { league, clubSummaries, views, profile, listable }
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const loaded = await loadProfile(slug)
  if (!loaded) {
    return buildPageMetadata({
      title: 'リーグが見つかりません',
      path: `/leagues/${slug}/`,
      noindex: true,
    })
  }

  const { league, profile, listable } = loaded
  return buildPageMetadata({
    title: profile.title,
    description: profile.description,
    path: `/leagues/${league.slug}/`,
    // ★所属クラブも商品も無いリーグ（「準備中です」だけ）は検索に出さない。★
    //   sitemap と同じ判定（src/lib/sitemap.ts）を使う。
    noindex: !listable,
  })
}

export default async function LeaguePage({ params }: PageProps) {
  const { slug } = await params
  const loaded = await loadProfile(slug)
  if (!loaded) notFound()

  const { league, clubSummaries, views, profile } = loaded

  return (
    <>
      <div className="container">
        <Breadcrumb
          items={[{ label: 'リーグから探す', href: '/leagues/' }, { label: league.nameJa }]}
        />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">{profile.h1}</h1>
          <p className="page-lead">{profile.lead}</p>
        </header>

        <section className="section" aria-labelledby="league-overview">
          <SectionHeader
            id="league-overview"
            title="リーグの基本情報と、このページで探せるもの"
          />
          <dl className="spec-list">
            {profile.facts.map((fact) => (
              <Fragment key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.href ? <Link href={fact.href}>{fact.value}</Link> : fact.value}</dd>
              </Fragment>
            ))}
          </dl>
        </section>

        <section className="section" aria-labelledby="league-clubs">
          <SectionHeader
            id="league-clubs"
            title="所属クラブ"
            description={
              profile.totalClubs > 0
                ? 'クラブページから、そのクラブの商品を種類ごとに探せます。'
                : undefined
            }
          />
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
          <SectionHeader id="league-products" title="取り扱い商品" description={profile.productsNote} />
          <ProductGrid
            views={views}
            emptyMessage="このリーグの商品は準備中です。"
            priorityCount={2}
          />
        </section>

        <section className="section" aria-labelledby="league-related">
          <SectionHeader id="league-related" title="関連ページ" />
          <ul className="reason-list">
            {profile.related.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  )
}

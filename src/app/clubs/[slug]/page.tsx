/**
 * クラブページ（/clubs/liverpool/ など）。
 *
 * 並び:
 *   クラブ名 → 基本情報と探せるもの → セール商品 → カテゴリごとの商品
 *   → ユニフォームを種類から探す → 購入先の確かめ方 → 関連ページ
 *
 * クラブ名の下の固有情報は、全クラブ共通の仕組み（src/lib/clubProfile.ts）が
 * 既存データから組み立てる。データが無い行・セクションは出さない。
 *
 * カテゴリは商品データから自動で組み立てるので、
 * 将来 Jackets / Hoodies / Caps などが増えても、このページは書き換え不要。
 */

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ClubProfileGuide, ClubProfileOverview } from '@/components/club/ClubProfileSections'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  getClubBySlug,
  groupProductViewsByCategory,
  listClubSummaries,
  listLeagues,
  listPriceGapRanking,
  listProductViews,
  listProductViewsByClub,
  listSaleProductViews,
} from '@/data/repository'
import type { Club } from '@/domain/types'
import { buildClubProfile, type ClubProfile } from '@/lib/clubProfile'
import { buildKitsIndex } from '@/lib/kits'
import { CATEGORY_LABEL } from '@/lib/labels'
import { buildPageMetadata } from '@/lib/seo'
import { isClubListable, isKitsIndexListable } from '@/lib/sitemap'

/** クラブ固有情報（全クラブ共通の組み立て方。中身は既存データだけ）。 */
async function loadClubProfile(club: Club): Promise<ClubProfile> {
  const [leagues, views, summaries, sale, ranking, allViews] = await Promise.all([
    listLeagues(),
    listProductViewsByClub(club.id),
    listClubSummaries(club.leagueId),
    listSaleProductViews(),
    listPriceGapRanking(),
    listProductViews(),
  ])
  const kitsIndex = buildKitsIndex(allViews)

  return buildClubProfile({
    club,
    league: leagues.find((item) => item.id === club.leagueId) ?? null,
    views,
    // 同じリーグで、検索に出しているクラブだけ（sitemap と同じ判定）
    relatedClubs: summaries
      .filter((summary) => summary.club.id !== club.id)
      .filter((summary) => isClubListable({ slug: summary.club.slug, productCount: summary.productCount }))
      .map((summary) => ({ nameJa: summary.club.nameJa, href: summary.href })),
    saleCount: sale.length,
    rankingCount: ranking.length,
    // ユニフォーム一覧は、検索に出しているときだけリンクする（sitemap と同じ判定）
    kitsIndexHref: isKitsIndexListable({
      kitCount: kitsIndex.kits.length,
      clubCount: kitsIndex.clubs.length,
    })
      ? '/kits/'
      : null,
  })
}

interface PageProps {
  params: Promise<{ slug: string }>
}

/** 静的に書き出すクラブページのURL一覧。クラブが増えれば自動で増える。 */
export async function generateStaticParams() {
  const summaries = await listClubSummaries()
  return summaries.map((summary) => ({ slug: summary.club.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  if (!club) {
    return buildPageMetadata({
      title: 'クラブが見つかりません',
      path: `/clubs/${slug}/`,
      noindex: true,
    })
  }

  const summary = (await listClubSummaries()).find((item) => item.club.id === club.id)
  const profile = await loadClubProfile(club)

  return buildPageMetadata({
    title: profile.title,
    description: profile.description,
    path: `/clubs/${club.slug}/`,
    // ★商品が1つも無いクラブは検索に出さない（sitemap と同じ判定）。★
    noindex: summary
      ? !isClubListable({ slug: club.slug, productCount: summary.productCount })
      : true,
  })
}

export default async function ClubPage({ params }: PageProps) {
  const { slug } = await params
  const club = await getClubBySlug(slug)
  if (!club) notFound()

  const leagues = await listLeagues()
  const league = leagues.find((item) => item.id === club.leagueId)

  const views = await listProductViewsByClub(club.id)
  // セールかどうかの判定は evaluateDiscount()（サービス層）が済ませている
  const saleViews = views.filter((view) => view.overseas?.discount.isSale === true)
  const groups = await groupProductViewsByCategory(views)
  const profile = await loadClubProfile(club)

  return (
    <>
      <div className="container">
        <Breadcrumb
          items={[
            { label: 'クラブから探す', href: '/clubs/' },
            ...(league ? [{ label: league.nameJa, href: `/leagues/${league.slug}/` }] : []),
            { label: club.nameJa },
          ]}
        />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">{profile.h1}</h1>
          <p className="page-lead">
            {club.name}
            {profile.altNameJa ? `（${profile.altNameJa}とも表記）` : ''}
            {league ? `・${league.nameJa}` : ''}
            {club.country ? `・${club.country}` : ''}
          </p>
        </header>

        <ClubProfileOverview profile={profile} />

        {/* ===== セール商品 =====
            値下げ中の商品が無ければ見出しごと出さない
            （「ありません」だけの空セクションを作らないため）。 */}
        {saleViews.length > 0 ? (
          <section className="section" aria-labelledby="club-sale">
            <SectionHeader
              id="club-sale"
              title="セール商品"
              description="海外公式ストアで値下げ中の商品です。"
            />
            <ProductGrid
              views={saleViews}
              emptyMessage="現在、値下げ中の商品はありません。"
              priorityCount={2}
            />
          </section>
        ) : null}

        {/* ===== カテゴリごとの商品 ===== */}
        {groups.map((group) => (
          <section className="section" key={group.category} aria-labelledby={`cat-${group.category}`}>
            <SectionHeader id={`cat-${group.category}`} title={CATEGORY_LABEL[group.category]} />
            <ProductGrid views={group.views} />
          </section>
        ))}

        {groups.length === 0 ? (
          <p className="empty-state">
            このクラブの商品は準備中です。取り扱いを確認でき次第、順次追加していきます。
          </p>
        ) : null}

        <ClubProfileGuide clubNameJa={club.nameJa} profile={profile} />

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {club.nameJa}の名称・エンブレムは同クラブの商標です。サカモノは同クラブとは提携していません。
        </p>
      </div>
    </>
  )
}

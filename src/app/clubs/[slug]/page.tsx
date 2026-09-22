/**
 * クラブページ（/clubs/liverpool/ など）。
 *
 * 並び:
 *   クラブ名 → セール商品 → カテゴリごとの商品
 *
 * カテゴリは商品データから自動で組み立てるので、
 * 将来 Jackets / Hoodies / Caps などが増えても、このページは書き換え不要。
 */

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  getClubBySlug,
  groupProductViewsByCategory,
  listClubSummaries,
  listLeagues,
  listProductViewsByClub,
} from '@/data/repository'
import { CATEGORY_LABEL } from '@/lib/labels'
import { buildPageMetadata } from '@/lib/seo'
import { isClubListable } from '@/lib/sitemap'

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

  return buildPageMetadata({
    title: `${club.nameJa}のグッズ価格比較`,
    description: `${club.nameJa}（${club.name}）のユニフォーム・グッズを、海外公式ストアの価格と日本到着推定額で比較できます。`,
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
          <h1 className="page-title">{club.nameJa}</h1>
          <p className="page-lead">
            {club.name}
            {league ? `・${league.nameJa}` : ''}・{club.country}
          </p>
        </header>

        {/* ===== セール商品 ===== */}
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

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {club.nameJa}の名称・エンブレムは同クラブの商標です。サカモノは同クラブとは提携していません。
        </p>
      </div>
    </>
  )
}

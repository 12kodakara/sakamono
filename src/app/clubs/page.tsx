/**
 * クラブ一覧ページ（/clubs/）。
 *
 * 第1段階で表示するのは4クラブだけだが、
 * リーグごとに区切って並べる作りにしてあるので、
 * 約100クラブへ増えてもそのまま使える。
 */

import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ClubCard } from '@/components/club/ClubCard'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { listClubSummaries, listLeagues } from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

export const metadata = buildPageMetadata({
  title: 'クラブから探す',
  description:
    'サカモノで価格を比較できるクラブの一覧です。クラブを選ぶと、そのクラブのユニフォームやグッズを日本到着推定額つきで確認できます。',
  path: '/clubs/',
})

export default async function ClubsPage() {
  const [leagues, clubSummaries] = await Promise.all([listLeagues(), listClubSummaries()])

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: 'クラブから探す' }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">クラブから探す</h1>
          <p className="page-lead">
            クラブを選ぶと、そのクラブの商品を日本到着推定額つきで比較できます。
          </p>
        </header>

        {leagues.map((league) => {
          const clubs = clubSummaries.filter((summary) => summary.league.id === league.id)

          return (
            <section className="section" key={league.id} aria-labelledby={`league-${league.slug}`}>
              <SectionHeader
                id={`league-${league.slug}`}
                title={league.nameJa}
                description={`${league.name}（${league.country}）`}
                moreHref={`/leagues/${league.slug}/`}
                moreLabel="リーグページ"
              />

              {clubs.length === 0 ? (
                <p className="empty-state">
                  このリーグのクラブは準備中です。順次追加していきます。
                </p>
              ) : (
                <ul className="card-grid">
                  {clubs.map((summary) => (
                    <li key={summary.club.id}>
                      <ClubCard summary={summary} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </>
  )
}

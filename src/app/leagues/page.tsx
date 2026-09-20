/**
 * リーグ一覧ページ（/leagues/）。
 *
 * 表示するのは、データ側で active になっているリーグだけ。
 * Bundesliga は現段階では対象外のため、そもそもデータに含めていない
 * （src/data/fixtures/leagues.ts を参照）。
 */

import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { LeagueCard } from '@/components/league/LeagueCard'
import { listLeagueSummaries } from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

export const metadata = buildPageMetadata({
  title: 'リーグから探す',
  description:
    'サカモノが対応しているリーグの一覧です。リーグを選ぶと、所属クラブと取り扱い商品を確認できます。',
  path: '/leagues/',
})

export default async function LeaguesPage() {
  const summaries = await listLeagueSummaries()

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: 'リーグから探す' }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">リーグから探す</h1>
          <p className="page-lead">
            リーグを選ぶと、所属クラブと取り扱い商品を確認できます。対応リーグは順次増やしていきます。
          </p>
        </header>

        <ul className="card-grid">
          {summaries.map((summary) => (
            <li key={summary.league.id}>
              <LeagueCard summary={summary} />
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          リーグ名は各リーグ運営団体の商標です。ロゴ画像は利用条件の確認が済むまで掲載していません。
        </p>
      </div>
    </>
  )
}

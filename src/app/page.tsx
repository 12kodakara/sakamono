/**
 * トップページ。
 *
 * 構成:
 *   1. ファーストビュー（メインコピー＋検索）
 *   2. リーグから探す
 *   3. 今日の注目セール
 *   4. サカモノの特徴
 *   5. 人気クラブ
 *
 * データはすべて repository 経由で取得する。
 * このファイルの中で価格を計算したり、fixtureを直接読んだりしない。
 */

import Link from 'next/link'
import { ClubCard } from '@/components/club/ClubCard'
import { LeagueCard } from '@/components/league/LeagueCard'
import { ProductGrid } from '@/components/product/ProductGrid'
import { SearchForm } from '@/components/search/SearchForm'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  listClubSummaries,
  listLeagueSummaries,
  listSaleProductViews,
} from '@/data/repository'
import { buildPageMetadata } from '@/lib/seo'

export const metadata = buildPageMetadata({ path: '/' })

/** サカモノの特徴（4つに絞る）。 */
const FEATURES = [
  {
    title: '日本までの総額で比較',
    body: '商品代金だけでなく、国際送料・輸入コスト・決済関連コストの目安を含めた「日本到着推定額」で比べられます。',
  },
  {
    title: '日本円で分かりやすく',
    body: 'ポンドやユーロの価格を日本円に換算して表示します。為替の計算を自分でしなくても、おおよその負担が分かります。',
  },
  {
    title: '価格履歴',
    body: '価格を確認するたびに記録を残します。いまの価格が過去と比べて安いのかを判断する材料になります。',
  },
  {
    title: '正規販売元を重視',
    body: '海外クラブの公式ストアと、確認できた国内の販売元を中心に比較します。出どころのはっきりした情報を優先します。',
  },
]

export default async function HomePage() {
  const [leagueSummaries, clubSummaries, saleViews] = await Promise.all([
    listLeagueSummaries(),
    listClubSummaries(),
    listSaleProductViews(4),
  ])

  return (
    <>
      {/* ===== ファーストビュー ===== */}
      <section className="hero" aria-labelledby="hero-title">
        <div className="container">
          <h1 className="hero__title" id="hero-title">
            世界のサッカーグッズを、もっと身近に。
          </h1>
          <p className="hero__lead">海外公式ストアの商品を、日本までの総額で比較。</p>
          <SearchForm id="hero-search" />
        </div>
      </section>

      <div className="container page-body stack--lg">
        {/* ===== リーグから探す ===== */}
        <section className="section" aria-labelledby="leagues-title">
          <SectionHeader
            id="leagues-title"
            title="リーグから探す"
            moreHref="/leagues/"
            moreLabel="リーグ一覧"
          />
          <ul className="card-grid">
            {leagueSummaries.map((summary) => (
              <li key={summary.league.id}>
                <LeagueCard summary={summary} />
              </li>
            ))}
          </ul>
        </section>

        {/* ===== 今日の注目セール ===== */}
        <section className="section" aria-labelledby="sale-title">
          <SectionHeader
            id="sale-title"
            title="今日の注目セール"
            description="海外公式ストアで値下げ中の商品です。金額は日本到着推定額で比較しています。"
            moreHref="/sale/"
          />
          <ProductGrid
            views={saleViews}
            emptyMessage="現在、値下げ中の商品はありません。"
            priorityCount={2}
          />
        </section>

        {/* ===== サカモノの特徴 ===== */}
        <section className="section" aria-labelledby="features-title">
          <SectionHeader id="features-title" title="サカモノの特徴" />
          <ul className="feature-grid">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="feature">
                <h3 className="feature__title">{feature.title}</h3>
                <p className="feature__body">{feature.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ===== 人気クラブ ===== */}
        <section className="section" aria-labelledby="clubs-title">
          <SectionHeader
            id="clubs-title"
            title="人気クラブ"
            moreHref="/clubs/"
            moreLabel="クラブ一覧"
          />
          <ul className="card-grid">
            {clubSummaries.map((summary) => (
              <li key={summary.club.id}>
                <ClubCard summary={summary} />
              </li>
            ))}
          </ul>
        </section>

        <p style={{ fontSize: 'var(--text-sm)' }}>
          日本到着推定額の考え方は{' '}
          <Link href="/about/#landed-cost" className="text-link">
            このサイトについて
          </Link>{' '}
          で説明しています。
        </p>
      </div>
    </>
  )
}

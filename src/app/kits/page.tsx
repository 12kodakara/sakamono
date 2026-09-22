/**
 * 全クラブ横断のユニフォーム一覧（/kits/）。
 *
 * 並び:
 *   見出し → クラブごとの掲載ユニフォーム → ユニフォーム一覧（絞り込み・並び替え）
 *   → 価格の見方 → 関連ページ
 *
 * ★クラブページとの役割分担★
 *   クラブページは「1つのクラブのユニフォーム・グッズ・購入先」、
 *   このページは「複数のクラブのユニフォームを横断して探す」入口です。
 *   中身は src/lib/kits.ts が既存データから組み立てます。
 *
 * ★絞り込みの条件ごとのURLは作りません★（src/components/kits/KitsBrowser.tsx）。
 *   canonical・sitemap に出るのは /kits/ の1つだけです。
 */

import Link from 'next/link'
import { Fragment } from 'react'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { KitsBrowser } from '@/components/kits/KitsBrowser'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { listPriceGapRanking, listProductViews, listSaleProductViews } from '@/data/repository'
import { buildKitsIndex } from '@/lib/kits'
import { buildPageMetadata } from '@/lib/seo'
import { isKitsIndexListable } from '@/lib/sitemap'

async function loadKitsIndex() {
  return buildKitsIndex(await listProductViews())
}

export async function generateMetadata() {
  const index = await loadKitsIndex()
  return buildPageMetadata({
    title: index.title,
    description: index.description,
    path: '/kits/',
    // ★ユニフォームのあるクラブが2つ未満なら検索に出さない（sitemap と同じ判定）。★
    noindex: !isKitsIndexListable({ kitCount: index.kits.length, clubCount: index.clubs.length }),
  })
}

export default async function KitsPage() {
  const [index, sale, ranking] = await Promise.all([
    loadKitsIndex(),
    listSaleProductViews(),
    listPriceGapRanking(),
  ])
  const hasMissingPrice = index.kits.some(
    (view) => view.overseas === null && view.comparison.domesticPrice.reference === null,
  )

  const related = [
    { label: 'クラブから探す', href: '/clubs/' },
    { label: 'リーグから探す', href: '/leagues/' },
    ...(sale.length > 0 ? [{ label: 'セール中の商品（ユニフォーム以外も含む）', href: '/sale/' }] : []),
    ...(ranking.length > 0 ? [{ label: '海外の方が安い商品のランキング', href: '/rankings/' }] : []),
  ]

  return (
    <>
      <div className="container">
        <Breadcrumb items={[{ label: index.h1 }]} />
      </div>

      <div className="container page-body stack--lg">
        <header>
          <h1 className="page-title">{index.h1}</h1>
          <p className="page-lead">{index.lead}</p>
        </header>

        {index.clubs.length > 0 ? (
          <section className="section" aria-labelledby="kits-clubs">
            <SectionHeader
              id="kits-clubs"
              title="クラブごとの掲載ユニフォーム"
              description="クラブ名から、そのクラブのユニフォーム・グッズ・購入先をまとめたページへ移動できます。"
            />
            <dl className="spec-list">
              {index.clubs.map((club) => (
                <Fragment key={club.href}>
                  <dt>
                    <Link href={club.href}>{club.nameJa}</Link>
                  </dt>
                  <dd>
                    {club.leagueNameJa}・{club.count}点（{club.kitTypes.join('・')}
                    {club.seasons.length > 0 ? `／${club.seasons.join('・')}` : ''}）
                  </dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ) : null}

        <section className="section" aria-labelledby="kits-list">
          <SectionHeader
            id="kits-list"
            title="ユニフォーム一覧"
            description={
              index.kitTypeCounts.length > 0
                ? `種類別の掲載数：${index.kitTypeCounts.map((entry) => `${entry.label} ${entry.count}点`).join('・')}`
                : undefined
            }
          />
          {index.kits.length > 0 ? (
            <KitsBrowser kits={index.kits} />
          ) : (
            <p className="empty-state">ユニフォームは準備中です。取り扱いを確認でき次第、順次追加していきます。</p>
          )}
        </section>

        {index.hasOverseasPrice || index.hasDomesticPrice ? (
          <section className="section" aria-labelledby="kits-price">
            <SectionHeader id="kits-price" title="価格の見方" />
            {index.hasOverseasPrice ? (
              <p>
                海外ストアの価格がある商品には、国際送料と関税・消費税の目安を足した
                「日本到着推定額」を表示しています。計算の考え方は
                <Link href="/about/#landed-cost">日本到着推定額について</Link>
                で説明しています。
              </p>
            ) : null}
            {hasMissingPrice ? (
              <p>価格を確認できていない商品もあります。その商品のカードには価格の代わりにその旨を表示しています。</p>
            ) : null}
            <p>購入前には、必ず販売元のページで最終的な支払額をご確認ください。</p>
          </section>
        ) : null}

        <section className="section" aria-labelledby="kits-related">
          <SectionHeader id="kits-related" title="関連ページ" />
          <ul className="reason-list">
            {related.map((link) => (
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

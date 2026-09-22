/**
 * クラブページに足す「そのクラブだけの情報」。
 *
 * 中身は src/lib/clubProfile.ts が既存データから組み立てます。
 * ここは並べて見せるだけです。
 *
 * ★データが無い項目は、行ごと・セクションごと出しません。★
 *   「0点」「確認中」だけの行や、中身の無い見出しを作らないためです。
 *
 * ★見た目は既存の部品だけで作っています（新しいCSSは足していません）。★
 *   section / SectionHeader / spec-list / reason-list
 */

import Link from 'next/link'
import { Fragment } from 'react'
import { SectionHeader } from '@/components/ui/SectionHeader'
import type { ClubProfile } from '@/lib/clubProfile'

/**
 * ページ上部：クラブの基本情報と、このページで探せるものの内訳。
 *
 * 商品一覧の前に置くので、短く保っています。
 * 細かい一覧（ユニフォームの種類別など）はページ下部の ClubProfileGuide です。
 */
export function ClubProfileOverview({ profile }: { profile: ClubProfile }) {
  return (
    <section className="section" aria-labelledby="club-overview">
      <SectionHeader id="club-overview" title="クラブの基本情報と、このページで探せるもの" />
      <dl className="spec-list">
        {profile.facts.map((fact) => (
          <Fragment key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>
              {fact.href && fact.external ? (
                <a href={fact.href} target="_blank" rel="noopener">
                  {fact.value}
                  <span className="visually-hidden">（新しいタブで開きます）</span>
                </a>
              ) : fact.href ? (
                <Link href={fact.href}>{fact.value}</Link>
              ) : (
                fact.value
              )}
            </dd>
          </Fragment>
        ))}
        {profile.totalProducts > 0 ? (
          <>
            <dt>掲載商品</dt>
            <dd>
              {profile.totalProducts}点（
              {profile.categories.map((category, index) => (
                <span key={category.href}>
                  {index > 0 ? '・' : ''}
                  <a href={category.href}>{category.label}</a> {category.count}点
                </span>
              ))}
              ）
            </dd>
          </>
        ) : null}
        {profile.seasons.length > 0 ? (
          <>
            <dt>シーズン</dt>
            <dd>{profile.seasons.join('・')}</dd>
          </>
        ) : null}
      </dl>
    </section>
  )
}

/**
 * ページ下部：ユニフォームの種類別の一覧、購入先の確かめ方、関連ページ。
 */
export function ClubProfileGuide({ clubNameJa, profile }: { clubNameJa: string; profile: ClubProfile }) {
  const showWhereToBuy =
    profile.hasOverseasPrice || profile.hasDomesticPrice || profile.officialStoreUrl !== null

  return (
    <>
      {profile.kitGroups.length > 0 ? (
        <section className="section" aria-labelledby="club-kit-types">
          <SectionHeader
            id="club-kit-types"
            title="ユニフォームを種類から探す"
            description={profile.kitGuideNote ?? undefined}
          />
          <dl className="spec-list">
            {profile.kitGroups.map((group) => (
              <Fragment key={group.kitType}>
                <dt>{group.label}</dt>
                <dd>
                  <ul className="reason-list">
                    {group.items.map((item) => (
                      <li key={item.href}>
                        <Link href={item.href}>{item.label}</Link>
                      </li>
                    ))}
                  </ul>
                </dd>
              </Fragment>
            ))}
          </dl>
        </section>
      ) : null}

      {showWhereToBuy ? (
        <section className="section" aria-labelledby="club-where-to-buy">
          <SectionHeader id="club-where-to-buy" title="購入先の確かめ方" />
          {profile.hasOverseasPrice ? (
            <p>
              各商品のページでは、海外公式ストアの価格に国際送料と関税・消費税の目安を足した
              「日本到着推定額」
              {profile.hasDomesticPrice
                ? 'と、日本国内で販売されている価格を並べて比べられます。'
                : 'を確認できます。'}
              計算の考え方は<Link href="/about/#landed-cost">日本到着推定額について</Link>
              で説明しています。
            </p>
          ) : profile.hasDomesticPrice ? (
            <p>各商品のページで、日本国内で販売されている価格を確認できます。</p>
          ) : null}
          {profile.officialStoreUrl ? (
            <p>
              {clubNameJa}の公式オンラインストアは{' '}
              <a href={profile.officialStoreUrl} target="_blank" rel="noopener">
                {new URL(profile.officialStoreUrl).host}
                <span className="visually-hidden">（新しいタブで開きます）</span>
              </a>{' '}
              です。購入前には、必ず販売元のページで最終的な支払額をご確認ください。
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="section" aria-labelledby="club-related">
        <SectionHeader id="club-related" title="関連ページ" />
        <ul className="reason-list">
          {profile.related.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}

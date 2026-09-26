/**
 * リーグページの固有情報（src/lib/leagueProfile.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・全リーグで、既存データだけから組み立てる（リーグごとの手書きの文章は無い）
 *   ・無いものを名乗らない（商品が無いのに「ユニフォーム」、価格が無いのに「比較できます」）
 *   ・メーカーは品番を確認できた商品からだけ
 *   ・リンク先は実在するページだけ／自分自身へは張らない
 *   ・キーワードを詰め込まない（title・description が長すぎない）
 *
 * ★リーグ名を書いて通すテストにしません。★
 *   ブンデスリーガなどが増えても、そのまま検査対象に入るようにしています。
 */

import { describe, expect, it } from 'vitest'
import { buildLeagueProfile } from '@/lib/leagueProfile'
import { formatMakers, summarizeConfirmedMakers } from '@/lib/makers'
import { isLeagueListable } from '@/lib/sitemap'
import {
  listClubSummaries,
  listLeagueSummaries,
  listPriceGapRanking,
  listProductViews,
  listProductViewsByLeague,
  listSaleProductViews,
} from '@/data/repository'
import type { League } from '@/domain/types'

/** ページ（src/app/leagues/[slug]/page.tsx）と同じ入力で組み立てる。 */
async function pageProfile(league: League) {
  const [summaries, clubSummaries, views, sale, ranking] = await Promise.all([
    listLeagueSummaries(),
    listClubSummaries(league.id),
    listProductViewsByLeague(league.id),
    listSaleProductViews(),
    listPriceGapRanking(),
  ])
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

  return {
    league,
    views,
    clubSummaries,
    profile: buildLeagueProfile({
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
    }),
  }
}

async function allLeagueProfiles() {
  const summaries = await listLeagueSummaries()
  return Promise.all(summaries.map((summary) => pageProfile(summary.league)))
}

async function existingPaths() {
  const [products, clubs, leagues] = await Promise.all([
    listProductViews(),
    listClubSummaries(),
    listLeagueSummaries(),
  ])
  return new Set([
    '/clubs/',
    '/leagues/',
    '/kits/',
    '/sale/',
    '/rankings/',
    '/about/',
    ...products.map((view) => view.href),
    ...clubs.map((summary) => summary.href),
    ...leagues.map((summary) => summary.href),
  ])
}

describe('★全リーグへの展開★', () => {
  it('どのリーグでも、既存データだけから組み立てられる', async () => {
    const all = await allLeagueProfiles()
    expect(all.length).toBeGreaterThanOrEqual(5)
    for (const { profile, league } of all) {
      expect(profile.title.length, league.slug).toBeGreaterThan(0)
      expect(profile.description.length, league.slug).toBeGreaterThan(0)
      expect(profile.h1, league.slug).toContain(league.nameJa)
      // 英語表記と国は fixture の値そのまま
      expect(profile.facts.find((fact) => fact.label === '英語表記')?.value).toBe(league.name)
      expect(profile.facts.find((fact) => fact.label === '国')?.value).toBe(league.country)
    }
  })

  it('★title・description はリーグごとに違う（同じ文章を並べない）★', async () => {
    const all = await allLeagueProfiles()
    const titles = all.map((item) => item.profile.title)
    const descriptions = all.map((item) => item.profile.description)
    expect(new Set(titles).size).toBe(titles.length)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('title・description は詰め込みすぎない長さ', async () => {
    for (const { profile, league } of await allLeagueProfiles()) {
      expect([...profile.title].length, league.slug).toBeLessThanOrEqual(40)
      expect([...profile.description].length, league.slug).toBeLessThanOrEqual(120)
    }
  })

  it('★無い商品を名乗らない★', async () => {
    for (const { profile, views, league } of await allLeagueProfiles()) {
      const hasKits = views.some((view) => view.product.category === 'kits')
      const hasGoods = views.some((view) => view.product.category !== 'kits')
      if (!hasKits) {
        expect(profile.title, league.slug).not.toContain('ユニフォーム')
        expect(profile.h1, league.slug).not.toContain('ユニフォーム')
      }
      if (!hasGoods) expect(profile.title, league.slug).not.toContain('グッズ')
      expect(profile.totalProducts).toBe(views.length)
    }
  })

  it('★価格が無いのに「比較できます」と言わない★', async () => {
    for (const { profile, league } of await allLeagueProfiles()) {
      if (!profile.hasOverseasPrice && !profile.hasDomesticPrice) {
        expect(profile.description, league.slug).not.toContain('比べられます')
        expect(profile.description, league.slug).not.toContain('比較')
        expect(profile.productsNote, league.slug).not.toContain('比較できます')
        expect(profile.title, league.slug).not.toContain('価格比較')
      }
    }
  })

  it('★メーカーは、品番を確認できた商品のものだけ★', async () => {
    for (const { profile, views, league } of await allLeagueProfiles()) {
      const row = profile.facts.find((fact) => fact.label === 'メーカー')
      const summaries = summarizeConfirmedMakers(views)
      if (summaries.length === 0) {
        expect(row, '確認できたメーカーが無ければ欄を出さない').toBeUndefined()
        continue
      }
      expect(row, '確認できたメーカーがあれば欄を出す').toBeDefined()
      // 表示文は共通の組み立て（src/lib/makers.ts）と一致すること
      expect(row!.value).toBe(formatMakers(summaries))
      // 品番の無い商品のメーカー表記を持ち込んでいないこと
      const allowed = new Set(summaries.map((entry) => entry.maker))
      const unconfirmed = views
        .filter((view) => view.product.manufacturerSku === null)
        .map((view) => view.product.manufacturer)
        .filter((maker) => !allowed.has(maker))
      for (const maker of unconfirmed) expect(row!.value).not.toContain(maker)
    }
  })

  it('★関連ページは実在し、自分自身へは張らない★', async () => {
    const existing = await existingPaths()
    for (const { profile, league } of await allLeagueProfiles()) {
      const hrefs = profile.related.map((link) => link.href)
      for (const href of hrefs) expect(existing.has(href), `${league.slug}: ${href}`).toBe(true)
      expect(hrefs).not.toContain(`/leagues/${league.slug}/`)
      expect(new Set(hrefs).size, `${league.slug}: 重複`).toBe(hrefs.length)
      // クラブ一覧とリーグ一覧へはいつでも戻れる
      expect(hrefs).toContain('/clubs/')
      expect(hrefs).toContain('/leagues/')
    }
  })

  it('★リーグ → クラブ → 商品 の順にたどれる★', async () => {
    for (const { profile, clubSummaries, views, league } of await allLeagueProfiles()) {
      expect(profile.totalClubs).toBe(clubSummaries.length)
      // このリーグの商品は、すべてこのリーグのクラブのもの
      const clubIds = new Set(clubSummaries.map((summary) => summary.club.id))
      for (const view of views) expect(clubIds.has(view.club.id), view.product.id).toBe(true)
      // クラブの商品数の合計が、リーグの商品数と一致する
      const sum = clubSummaries.reduce((total, summary) => total + summary.productCount, 0)
      expect(sum, league.slug).toBe(views.length)
    }
  })

  it('★仮のURL（example.com）へリンクしない★', async () => {
    for (const { profile } of await allLeagueProfiles()) {
      expect(JSON.stringify(profile)).not.toContain('example.com')
    }
  })
})

describe('クラブも商品も無いリーグ', () => {
  const emptyLeague: League = {
    id: 'league-test',
    slug: 'test-league',
    name: 'Test League',
    nameJa: 'テストリーグ',
    country: 'テスト国',
    displayOrder: 99,
    active: true,
  }

  function emptyProfile() {
    return buildLeagueProfile({
      league: emptyLeague,
      clubs: [],
      views: [],
      relatedLeagues: [],
      saleCount: 0,
      rankingCount: 0,
      kitsIndexHref: '/kits/',
    })
  }

  it('準備中と正直に書き、商品があるように見せない', () => {
    const profile = emptyProfile()
    expect(profile.totalClubs).toBe(0)
    expect(profile.totalProducts).toBe(0)
    expect(profile.description).toContain('準備中')
    expect(profile.title).not.toContain('価格比較')
    expect(profile.h1).toBe('テストリーグ')
  })

  it('中身の無い行を作らない', () => {
    const profile = emptyProfile()
    // 掲載クラブ・掲載商品・メーカー・シーズン・種類は出さない（0件なので）
    for (const label of ['掲載クラブ', '掲載商品', 'メーカー', 'シーズン', 'ユニフォームの種類']) {
      expect(profile.facts.find((fact) => fact.label === label), label).toBeUndefined()
    }
    expect(profile.categories).toEqual([])
    expect(profile.kitTypes).toEqual([])
    expect(profile.seasons).toEqual([])
  })

  it('セール・ランキングが0件なら、その導線を出さない', () => {
    const hrefs = emptyProfile().related.map((link) => link.href)
    expect(hrefs).not.toContain('/sale/')
    expect(hrefs).not.toContain('/rankings/')
    // ユニフォームが無いので、ユニフォーム一覧へも誘導しない
    expect(hrefs).not.toContain('/kits/')
  })
})

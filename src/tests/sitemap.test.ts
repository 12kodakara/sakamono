/**
 * sitemap に載せるURLの選び方のテスト。
 *
 * ★守りたいこと★
 *   ・中身の無いページ（準備中のリーグ、価格が1つも無い商品）を申告しない
 *   ・検索ページやクエリ付きURLを載せない
 *   ・同じURLを2回載せない
 *   ・URLの形を canonical とそろえる（https・末尾スラッシュ）
 *   ・実データから作ったとき、主要ページがちゃんと入っている
 */

import { describe, expect, it } from 'vitest'
import {
  buildSitemapEntries,
  isClubListable,
  isLeagueListable,
  isProductListable,
  toSitemapUrl,
  type SitemapInput,
} from '@/lib/sitemap'
import {
  listClubSummaries,
  listLeagueSummaries,
  listPriceGapRanking,
  listProductViews,
  listSaleProductViews,
} from '@/data/repository'
import { normalizePath } from '@/lib/seo'

const SITE = 'https://12kodakara.github.io/sakamono'

function input(overrides: Partial<SitemapInput> = {}): SitemapInput {
  return {
    siteUrl: SITE,
    leagues: [{ slug: 'premier-league', clubCount: 2, productCount: 5 }],
    clubs: [{ slug: 'liverpool', productCount: 5 }],
    products: [
      { href: '/products/liverpool-home/', hasOverseasPrice: true, hasDomesticPrice: true },
    ],
    saleCount: 1,
    rankingCount: 1,
    ...overrides,
  }
}

/* ============================================================
 * URLの形
 * ========================================================== */

describe('URLの正規化', () => {
  it('末尾スラッシュを付け、canonical と同じ形にする', () => {
    expect(toSitemapUrl(SITE, '/clubs/liverpool')).toBe(`${SITE}/clubs/liverpool/`)
    expect(toSitemapUrl(SITE, '/clubs/liverpool/')).toBe(`${SITE}/clubs/liverpool/`)
    // canonical の作り方（src/lib/seo.ts）と完全に一致すること
    expect(toSitemapUrl(SITE, '/clubs/liverpool')).toBe(`${SITE}${normalizePath('/clubs/liverpool')}`)
  })

  it('トップは末尾スラッシュ1つだけ', () => {
    expect(toSitemapUrl(SITE, '/')).toBe(`${SITE}/`)
    expect(toSitemapUrl(SITE, '')).toBe(`${SITE}/`)
  })

  it('★siteUrl の末尾スラッシュで // を作らない★', () => {
    expect(toSitemapUrl(`${SITE}/`, '/about/')).toBe(`${SITE}/about/`)
    expect(toSitemapUrl(`${SITE}///`, '/about/')).toBe(`${SITE}/about/`)
  })

  it('日本語などはURLエンコードし、二重エンコードしない', () => {
    expect(toSitemapUrl(SITE, '/clubs/リバプール/')).toBe(
      `${SITE}/clubs/%E3%83%AA%E3%83%90%E3%83%97%E3%83%BC%E3%83%AB/`,
    )
    expect(toSitemapUrl(SITE, '/clubs/%E3%83%AA/')).toBe(`${SITE}/clubs/%E3%83%AA/`)
  })

  it('不正な % を含んでも例外にしない', () => {
    expect(() => toSitemapUrl(SITE, '/clubs/100%/')).not.toThrow()
  })
})

/* ============================================================
 * 載せる／載せないの判断
 * ========================================================== */

describe('掲載の判断', () => {
  it('★所属クラブも商品も無いリーグは載せない★', () => {
    expect(isLeagueListable({ slug: 'serie-a', clubCount: 0, productCount: 0 })).toBe(false)
    expect(isLeagueListable({ slug: 'x', clubCount: 1, productCount: 0 })).toBe(false)
    expect(isLeagueListable({ slug: 'premier-league', clubCount: 2, productCount: 5 })).toBe(true)
  })

  it('商品が1つも無いクラブは載せない', () => {
    expect(isClubListable({ slug: 'x', productCount: 0 })).toBe(false)
    expect(isClubListable({ slug: 'liverpool', productCount: 1 })).toBe(true)
  })

  it('★海外価格も国内価格も無い商品は載せない★', () => {
    const base = { href: '/products/x/' }
    expect(isProductListable({ ...base, hasOverseasPrice: false, hasDomesticPrice: false })).toBe(
      false,
    )
    expect(isProductListable({ ...base, hasOverseasPrice: true, hasDomesticPrice: false })).toBe(true)
    expect(isProductListable({ ...base, hasOverseasPrice: false, hasDomesticPrice: true })).toBe(true)
  })

  it('セール・ランキングは、載せる商品があるときだけ載せる', () => {
    const empty = buildSitemapEntries(input({ saleCount: 0, rankingCount: 0 })).map((e) => e.url)
    expect(empty).not.toContain(`${SITE}/sale/`)
    expect(empty).not.toContain(`${SITE}/rankings/`)

    const filled = buildSitemapEntries(input()).map((e) => e.url)
    expect(filled).toContain(`${SITE}/sale/`)
    expect(filled).toContain(`${SITE}/rankings/`)
  })

  it('★検索ページは載せない★', () => {
    const urls = buildSitemapEntries(input()).map((e) => e.url)
    expect(urls.some((url) => url.includes('/search'))).toBe(false)
  })

  it('★同じURLは1回だけ★', () => {
    const entries = buildSitemapEntries(
      input({
        clubs: [
          { slug: 'liverpool', productCount: 1 },
          { slug: 'liverpool', productCount: 1 },
        ],
        products: [
          { href: '/products/a/', hasOverseasPrice: true, hasDomesticPrice: false },
          { href: '/products/a', hasOverseasPrice: true, hasDomesticPrice: false },
        ],
      }),
    )
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('トップ・一覧・about はいつも載せる', () => {
    const urls = buildSitemapEntries(
      input({ leagues: [], clubs: [], products: [], saleCount: 0, rankingCount: 0 }),
    ).map((e) => e.url)
    expect(urls).toEqual([`${SITE}/`, `${SITE}/clubs/`, `${SITE}/leagues/`, `${SITE}/about/`])
  })
})

/* ============================================================
 * 実際のデータで作ったとき
 * ========================================================== */

describe('★実際のデータから作った sitemap★', () => {
  async function realEntries() {
    const [leagues, clubs, products, sale, ranking] = await Promise.all([
      listLeagueSummaries(),
      listClubSummaries(),
      listProductViews(),
      listSaleProductViews(),
      listPriceGapRanking(),
    ])
    return {
      products,
      entries: buildSitemapEntries({
        siteUrl: SITE,
        leagues: leagues.map((s) => ({
          slug: s.league.slug,
          clubCount: s.clubCount,
          productCount: s.productCount,
        })),
        clubs: clubs.map((s) => ({ slug: s.club.slug, productCount: s.productCount })),
        products: products.map((view) => ({
          href: view.href,
          hasOverseasPrice: view.overseas !== null,
          hasDomesticPrice: view.comparison.domesticPrice.reference !== null,
        })),
        saleCount: sale.length,
        rankingCount: ranking.length,
      }),
    }
  }

  it('トップ・リーグ1件以上・クラブ3件以上を含む', async () => {
    const { entries } = await realEntries()
    expect(entries.filter((e) => e.kind === 'top')).toHaveLength(1)
    expect(entries.filter((e) => e.kind === 'league').length).toBeGreaterThanOrEqual(1)
    expect(entries.filter((e) => e.kind === 'club').length).toBeGreaterThanOrEqual(3)
  })

  it('★存在しないページのURLを作らない★', async () => {
    // 実在するページのパス（generateStaticParams と同じデータから作る）
    const { entries, products } = await realEntries()
    const leagues = await listLeagueSummaries()
    const clubs = await listClubSummaries()
    const existing = new Set([
      '/',
      '/clubs/',
      '/leagues/',
      '/sale/',
      '/rankings/',
      '/about/',
      ...leagues.map((s) => `/leagues/${s.league.slug}/`),
      ...clubs.map((s) => `/clubs/${s.club.slug}/`),
      ...products.map((view) => view.href),
    ])

    for (const entry of entries) {
      expect(existing.has(entry.url.slice(SITE.length))).toBe(true)
    }
  })

  it('すべて https・同じドメイン・末尾スラッシュ・重複なし', async () => {
    const { entries } = await realEntries()
    const urls = entries.map((e) => e.url)
    expect(new Set(urls).size).toBe(urls.length)
    for (const url of urls) {
      expect(url.startsWith(`${SITE}/`)).toBe(true)
      expect(url.endsWith('/')).toBe(true)
      expect(url).not.toContain('?')
      expect(url.slice('https://'.length)).not.toContain('//')
    }
  })
})

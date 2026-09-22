/**
 * クラブページの固有情報（src/lib/clubProfile.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・全クラブで、既存データだけから組み立てる（クラブごとの手書きの文章は無い）
 *   ・既存データに無いことを書かない（メーカー名など、データが不確かな項目を使わない）
 *   ・リンク先は実在するページだけ
 *   ・キーワードを詰め込まない（title・description が長すぎない）
 */

import { describe, expect, it } from 'vitest'
import { buildClubProfile, pickAltNameJa } from '@/lib/clubProfile'
import { isClubListable } from '@/lib/sitemap'
import {
  getClubBySlug,
  listClubSummaries,
  listLeagues,
  listPriceGapRanking,
  listProductViews,
  listProductViewsByClub,
  listSaleProductViews,
} from '@/data/repository'

/** ページ（src/app/clubs/[slug]/page.tsx）と同じ入力で組み立てる。 */
async function pageProfile(slug: string) {
  const club = await getClubBySlug(slug)
  if (!club) throw new Error(`${slug} が見つかりません`)
  const [leagues, views, summaries, sale, ranking] = await Promise.all([
    listLeagues(),
    listProductViewsByClub(club.id),
    listClubSummaries(club.leagueId),
    listSaleProductViews(),
    listPriceGapRanking(),
  ])
  return {
    club,
    views,
    profile: buildClubProfile({
      club,
      league: leagues.find((league) => league.id === club.leagueId) ?? null,
      views,
      relatedClubs: summaries
        .filter((summary) => summary.club.id !== club.id)
        .filter((summary) => isClubListable({ slug: summary.club.slug, productCount: summary.productCount }))
        .map((summary) => ({ nameJa: summary.club.nameJa, href: summary.href })),
      saleCount: sale.length,
      rankingCount: ranking.length,
    }),
  }
}

const liverpoolProfile = () => pageProfile('liverpool')

async function allClubProfiles() {
  const summaries = await listClubSummaries()
  return Promise.all(summaries.map((summary) => pageProfile(summary.club.slug)))
}

async function existingPaths() {
  const [products, clubs, leagues] = await Promise.all([
    listProductViews(),
    listClubSummaries(),
    listLeagues(),
  ])
  return new Set([
    '/clubs/',
    '/sale/',
    '/rankings/',
    ...products.map((view) => view.href),
    ...clubs.map((summary) => summary.href),
    ...leagues.map((league) => `/leagues/${league.slug}/`),
  ])
}

describe('★全クラブへの展開★', () => {
  it('登録されている全クラブで組み立てられる', async () => {
    const summaries = await listClubSummaries()
    const all = await allClubProfiles()
    expect(all.length).toBe(summaries.length)
    expect(all.length).toBeGreaterThanOrEqual(4)
  })

  it('★title・description・H1 はクラブごとに違う（完全一致の重複なし）★', async () => {
    const all = await allClubProfiles()
    for (const key of ['title', 'description', 'h1'] as const) {
      const values = all.map(({ profile }) => profile[key])
      expect(new Set(values).size).toBe(values.length)
    }
    for (const { club, profile } of all) {
      expect(profile.title).toContain(club.nameJa)
      expect(profile.description).toContain(club.nameJa)
      expect(profile.h1).toContain(club.nameJa)
      expect([...profile.title].length).toBeLessThanOrEqual(32)
      expect([...profile.description].length).toBeLessThanOrEqual(120)
    }
  })

  it('★どのクラブでも undefined・null・NaN・空の値を出さない★', async () => {
    for (const { profile } of await allClubProfiles()) {
      expect(JSON.stringify(profile)).not.toMatch(/undefined|NaN|null（|（）/)
      for (const fact of profile.facts) expect(fact.value).toBeTruthy()
      for (const link of [...profile.related, ...profile.kitGroups.flatMap((group) => group.items)]) {
        expect(link.label).toBeTruthy()
        expect(link.href).toBeTruthy()
      }
      for (const category of profile.categories) expect(category.count).toBeGreaterThan(0)
      for (const group of profile.kitGroups) expect(group.items.length).toBeGreaterThan(0)
    }
  })

  it('★どのクラブでもリンク先は実在するページだけ・自分自身へのリンクなし・重複なし★', async () => {
    const existing = await existingPaths()
    for (const { club, profile } of await allClubProfiles()) {
      const internal = [
        ...profile.kitGroups.flatMap((group) => group.items.map((item) => item.href)),
        ...profile.related.map((link) => link.href),
        ...profile.facts.filter((fact) => fact.href && !fact.external).map((fact) => fact.href as string),
      ]
      for (const href of internal) expect(existing.has(href), `${club.slug}: ${href}`).toBe(true)
      expect(profile.related.some((link) => link.href === `/clubs/${club.slug}/`)).toBe(false)
      const relatedHrefs = profile.related.map((link) => link.href)
      expect(new Set(relatedHrefs).size).toBe(relatedHrefs.length)
      expect(JSON.stringify(profile)).not.toContain('example.com')
      // 公式ストアは https のクラブ公式URLだけ
      if (profile.officialStoreUrl) expect(profile.officialStoreUrl).toBe(club.officialStoreUrl)
    }
  })

  it('★どのクラブでもメーカー名を書かない（データが不確かなため）★', async () => {
    for (const { profile } of await allClubProfiles()) {
      expect(JSON.stringify(profile)).not.toMatch(/adidas|Nike|ナイキ|アディダス/i)
    }
  })

  it('★どのクラブでも、無い商品を名乗らない★', async () => {
    for (const { profile, views } of await allClubProfiles()) {
      const hasKits = views.some((view) => view.product.category === 'kits')
      const hasGoods = views.some((view) => view.product.category !== 'kits')
      if (!hasKits) expect(profile.title).not.toContain('ユニフォーム')
      if (!hasGoods) expect(profile.title).not.toContain('グッズ')
      expect(profile.totalProducts).toBe(views.length)
    }
  })
})

describe('日本語の別表記', () => {
  it('リヴァプールには「リバプール」を選ぶ（国内ECの実データで多い表記）', () => {
    expect(pickAltNameJa('liverpool', 'リヴァプール')).toBe('リバプール')
  })

  it('★根拠を確認していない別表記は出さない★', () => {
    // 照合用の辞書から自動で選ぶと「トットナム」「レアルマドリッド」のような
    // あまり使われない表記が選ばれたため、明示したクラブだけにしている
    expect(pickAltNameJa('tottenham', 'トッテナム・ホットスパー')).toBeNull()
    expect(pickAltNameJa('real-madrid', 'レアル・マドリード')).toBeNull()
    expect(pickAltNameJa('fc-barcelona', 'FCバルセロナ')).toBeNull()
  })

  it('辞書に無いクラブは null', () => {
    expect(pickAltNameJa('unknown-club', '架空クラブ')).toBeNull()
  })
})

describe('リヴァプールの固有情報', () => {
  it('掲載商品の内訳が実際の商品数と一致する', async () => {
    const { profile, views } = await liverpoolProfile()
    expect(profile.totalProducts).toBe(views.length)
    expect(profile.categories.reduce((sum, category) => sum + category.count, 0)).toBe(views.length)
  })

  it('ユニフォームの一覧に、ユニフォームの商品がすべて1回ずつ入る', async () => {
    const { profile, views } = await liverpoolProfile()
    const kitHrefs = views.filter((view) => view.product.category === 'kits').map((view) => view.href)
    const listed = profile.kitGroups.flatMap((group) => group.items.map((item) => item.href))
    expect([...listed].sort()).toEqual([...kitHrefs].sort())
  })

  it('★リンク先は実在するページだけ★', async () => {
    const { profile } = await liverpoolProfile()
    const products = await listProductViews()
    const clubs = await listClubSummaries()
    const leagues = await listLeagues()
    const existing = new Set([
      '/clubs/',
      '/sale/',
      '/rankings/',
      ...products.map((view) => view.href),
      ...clubs.map((summary) => summary.href),
      ...leagues.map((league) => `/leagues/${league.slug}/`),
    ])
    const internal = [
      ...profile.kitGroups.flatMap((group) => group.items.map((item) => item.href)),
      ...profile.related.map((link) => link.href),
      ...profile.facts.filter((fact) => fact.href && !fact.external).map((fact) => fact.href as string),
    ]
    for (const href of internal) expect(existing.has(href)).toBe(true)
    // ページ内リンクはカテゴリ見出しの id を指す
    for (const category of profile.categories) expect(category.href).toMatch(/^#cat-[a-z-]+$/)
  })

  it('★仮のURL（example.com）へリンクしない★', async () => {
    const { profile } = await liverpoolProfile()
    expect(JSON.stringify(profile)).not.toContain('example.com')
    expect(profile.officialStoreUrl).toBe('https://store.liverpoolfc.com/')
  })

  it('★データが不確かなメーカー名を書かない★', async () => {
    const { profile } = await liverpoolProfile()
    const text = JSON.stringify(profile)
    expect(text).not.toMatch(/adidas|Nike|ナイキ|アディダス/i)
  })

  it('★自分自身を関連クラブに含めない★', async () => {
    const { profile, club } = await liverpoolProfile()
    expect(profile.related.some((link) => link.href === `/clubs/${club.slug}/`)).toBe(false)
  })

  it('title・description は詰め込みすぎない長さ', async () => {
    const { profile } = await liverpoolProfile()
    expect([...profile.title].length).toBeLessThanOrEqual(32)
    expect([...profile.description].length).toBeLessThanOrEqual(120)
    // 同じ語を何度も繰り返していない
    expect(profile.title.split('ユニフォーム').length - 1).toBe(1)
  })
})

/* ============================================================
 * 品質ゲート（第2回）：データ量が少ないクラブ
 * ========================================================== */

async function profileFor(slug: string, override: (views: Awaited<ReturnType<typeof listProductViewsByClub>>) => typeof views = (v) => v) {
  const club = await getClubBySlug(slug)
  if (!club) throw new Error(`${slug} が見つかりません`)
  const [leagues, realViews] = await Promise.all([listLeagues(), listProductViewsByClub(club.id)])
  const views = override(realViews)
  return {
    club,
    views,
    profile: buildClubProfile({
      club,
      league: leagues.find((league) => league.id === club.leagueId) ?? null,
      views,
      relatedClubs: [],
      saleCount: 1,
      rankingCount: 1,
    }),
  }
}

describe('★レアル・マドリード（ユニフォームだけ・ホームだけ・セール0点）★', () => {
  it('グッズが無いので title・H1 に「グッズ」と書かない', async () => {
    const { profile } = await profileFor('real-madrid')
    expect(profile.title).toBe('レアル・マドリードのユニフォーム価格比較')
    expect(profile.h1).toBe('レアル・マドリードのユニフォーム')
    expect(profile.title).not.toContain('グッズ')
    expect(profile.description).not.toContain('グッズ')
  })

  it('description は実際にある種類・シーズンだけで作る', async () => {
    const { profile } = await profileFor('real-madrid')
    expect(profile.description).toBe(
      'レアル・マドリード（Real Madrid CF）の2025/26シーズンのユニフォーム（ホーム）を、海外公式ストアの価格と日本到着推定額で比較できます。',
    )
  })

  it('「種類から探す」の説明は、実際に違いがある項目（レプリカ／オーセンティック）だけ', async () => {
    const { profile } = await profileFor('real-madrid')
    expect(profile.kitGuideNote).toBe(
      '同じ種類のユニフォームでも、レプリカとオーセンティックは別の商品で、価格も違います。',
    )
    expect(profile.kitGuideNote).not.toMatch(/長袖|子供用|選手名入り|ウィメンズ/)
  })

  it('★undefined・null・NaN を文字として出さない★', async () => {
    const { profile } = await profileFor('real-madrid')
    expect(JSON.stringify(profile)).not.toMatch(/undefined|null（|NaN/)
    for (const fact of profile.facts) expect(fact.value).toBeTruthy()
  })
})

describe('★「種類から探す」の説明は、同じ種類の中の違いだけ★', () => {
  it('バルセロナ（ホーム＝メンズ、サード＝ウィメンズ）では「メンズとウィメンズ」と書かない', async () => {
    const { profile } = await pageProfile('fc-barcelona')
    expect(profile.kitGroups.map((group) => group.label)).toEqual(['ホーム', 'サード'])
    expect(profile.kitGuideNote).toBeNull()
  })

  it('トッテナム（ホーム・アウェイとも同じ仕様）は説明文なし', async () => {
    const { profile } = await pageProfile('tottenham')
    expect(profile.kitGroups.length).toBe(2)
    expect(profile.kitGuideNote).toBeNull()
  })

  it('リヴァプールの説明文は変わらない（ホームの中に5項目すべての違いがある）', async () => {
    const { profile } = await liverpoolProfile()
    expect(profile.kitGuideNote).toBe(
      '同じ種類のユニフォームでも、レプリカとオーセンティック、半袖と長袖、大人用と子供用、メンズとウィメンズ、無地と選手名入りは別の商品で、価格も違います。',
    )
  })
})

describe('★データが欠けているときの表示★', () => {
  it('ユニフォームが1点だけなら「種類から探す」を出さない（商品一覧の繰り返しになるため）', async () => {
    const { profile } = await profileFor('real-madrid', (views) => views.slice(0, 1))
    expect(profile.kitGroups).toEqual([])
    expect(profile.kitGuideNote).toBeNull()
  })

  it('仕様に違いが無ければ、説明文を出さない', async () => {
    const { profile } = await profileFor('real-madrid', (views) =>
      views.map((view) => ({ ...view, product: { ...view.product, authenticity: 'replica' } })),
    )
    expect(profile.kitGroups.length).toBeGreaterThan(0)
    expect(profile.kitGuideNote).toBeNull()
  })

  it('★商品が0点なら「比較できます」と言わず、掲載商品の行も作らない★', async () => {
    const { profile } = await profileFor('real-madrid', () => [])
    expect(profile.totalProducts).toBe(0)
    expect(profile.categories).toEqual([])
    expect(profile.kitGroups).toEqual([])
    expect(profile.title).toBe('レアル・マドリード')
    expect(profile.description).toBe('レアル・マドリード（Real Madrid CF）の商品は準備中です。')
    expect(profile.description).not.toContain('比較できます')
    // 中身の無いリーグページへ誘導しない
    expect(profile.related.some((link) => link.href.startsWith('/leagues/'))).toBe(false)
  })

  it('★海外価格が無ければ「日本到着推定額で比較できます」と言わない★', async () => {
    const { profile } = await profileFor('real-madrid', (views) =>
      views.map((view) => ({ ...view, overseas: null })),
    )
    expect(profile.hasOverseasPrice).toBe(false)
    expect(profile.hasDomesticPrice).toBe(true)
    expect(profile.description).not.toContain('日本到着推定額')
    expect(profile.description).toContain('国内の販売価格を確認できます')
  })

  it('価格がどちらも無ければ「価格は確認中」と正直に書く', async () => {
    const { profile } = await profileFor('real-madrid', (views) =>
      views.map((view) => ({
        ...view,
        overseas: null,
        comparison: {
          ...view.comparison,
          domesticPrice: { ...view.comparison.domesticPrice, reference: null },
        },
      })),
    )
    expect(profile.description).toContain('価格は確認中です')
    expect(profile.description).not.toContain('比較できます')
  })

  it('グッズだけのクラブは「グッズ」、ユニフォームを名乗らない', async () => {
    const { profile } = await profileFor('real-madrid', (views) =>
      views.map((view) => ({ ...view, product: { ...view.product, category: 'scarves', kitType: null } })),
    )
    expect(profile.title).toBe('レアル・マドリードのグッズ価格比較')
    expect(profile.title).not.toContain('ユニフォーム')
    expect(profile.description).not.toContain('ユニフォーム')
  })

  it('★公式ストアのURLが無ければ、行もリンクも作らない★', async () => {
    const club = await getClubBySlug('real-madrid')
    const views = await listProductViewsByClub(club!.id)
    const profile = buildClubProfile({
      club: { ...club!, officialStoreUrl: '' },
      league: null,
      views,
      relatedClubs: [],
      saleCount: 0,
      rankingCount: 0,
    })
    expect(profile.officialStoreUrl).toBeNull()
    expect(profile.facts.some((fact) => fact.label === '公式オンラインストア')).toBe(false)
    // リーグが無ければ行もリンクも作らない
    expect(profile.facts.some((fact) => fact.label === '所属リーグ')).toBe(false)
    // セール・ランキングに商品が無ければリンクしない
    expect(profile.related.map((link) => link.href)).toEqual(['/clubs/'])
  })
})

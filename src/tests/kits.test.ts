/**
 * 全クラブ横断のユニフォーム一覧（src/lib/kits.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・既存データのユニフォームだけを、全クラブ分そのまま並べる
 *   ・title・H1 にクラブ名を入れない（「クラブ名 ユニフォーム」はクラブページの担当）
 *   ・価格が無いのに「比較できます」と言わない
 *   ・絞り込みで「0件」の選択肢・結果を作らない
 *   ・ユニフォームのあるクラブが2つ未満なら、検索に出さない
 */

import { describe, expect, it } from 'vitest'
import { listClubSummaries, listProductViews } from '@/data/repository'
import {
  EMPTY_KITS_FILTER,
  buildKitsFacets,
  buildKitsIndex,
  countKitsIgnoring,
  filterKits,
  normalizeKitsFilter,
  selectKits,
  sortKits,
} from '@/lib/kits'
import { isKitsIndexListable } from '@/lib/sitemap'

async function realIndex() {
  const views = await listProductViews()
  return { views, index: buildKitsIndex(views) }
}

describe('一覧の中身', () => {
  it('★ユニフォームだけを、全クラブ分すべて並べる★', async () => {
    const { views, index } = await realIndex()
    const kits = views.filter((view) => view.product.category === 'kits')
    expect(index.kits).toHaveLength(kits.length)
    expect(index.kits.every((view) => view.product.category === 'kits')).toBe(true)
    expect(new Set(index.kits.map((view) => view.product.id)).size).toBe(kits.length)
  })

  it('クラブごとの内訳の合計が一覧の件数と一致し、リンク先は実在するクラブページ', async () => {
    const { index } = await realIndex()
    const clubHrefs = new Set((await listClubSummaries()).map((summary) => summary.href))
    expect(index.clubs.reduce((sum, club) => sum + club.count, 0)).toBe(index.kits.length)
    for (const club of index.clubs) {
      expect(clubHrefs.has(club.href)).toBe(true)
      expect(club.count).toBeGreaterThan(0)
      expect(club.kitTypes.length).toBeGreaterThan(0)
    }
    expect(index.kitTypeCounts.reduce((sum, entry) => sum + entry.count, 0)).toBe(index.kits.length)
  })

  it('★title・H1 にクラブ名を入れない（クラブページと役割を分ける）★', async () => {
    const { index } = await realIndex()
    expect(index.title).toBe('海外サッカーユニフォーム一覧')
    expect(index.h1).toBe('海外サッカーユニフォーム')
    for (const club of index.clubs) {
      expect(index.title).not.toContain(club.nameJa)
      expect(index.h1).not.toContain(club.nameJa)
      expect(index.description).not.toContain(club.nameJa)
    }
  })

  it('description は実際の件数・リーグ・種類だけで作る', async () => {
    const { index } = await realIndex()
    expect(index.description).toBe(
      `プレミアリーグ・ラ・リーガ・セリエA・リーグ・アン・エールディヴィジの${index.clubs.length}クラブのユニフォーム${index.kits.length}点を、` +
        'クラブや種類（ホーム・アウェイ・サード・ゴールキーパー）で横断して探せます。' +
        '海外ストアの価格がある商品は、日本到着推定額も確認できます。',
    )
    /*
     * ★リーグ名を全部並べているので、上限120字に近づいています（現在119字）。★
     *   5リーグすべてにクラブが入ったため、リーグ名の並びはこれ以上増えません。
     *   クラブ数・点数の桁が増えて超えそうになったら、
     *   リーグ名の羅列をやめて「5リーグの」のような書き方へ変えてください。
     */
    expect([...index.description].length).toBeLessThanOrEqual(120)
  })

  it('★根拠のない表現・データが不確かな項目を書かない★', async () => {
    const { index } = await realIndex()
    const text = [index.title, index.description, index.h1, index.lead, JSON.stringify(index.clubs)].join('\n')
    expect(text).not.toMatch(/最安|必ず|一番安い|No\.1|adidas|Nike|ナイキ|アディダス/i)
    expect(text).not.toMatch(/undefined|null|NaN|（）/)
  })
})

describe('並び替え', () => {
  it('クラブ順: リーグ・クラブの表示順 → 種類 → 新しいシーズン', async () => {
    const { index } = await realIndex()
    const sorted = sortKits(index.kits, 'club')
    expect(sorted[0].club.slug).toBe('liverpool')
    expect(sorted[0].product.kitType).toBe('home')
    // 同じクラブは連続して並ぶ
    const order = sorted.map((view) => view.club.slug).filter((slug, i, all) => all[i - 1] !== slug)
    expect(new Set(order).size).toBe(order.length)
  })

  it('種類順: ホームがすべて先に並ぶ', async () => {
    const { index } = await realIndex()
    const sorted = sortKits(index.kits, 'kitType')
    const homes = sorted.filter((view) => view.product.kitType === 'home').length
    expect(sorted.slice(0, homes).every((view) => view.product.kitType === 'home')).toBe(true)
  })

  it('並べ替えても件数・中身は変わらない', async () => {
    const { index } = await realIndex()
    for (const key of ['club', 'kitType'] as const) {
      const ids = sortKits(index.kits, key).map((view) => view.product.id)
      expect([...ids].sort()).toEqual(index.kits.map((view) => view.product.id).sort())
    }
  })
})

describe('★絞り込み★', () => {
  it('リーグ・クラブ・種類・シーズンの選択肢を、データにある値だけで作る', async () => {
    const { index } = await realIndex()
    const facets = buildKitsFacets(index.kits, EMPTY_KITS_FILTER)
    expect(facets.map((facet) => facet.key)).toEqual(['league', 'club', 'kitType', 'season'])
    const kitType = facets.find((facet) => facet.key === 'kitType')!
    expect(kitType.options.map((option) => option.label)).toEqual(['ホーム', 'アウェイ', 'サード', 'ゴールキーパー'])
    const season = facets.find((facet) => facet.key === 'season')!
    expect(season.options.map((option) => option.label)).toEqual(['2025/26', '2024/25'])
  })

  it('★どの選択肢を選んでも0件にならない（選択肢の件数と結果が一致する）★', async () => {
    const { index } = await realIndex()
    for (const facet of buildKitsFacets(index.kits, EMPTY_KITS_FILTER)) {
      for (const option of facet.options) {
        const filter = { ...EMPTY_KITS_FILTER, [facet.key]: option.value }
        const result = filterKits(index.kits, filter)
        expect(option.count).toBeGreaterThan(0)
        expect(result).toHaveLength(option.count)
        // 2段目の選択肢も0件を含まない
        for (const next of buildKitsFacets(index.kits, filter)) {
          for (const nextOption of next.options) expect(nextOption.count).toBeGreaterThan(0)
          expect(countKitsIgnoring(index.kits, filter, next.key)).toBeGreaterThan(0)
        }
      }
    }
  })

  it('リーグを選ぶと、クラブの選択肢はそのリーグのクラブだけになる', async () => {
    const { index } = await realIndex()
    const facets = buildKitsFacets(index.kits, { ...EMPTY_KITS_FILTER, league: 'la-liga' })
    const clubs = facets.find((facet) => facet.key === 'club')!.options.map((option) => option.value)
    expect(clubs.sort()).toEqual(['fc-barcelona', 'real-madrid'])
  })

  it('★条件が食い違ったら、いま選んだ項目を残してほかを外す★', async () => {
    const { index } = await realIndex()
    const next = normalizeKitsFilter(
      index.kits,
      { ...EMPTY_KITS_FILTER, league: 'premier-league', club: 'real-madrid' },
      'club',
    )
    expect(next.club).toBe('real-madrid')
    expect(next.league).toBeNull()
    expect(filterKits(index.kits, next).length).toBeGreaterThan(0)
  })

  it('データ全体で値が1種類しか無い項目は、絞り込みに出さない', async () => {
    const { index } = await realIndex()
    const only2526 = index.kits.filter((view) => view.product.season === '2025/26')
    const facets = buildKitsFacets(only2526, EMPTY_KITS_FILTER)
    expect(facets.some((facet) => facet.key === 'season')).toBe(false)
  })
})

describe('★データが欠けているとき★', () => {
  it('海外価格が無ければ「日本到着推定額」と言わない', async () => {
    const { views } = await realIndex()
    const index = buildKitsIndex(views.map((view) => ({ ...view, overseas: null })))
    expect(index.hasOverseasPrice).toBe(false)
    expect(index.description).not.toContain('日本到着推定額')
  })

  it('価格がどちらも無ければ、価格について何も言わない', async () => {
    const { views } = await realIndex()
    const index = buildKitsIndex(
      views.map((view) => ({
        ...view,
        overseas: null,
        comparison: {
          ...view.comparison,
          domesticPrice: { ...view.comparison.domesticPrice, reference: null },
        },
      })),
    )
    expect(index.description).not.toMatch(/価格|比較/)
  })

  it('ユニフォームが0点なら「準備中」と正直に書く', async () => {
    const { views } = await realIndex()
    const index = buildKitsIndex(views.filter((view) => view.product.category !== 'kits'))
    expect(index.kits).toEqual([])
    expect(index.clubs).toEqual([])
    expect(index.description).toBe('海外サッカークラブのユニフォームは準備中です。')
    expect(index.description).not.toContain('0点')
  })

  it('selectKits はユニフォーム以外を含めない', async () => {
    const { views } = await realIndex()
    expect(selectKits(views).some((view) => view.product.category !== 'kits')).toBe(false)
  })
})

describe('★検索に出すかどうか（sitemap と同じ判定）★', () => {
  it('ユニフォームのあるクラブが2つ以上のときだけ', () => {
    expect(isKitsIndexListable({ kitCount: 0, clubCount: 0 })).toBe(false)
    expect(isKitsIndexListable({ kitCount: 5, clubCount: 1 })).toBe(false)
    expect(isKitsIndexListable({ kitCount: 2, clubCount: 2 })).toBe(true)
  })

  it('いまのデータでは検索に出す', async () => {
    const { index } = await realIndex()
    expect(isKitsIndexListable({ kitCount: index.kits.length, clubCount: index.clubs.length })).toBe(true)
  })
})

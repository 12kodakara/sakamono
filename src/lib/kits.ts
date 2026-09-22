/**
 * 全クラブ横断のユニフォーム一覧（/kits/）の中身を、既存データから組み立てる。
 *
 * ══════════════════════════════════════════════════════════
 * ★クラブページとの役割分担★
 *
 *   クラブページ（/clubs/liverpool/ など）
 *     … 1つのクラブのユニフォーム・グッズ・購入先を見る
 *   このページ（/kits/）
 *     … 複数のクラブのユニフォームを、クラブや種類で横断して探す
 *
 *   そのため title・H1 にはクラブ名を入れません
 *   （「クラブ名 ユニフォーム」はクラブページが受け持つ）。
 *   クラブごとの内訳からは、各クラブページへリンクします。
 *
 * ★データに無いことは書きません。★
 *   メーカー名は使いません（一部の開発用データで、シーズンとメーカーの組み合わせが
 *   実際と違うため。src/lib/clubProfile.ts と同じ理由）。
 *   価格の無い商品があるので、価格では並べ替えません。
 * ══════════════════════════════════════════════════════════
 *
 * ★この関数はデータを受け取って結果を返すだけです。★
 *   データの取得はページ（src/app/kits/page.tsx）が行います。
 */

import type { KitType } from '@/domain/types'
import type { ProductView } from '@/data/viewModels'
import { KIT_TYPE_LABEL } from '@/lib/labels'

/** 種類の並び順（ホーム → アウェイ → サード → GK → スペシャル）。 */
export const KIT_TYPE_ORDER: NonNullable<KitType>[] = ['home', 'away', 'third', 'goalkeeper', 'special']

function kitTypeRank(kitType: KitType): number {
  const index = kitType ? KIT_TYPE_ORDER.indexOf(kitType) : -1
  return index === -1 ? KIT_TYPE_ORDER.length : index
}

/* ------------------------------------------------------------
 * 並び順
 * ---------------------------------------------------------- */

export type KitsSortKey = 'club' | 'kitType'

export const KITS_SORT_LABEL: Record<KitsSortKey, string> = {
  club: 'クラブ順',
  kitType: '種類順（ホーム・アウェイ…）',
}

/** 同じクラブ・同じ種類の中の並び: 新しいシーズン → レプリカ → 通常（無地・大人用・半袖）。 */
function compareWithinKit(a: ProductView, b: ProductView): number {
  const season = (b.product.season ?? '').localeCompare(a.product.season ?? '')
  if (season !== 0) return season
  const auth = (v: ProductView) => (v.product.authenticity === 'replica' ? 0 : 1)
  if (auth(a) !== auth(b)) return auth(a) - auth(b)
  const plain = (v: ProductView) =>
    (v.product.sleeve === 'long' ? 1 : 0) +
    (v.product.gender === 'kids' || v.product.gender === 'women' ? 1 : 0) +
    (v.product.player ? 1 : 0)
  if (plain(a) !== plain(b)) return plain(a) - plain(b)
  return a.product.id.localeCompare(b.product.id)
}

function compareClub(a: ProductView, b: ProductView): number {
  return (
    a.league.displayOrder - b.league.displayOrder ||
    a.club.displayOrder - b.club.displayOrder ||
    a.club.id.localeCompare(b.club.id)
  )
}

/**
 * ★並べ替えに使うのは、全ユニフォームで欠けていない項目だけ★（クラブ・種類）。
 *   価格は欠けている商品が多いので使いません。
 */
export function sortKits(views: ProductView[], key: KitsSortKey): ProductView[] {
  const byKitType = (a: ProductView, b: ProductView) =>
    kitTypeRank(a.product.kitType) - kitTypeRank(b.product.kitType)
  return [...views].sort((a, b) =>
    key === 'club'
      ? compareClub(a, b) || byKitType(a, b) || compareWithinKit(a, b)
      : byKitType(a, b) || compareClub(a, b) || compareWithinKit(a, b),
  )
}

/* ------------------------------------------------------------
 * 絞り込み
 *
 * ★URLは変えません（?club=… などを作らない）。★
 *   条件ごとのURLができると、中身がほぼ同じページが検索エンジンから見えるためです。
 *   絞り込みはブラウザの中だけで行い、URLは /kits/ のまま。
 * ---------------------------------------------------------- */

export type KitsFacetKey = 'league' | 'club' | 'kitType' | 'season'

export type KitsFilter = Record<KitsFacetKey, string | null>

export const EMPTY_KITS_FILTER: KitsFilter = { league: null, club: null, kitType: null, season: null }

export const KITS_FACET_LABEL: Record<KitsFacetKey, string> = {
  league: 'リーグ',
  club: 'クラブ',
  kitType: '種類',
  season: 'シーズン',
}

export const KITS_FACET_ORDER: KitsFacetKey[] = ['league', 'club', 'kitType', 'season']

function facetValue(view: ProductView, key: KitsFacetKey): string | null {
  switch (key) {
    case 'league':
      return view.league.slug
    case 'club':
      return view.club.slug
    case 'kitType':
      return view.product.kitType
    case 'season':
      return view.product.season
  }
}

function facetLabel(view: ProductView, key: KitsFacetKey): string {
  switch (key) {
    case 'league':
      return view.league.nameJa
    case 'club':
      return view.club.nameJa
    case 'kitType':
      return view.product.kitType ? KIT_TYPE_LABEL[view.product.kitType] : ''
    case 'season':
      return view.product.season ?? ''
  }
}

function matches(view: ProductView, filter: KitsFilter, skip?: KitsFacetKey): boolean {
  return KITS_FACET_ORDER.every(
    (key) => key === skip || filter[key] === null || facetValue(view, key) === filter[key],
  )
}

export function filterKits(views: ProductView[], filter: KitsFilter): ProductView[] {
  return views.filter((view) => matches(view, filter))
}

/** ある項目を「すべて」にしたときの件数（ほかの条件はそのまま）。 */
export function countKitsIgnoring(views: ProductView[], filter: KitsFilter, key: KitsFacetKey): number {
  return views.filter((view) => matches(view, filter, key)).length
}

export interface KitsFacetOption {
  value: string
  label: string
  /** ほかの条件はそのままで、この値を選んだときの件数。 */
  count: number
}

export interface KitsFacet {
  key: KitsFacetKey
  label: string
  options: KitsFacetOption[]
}

/**
 * 絞り込みの選択肢。
 *
 * ★選ぶと0件になる選択肢は出しません★（「0件」の結果を作らないため）。
 * ★データ全体で値が1種類しか無い項目は、絞り込みとして出しません★
 *   （選んでも結果が変わらないため）。
 */
export function buildKitsFacets(views: ProductView[], filter: KitsFilter): KitsFacet[] {
  const facets: KitsFacet[] = []
  for (const key of KITS_FACET_ORDER) {
    // データ全体での値の種類（並び順は一覧のクラブ順・種類順・新しいシーズン順）
    const ordered = sortKits(views, 'club')
    const allValues = new Map<string, { label: string; rank: number }>()
    ordered.forEach((view, index) => {
      const value = facetValue(view, key)
      if (value && !allValues.has(value)) {
        const rank =
          key === 'kitType'
            ? kitTypeRank(view.product.kitType)
            : key === 'season'
              ? -Number((value.match(/\d{4}/) ?? ['0'])[0])
              : index
        allValues.set(value, { label: facetLabel(view, key), rank })
      }
    })
    if (allValues.size < 2) continue

    const options = [...allValues.entries()]
      .sort((a, b) => a[1].rank - b[1].rank)
      .map(([value, { label }]) => ({
        value,
        label,
        count: views.filter((view) => facetValue(view, key) === value && matches(view, filter, key)).length,
      }))
      .filter((option) => option.count > 0)

    facets.push({ key, label: KITS_FACET_LABEL[key], options })
  }
  return facets
}

/**
 * 条件を変えたあと、0件になってしまう他の条件を外す。
 * （例: ラ・リーガを選んだのに、クラブがリヴァプールのまま）
 * いま選んだ項目（keep）は外さず、ほかの項目の方を外す。
 */
export function normalizeKitsFilter(views: ProductView[], filter: KitsFilter, keep?: KitsFacetKey): KitsFilter {
  const next = { ...filter }
  for (const key of KITS_FACET_ORDER) {
    if (next[key] === null || key === keep) continue
    if (!views.some((view) => facetValue(view, key) === next[key] && matches(view, next, key))) {
      next[key] = null
    }
  }
  return next
}

/* ------------------------------------------------------------
 * ページ全体
 * ---------------------------------------------------------- */

export interface KitsClubSummary {
  nameJa: string
  href: string
  leagueNameJa: string
  count: number
  /** 掲載している種類（ホーム・アウェイ…の順）。 */
  kitTypes: string[]
  seasons: string[]
}

export interface KitsIndex {
  title: string
  description: string
  h1: string
  lead: string
  /** 一覧に出すユニフォーム（クラブ順）。 */
  kits: ProductView[]
  clubs: KitsClubSummary[]
  leagueCount: number
  /** 掲載している種類と件数（ホーム・アウェイ…の順）。 */
  kitTypeCounts: { label: string; count: number }[]
  seasons: string[]
  hasOverseasPrice: boolean
  hasDomesticPrice: boolean
}

/** 商品の中からユニフォームだけを取り出す。 */
export function selectKits(views: ProductView[]): ProductView[] {
  return views.filter((view) => view.product.category === 'kits')
}

export function buildKitsIndex(allViews: ProductView[]): KitsIndex {
  const kits = sortKits(selectKits(allViews), 'club')

  const clubs: KitsClubSummary[] = []
  for (const view of kits) {
    let summary = clubs.find((item) => item.href === `/clubs/${view.club.slug}/`)
    if (!summary) {
      summary = {
        nameJa: view.club.nameJa,
        href: `/clubs/${view.club.slug}/`,
        leagueNameJa: view.league.nameJa,
        count: 0,
        kitTypes: [],
        seasons: [],
      }
      clubs.push(summary)
    }
    summary.count++
    const kitLabel = view.product.kitType ? KIT_TYPE_LABEL[view.product.kitType] : null
    if (kitLabel && !summary.kitTypes.includes(kitLabel)) summary.kitTypes.push(kitLabel)
    if (view.product.season && !summary.seasons.includes(view.product.season)) {
      summary.seasons.push(view.product.season)
    }
  }
  for (const summary of clubs) summary.seasons.sort((a, b) => b.localeCompare(a))

  const leagueNames = [...new Set(kits.map((view) => view.league.nameJa))]
  const kitTypeCounts = KIT_TYPE_ORDER.map((kitType) => ({
    label: KIT_TYPE_LABEL[kitType],
    count: kits.filter((view) => view.product.kitType === kitType).length,
  })).filter((entry) => entry.count > 0)
  const seasons = [
    ...new Set(kits.map((view) => view.product.season).filter((s): s is string => Boolean(s))),
  ].sort((a, b) => b.localeCompare(a))

  const hasOverseasPrice = kits.some((view) => view.overseas !== null)
  const hasDomesticPrice = kits.some((view) => view.comparison.domesticPrice.reference !== null)

  /* ---- title / description / H1 ----
     ★クラブ名は title・H1 に入れない★（「クラブ名 ユニフォーム」はクラブページの担当）。
     description ではリーグ名と件数だけを出し、クラブ名の羅列はしない。 */
  const title = '海外サッカーユニフォーム一覧'
  const h1 = '海外サッカーユニフォーム'

  const scope =
    kits.length > 0
      ? `${leagueNames.join('・')}の${clubs.length}クラブのユニフォーム${kits.length}点`
      : null
  const kinds = kitTypeCounts.map((entry) => entry.label).join('・')
  // ★価格が無いのに「比較できます」と言わない★
  const pricing = hasOverseasPrice
    ? '海外ストアの価格がある商品は、日本到着推定額も確認できます。'
    : hasDomesticPrice
      ? '国内の販売価格がある商品は、その価格を確認できます。'
      : ''
  const description = scope
    ? `${scope}を、クラブや種類（${kinds}）で横断して探せます。${pricing}`
    : '海外サッカークラブのユニフォームは準備中です。'
  const lead = scope
    ? `${scope}を、クラブをまたいで一覧にしています。クラブや種類で絞り込めます。`
    : '海外サッカークラブのユニフォームは準備中です。'

  return {
    title,
    description,
    h1,
    lead,
    kits,
    clubs,
    leagueCount: leagueNames.length,
    kitTypeCounts,
    seasons,
    hasOverseasPrice,
    hasDomesticPrice,
  }
}

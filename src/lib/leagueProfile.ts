/**
 * リーグページの「そのリーグだけの情報」を、既存データから組み立てる。
 *
 * ══════════════════════════════════════════════════════════
 * ★文章を書き足すための仕組みではありません。★
 *
 *   ここで作るのは、すでにリポジトリにあるデータを
 *   リーグから探しに来た人が使いやすい形に並べ直したものだけです。
 *
 *     ・リーグの基本情報（英語表記・国・クラブ数・商品数・メーカー・シーズン）
 *     ・所属クラブへの導線
 *     ・関連ページ（ほかのリーグ・クラブ一覧・ユニフォーム一覧・セール・ランキング）
 *
 *   データに無いこと（順位表・試合結果・選手・歴史）は書きません。
 *   推測で埋めた文章は、間違っていても気付けないためです。
 *
 * ★価格が無いのに「比較できます」と言いません。★
 *   クラブページと同じ考え方です。商品はあるが価格を1つも確認できていない
 *   リーグ（セリエA・リーグ・アン・エールディヴィジ）で
 *   「価格を比較できます」と書くと、開いた人の期待を裏切ります。
 *
 * ★リーグ名・slug を直接書きません。★
 *   ブンデスリーガなどが増えても、fixture へ1行足すだけで同じ形になります。
 * ══════════════════════════════════════════════════════════
 */

import type { League, ProductCategory } from '@/domain/types'
import type { ProductView } from '@/data/viewModels'
import { CATEGORY_LABEL, KIT_TYPE_LABEL } from '@/lib/labels'
import { formatMakers, summarizeConfirmedMakers } from '@/lib/makers'

export interface LeagueProfileClub {
  nameJa: string
  href: string
  productCount: number
}

export interface LeagueProfileLink {
  label: string
  href: string
}

export interface LeagueProfileInput {
  league: League
  /** このリーグに所属し、商品があるクラブ（表示順のまま）。 */
  clubs: LeagueProfileClub[]
  /** このリーグの掲載商品すべて。 */
  views: ProductView[]
  /** ほかのリーグ（中身があるものだけ。自分は含めない）。 */
  relatedLeagues: LeagueProfileLink[]
  /** セール一覧の件数（0なら導線を出さない）。 */
  saleCount: number
  /** ランキングの件数（0なら導線を出さない）。 */
  rankingCount: number
  /** ユニフォーム一覧（/kits/）へのパス。出さないときは null。 */
  kitsIndexHref?: string | null
}

export interface LeagueProfile {
  /** ページのタイトル（「| サカモノ」は含まない）。 */
  title: string
  description: string
  h1: string
  lead: string
  facts: { label: string; value: string; href?: string }[]
  /** 掲載商品の内訳（カテゴリごと）。 */
  categories: { label: string; count: number }[]
  /** 掲載しているユニフォームの種類（ホーム・アウェイ…）。 */
  kitTypes: { label: string; count: number }[]
  totalClubs: number
  totalProducts: number
  seasons: string[]
  hasOverseasPrice: boolean
  hasDomesticPrice: boolean
  /** 商品セクションの説明文。価格が無ければ「比較できます」と言わない。 */
  productsNote: string
  related: LeagueProfileLink[]
}

// カテゴリの並びはラベル辞書の順をそのまま使う（分類が増えてもここを直さなくてよい）
const CATEGORY_ORDER = Object.keys(CATEGORY_LABEL) as ProductCategory[]

const KIT_ORDER = ['home', 'away', 'third', 'goalkeeper', 'special'] as const

/** 新しいシーズンを先に。 */
function newestFirst(a: string, b: string): number {
  return b.localeCompare(a)
}

export function buildLeagueProfile(input: LeagueProfileInput): LeagueProfile {
  const { league, clubs, views } = input

  const hasKits = views.some((view) => view.product.category === 'kits')
  const hasOther = views.some((view) => view.product.category !== 'kits')
  const hasOverseasPrice = views.some((view) => view.overseas !== null)
  const hasDomesticPrice = views.some((view) => view.comparison.domesticPrice.reference !== null)
  const hasAnyPrice = hasOverseasPrice || hasDomesticPrice

  /* ---- 何を扱っているか（無いものを名乗らない）---- */
  const goodsWord = hasKits && hasOther ? 'ユニフォーム・グッズ' : hasKits ? 'ユニフォーム' : 'グッズ'

  const seasons = [
    ...new Set(views.map((view) => view.product.season).filter((s): s is string => Boolean(s))),
  ].sort(newestFirst)

  const categories = CATEGORY_ORDER.map((category) => ({
    label: CATEGORY_LABEL[category],
    count: views.filter((view) => view.product.category === category).length,
  })).filter((entry) => entry.count > 0)

  const kitTypes = KIT_ORDER.map((kitType) => ({
    label: KIT_TYPE_LABEL[kitType],
    count: views.filter((view) => view.product.kitType === kitType).length,
  })).filter((entry) => entry.count > 0)

  /* ---- 基本情報 ---- */
  const facts: LeagueProfile['facts'] = [{ label: '英語表記', value: league.name }]
  if (league.country) facts.push({ label: '国', value: league.country })
  if (clubs.length > 0) facts.push({ label: '掲載クラブ', value: `${clubs.length}クラブ` })
  if (views.length > 0) facts.push({ label: '掲載商品', value: `${views.length}点` })
  const makers = formatMakers(summarizeConfirmedMakers(views))
  if (makers) facts.push({ label: 'メーカー', value: makers })
  if (seasons.length > 0) facts.push({ label: 'シーズン', value: seasons.join('・') })
  if (kitTypes.length > 0) {
    facts.push({ label: 'ユニフォームの種類', value: kitTypes.map((entry) => entry.label).join('・') })
  }

  /* ---- 見出しと説明（実データだけで作る）---- */
  const h1 = views.length > 0 ? `${league.nameJa}のクラブと${goodsWord}` : league.nameJa
  const title =
    views.length === 0
      ? `${league.nameJa}のクラブ一覧`
      : hasAnyPrice
        ? `${league.nameJa}の${goodsWord}価格比較`
        : `${league.nameJa}のクラブと${goodsWord}`

  const scope =
    clubs.length > 0 && views.length > 0
      ? `${league.nameJa}（${league.name}）の${clubs.length}クラブ・${goodsWord}${views.length}点`
      : null
  const description = !scope
    ? `${league.nameJa}（${league.name}）のクラブは準備中です。`
    : hasOverseasPrice
      ? `${scope}を掲載。海外公式ストアの価格と日本到着推定額で比べられます。`
      : hasDomesticPrice
        ? `${scope}を掲載。国内の販売価格を確認できます。`
        : `${scope}を掲載しています（価格は確認中です）。`

  const lead = scope
    ? `${league.name}・${league.country}｜${clubs.length}クラブ・${views.length}点を掲載`
    : `${league.name}・${league.country}`

  /* ---- 商品セクションの説明（価格が無いのに比較を名乗らない）---- */
  const productsNote = hasOverseasPrice
    ? '海外価格と日本到着推定額を並べて比較できます。'
    : hasDomesticPrice
      ? '国内の販売価格を確認できます。'
      : views.length > 0
        ? '価格はまだ確認できていません。商品の品番・仕様は各ページで確認できます。'
        : 'このリーグの商品は準備中です。'

  /* ---- 関連ページ（実在して中身があるものだけ）---- */
  const related: LeagueProfileLink[] = []
  for (const other of input.relatedLeagues) {
    related.push({ label: `${other.label}のクラブと商品`, href: other.href })
  }
  if (input.kitsIndexHref && hasKits) {
    related.push({ label: 'ほかのリーグのユニフォーム（ユニフォーム一覧）', href: input.kitsIndexHref })
  }
  if (input.saleCount > 0) related.push({ label: 'セール中の商品（全クラブ）', href: '/sale/' })
  if (input.rankingCount > 0) {
    related.push({ label: '海外の方が安い商品のランキング（全クラブ）', href: '/rankings/' })
  }
  related.push({ label: 'クラブから探す', href: '/clubs/' })
  related.push({ label: 'ほかのリーグを探す', href: '/leagues/' })

  return {
    title,
    description,
    h1,
    lead,
    facts,
    categories,
    kitTypes,
    totalClubs: clubs.length,
    totalProducts: views.length,
    seasons,
    hasOverseasPrice,
    hasDomesticPrice,
    productsNote,
    related,
  }
}

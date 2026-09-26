/**
 * クラブページの「そのクラブだけの情報」を、既存データから組み立てる。
 *
 * ══════════════════════════════════════════════════════════
 * ★文章を書き足すための仕組みではありません。★
 *
 *   ここで作るのは、すでにリポジトリにあるデータを
 *   クラブを探しに来た人が使いやすい形に並べ直したものだけです。
 *
 *     ・クラブの基本情報（英語表記・リーグ・国・公式オンラインストア）
 *     ・このページで探せる商品の内訳（カテゴリ・シーズン）
 *     ・ユニフォームの種類ごとの一覧（ホーム／アウェイ…、仕様・対象の違い）
 *     ・購入先の確かめ方
 *     ・関連ページ（リーグ・同じリーグのクラブ・セール・ランキング）
 *
 *   データに無いこと（クラブの歴史・スタジアム・選手の話など）は書きません。
 *   推測で埋めた文章は、間違っていても気付けないためです。
 *
 * ★メーカー名は「品番を公式確認できた商品」からだけ拾います。★
 *   以前は一切使っていませんでした。開発用データに、シーズンとメーカーの
 *   組み合わせが実際と違うものが混ざっていたためです
 *   （2025/26 のリヴァプールは adidas なのに Nike になっている商品がありました）。
 *
 *   その誤記は直し、品番の無い商品が根拠のないメーカー名を名乗らないことを
 *   検査（src/tests/officialChecks.test.ts）で守るようにしました。
 *   そこで、品番があるもの＝公式情報と突き合わせ済みのものに限って表示します。
 *   品番の無い商品のメーカー表記（'確認中' やクラブ自身の名前）は使いません。
 * ══════════════════════════════════════════════════════════
 *
 * ★この関数はデータを受け取って結果を返すだけです。★
 *   データの取得はページ（src/app/clubs/[slug]/page.tsx）が行います。
 */

import type { Club, KitType, League, ProductCategory } from '@/domain/types'
import type { ProductView } from '@/data/viewModels'
import { clubAliases } from '@/lib/matching/aliases'
import { formatMakers, summarizeConfirmedMakers } from '@/lib/makers'
import { AUTHENTICITY_LABEL, CATEGORY_LABEL, GENDER_LABEL, KIT_TYPE_LABEL } from '@/lib/labels'

/* ------------------------------------------------------------
 * 適用範囲
 * ---------------------------------------------------------- */

/*
 * ★全クラブのページで使います。★
 *   リヴァプール（データ量が最も多い）とレアル・マドリード（ユニフォームだけ・ホームだけ・
 *   セール0点）で確かめてから、全クラブへ広げました。
 *   クラブごとの手書きの文章は持たず、どのクラブも同じ組み立て方です。
 *
 * ★クラブを追加するときは、データ側で確かめてください。★
 *   officialStoreUrl は「公式オンラインストア」としてそのまま表示・リンクされます。
 *   実在するクラブ公式のストアかを確かめてから登録してください。
 */

/* ------------------------------------------------------------
 * 入力・出力
 * ---------------------------------------------------------- */

export interface ClubProfileInput {
  club: Club
  league: League | null
  /** そのクラブの商品（クラブページに並んでいるものと同じ）。 */
  views: ProductView[]
  /** 同じリーグで、ページを検索に出しているクラブ（自分自身は含めない）。 */
  relatedClubs: { nameJa: string; href: string }[]
  /** セール一覧・ランキングに載っている商品数（0 ならリンクしない）。 */
  saleCount: number
  rankingCount: number
  /**
   * 全クラブ横断のユニフォーム一覧（/kits/）のパス。
   * 検索に出していないとき（ユニフォームのあるクラブが2つ未満など）は null。
   */
  kitsIndexHref?: string | null
}

export interface ClubProfileLink {
  label: string
  href: string
}

export interface ClubProfile {
  /** ページのタイトル（「| サカモノ」は含まない）。 */
  title: string
  description: string
  h1: string
  /** 日本語表記の別の書き方（例: リバプール）。無ければ null。 */
  altNameJa: string | null
  /** 基本情報。 */
  facts: { label: string; value: string; href?: string; external?: boolean }[]
  /** 掲載商品の内訳（カテゴリごと。同じページ内の見出しへのリンク）。 */
  categories: { label: string; count: number; href: string }[]
  totalProducts: number
  /** 掲載しているシーズン（新しい順）。 */
  seasons: string[]
  /**
   * ユニフォームの種類ごとの商品。
   * ★ユニフォームが2点未満なら空★（1点だけなら商品一覧と同じ内容になるため）。
   */
  kitGroups: { kitType: string; label: string; items: ClubProfileLink[] }[]
  /**
   * 「種類から探す」の説明文。
   * ★このクラブの商品の中で、実際に違いがある項目だけを挙げる★。違いが無ければ null。
   */
  kitGuideNote: string | null
  /** 海外価格（日本到着推定額の元）を持つ商品があるか。 */
  hasOverseasPrice: boolean
  /** 国内価格を持つ商品があるか。 */
  hasDomesticPrice: boolean
  /** 関連ページ。 */
  related: ClubProfileLink[]
  /** 公式オンラインストアのURL（無ければ null）。 */
  officialStoreUrl: string | null
}

/* ------------------------------------------------------------
 * 組み立て
 * ---------------------------------------------------------- */

const KIT_ORDER: NonNullable<KitType>[] = ['home', 'away', 'third', 'goalkeeper', 'special']

/**
 * 画面に出す日本語の別表記。
 *
 * ★自動では選びません。根拠を確認できたクラブだけ、ここに書きます。★
 *
 *   品質ゲート（第2回）で、照合用の言い換え辞書から自動で選ぶ方式を試したところ、
 *   「トッテナム・ホットスパー（トットナム）」「レアル・マドリード（レアルマドリッド）」
 *   のように、実際にはあまり使われない表記が選ばれました。
 *   照合用の辞書は「拾い漏らさないため」に珍しい表記も入れてあるので、
 *   画面に出す表記の根拠にはなりません。
 *
 *   追加するときは、国内ECの実データの商品名で、
 *   その表記がどれくらい使われているかを確かめてからにしてください。
 */
export const CLUB_ALT_NAME_JA: Readonly<Record<string, string>> = {
  // 国内ECの実データ（Yahoo!・楽天の商品名）で「リバプール」435件、「リヴァプール」45件
  liverpool: 'リバプール',
}

/**
 * 日本語表記の別の書き方。登録が無いクラブは null。
 *
 * 照合エンジン用の言い換え辞書（src/lib/matching/aliases.ts）に入っている表記だけを
 * 認めます（辞書に無い表記を画面にだけ出すことはしない）。
 */
export function pickAltNameJa(slug: string, nameJa: string): string | null {
  const alt = CLUB_ALT_NAME_JA[slug]
  if (!alt || alt === nameJa) return null
  return clubAliases(slug).includes(alt) ? alt : null
}

/** 同じ種類のユニフォームの中で、1点ずつを見分けるための短い説明。 */
function describeKitVariant(view: ProductView): string {
  const { product } = view
  const parts: string[] = []
  if (product.season) parts.push(product.season)
  if (product.authenticity === 'replica' || product.authenticity === 'authentic') {
    parts.push(AUTHENTICITY_LABEL[product.authenticity])
  }
  const extras: string[] = []
  if (product.sleeve === 'long') extras.push('長袖')
  if (product.gender === 'kids' || product.gender === 'women') extras.push(GENDER_LABEL[product.gender])
  if (product.player) extras.push(`${product.player}の選手名入り`)
  return extras.length > 0 ? `${parts.join(' ')}（${extras.join('・')}）` : parts.join(' ')
}

function sortViews(a: ProductView, b: ProductView): number {
  // 新しいシーズン → レプリカ → 通常（無地・大人用・半袖）の順
  const season = (b.product.season ?? '').localeCompare(a.product.season ?? '')
  if (season !== 0) return season
  const auth = (v: ProductView) => (v.product.authenticity === 'replica' ? 0 : 1)
  if (auth(a) !== auth(b)) return auth(a) - auth(b)
  const plain = (v: ProductView) =>
    (v.product.sleeve === 'long' ? 1 : 0) +
    (v.product.gender === 'kids' || v.product.gender === 'women' ? 1 : 0) +
    (v.product.player ? 1 : 0)
  return plain(a) - plain(b)
}

export function buildClubProfile(input: ClubProfileInput): ClubProfile {
  const { club, league, views } = input
  const altNameJa = pickAltNameJa(club.slug, club.nameJa)

  /* ---- 内訳 ---- */
  const categoryOrder = Object.keys(CATEGORY_LABEL) as ProductCategory[]
  const categories = categoryOrder
    .map((category) => ({
      category,
      count: views.filter((view) => view.product.category === category).length,
    }))
    .filter((entry) => entry.count > 0)
    .map((entry) => ({
      label: CATEGORY_LABEL[entry.category],
      count: entry.count,
      // クラブページの各カテゴリ見出しの id（cat-kits など）へ移動する
      href: `#cat-${entry.category}`,
    }))

  const seasons = [
    ...new Set(views.map((view) => view.product.season).filter((s): s is string => Boolean(s))),
  ].sort((a, b) => b.localeCompare(a))

  /* ---- ユニフォームの種類ごと ---- */
  const kits = views.filter((view) => view.product.category === 'kits')
  const allKitGroups = KIT_ORDER.map((kitType) => ({
    kitType,
    label: KIT_TYPE_LABEL[kitType],
    items: kits
      .filter((view) => view.product.kitType === kitType)
      .sort(sortViews)
      .map((view) => ({ label: describeKitVariant(view), href: view.href })),
  })).filter((group) => group.items.length > 0)
  // ★ユニフォームが1点だけなら、商品一覧と同じ内容の繰り返しになるので出さない★
  const kitGroups = kits.length >= 2 ? allKitGroups : []
  const kitGuideNote = kitGroups.length > 0 ? describeKitDifferences(kits) : null

  /* ---- 価格の有無（文章で「比較できます」と言ってよいか）---- */
  const hasOverseasPrice = views.some((view) => view.overseas !== null)
  const hasDomesticPrice = views.some((view) => view.comparison.domesticPrice.reference !== null)

  /* ---- 基本情報 ---- */
  const facts: ClubProfile['facts'] = [{ label: '英語表記', value: club.name }]
  if (league) facts.push({ label: '所属リーグ', value: league.nameJa, href: `/leagues/${league.slug}/` })
  if (club.country) facts.push({ label: '国', value: club.country })
  // メーカーの表示文は、クラブページとリーグページで同じものを使う（src/lib/makers.ts）
  const makers = formatMakers(summarizeConfirmedMakers(views))
  if (makers) facts.push({ label: 'メーカー', value: makers })

  const officialStoreUrl = club.officialStoreUrl?.startsWith('https://') ? club.officialStoreUrl : null
  if (officialStoreUrl) {
    facts.push({
      label: '公式オンラインストア',
      value: new URL(officialStoreUrl).host,
      href: officialStoreUrl,
      external: true,
    })
  }

  /* ---- 関連ページ（実在して検索に出しているものだけ）---- */
  const related: ClubProfileLink[] = []
  // 商品のあるクラブのリーグは、少なくとも1クラブ・1商品を持つので中身がある
  if (league && views.length > 0) {
    related.push({ label: `${league.nameJa}のクラブと商品`, href: `/leagues/${league.slug}/` })
  }
  for (const other of input.relatedClubs) {
    // ★相手のクラブに何があるかは、ここでは分からないので「掲載商品」とだけ言う★
    related.push({ label: `${other.nameJa}の掲載商品`, href: other.href })
  }
  // ユニフォームのあるクラブだけ、他クラブのユニフォームと見比べられる一覧へ
  if (input.kitsIndexHref && views.some((view) => view.product.category === 'kits')) {
    related.push({ label: 'ほかのクラブのユニフォーム（ユニフォーム一覧）', href: input.kitsIndexHref })
  }
  if (input.saleCount > 0) related.push({ label: 'セール中の商品（全クラブ）', href: '/sale/' })
  if (input.rankingCount > 0) {
    related.push({ label: '海外の方が安い商品のランキング（全クラブ）', href: '/rankings/' })
  }
  related.push({ label: 'ほかのクラブを探す', href: '/clubs/' })

  /* ---- title / description / H1 ---- */
  // ★実際にある商品だけを名前に入れる★（グッズが0点なのに「グッズ」と言わない）
  const hasKits = kits.length > 0
  const hasGoods = views.some((view) => view.product.category !== 'kits')
  const subject = hasKits && hasGoods ? 'ユニフォーム・グッズ' : hasKits ? 'ユニフォーム' : hasGoods ? 'グッズ' : null

  const displayName = altNameJa ? `${club.nameJa}（${altNameJa}）` : club.nameJa
  const title = subject ? `${displayName}の${subject}価格比較` : displayName
  const h1 = subject ? `${club.nameJa}の${subject}` : club.nameJa

  const otherCategories = categories.filter((c) => c.label !== CATEGORY_LABEL.kits).map((c) => c.label)
  const kitTypes = allKitGroups.map((group) => group.label)
  const seasonText = seasons.length > 0 ? `${seasons.join('・')}シーズンの` : ''
  const kitText = hasKits ? `ユニフォーム${kitTypes.length > 0 ? `（${kitTypes.join('・')}）` : ''}` : ''
  const items = [kitText, ...otherCategories].filter(Boolean).join('、')
  // ★価格が無いのに「比較できます」と言わない★
  const pricing = hasOverseasPrice
    ? 'を、海外公式ストアの価格と日本到着推定額で比較できます。'
    : hasDomesticPrice
      ? 'の、国内の販売価格を確認できます。'
      : 'を掲載しています（価格は確認中です）。'
  const description = items
    ? `${club.nameJa}（${club.name}）の${seasonText}${items}${pricing}`
    : `${club.nameJa}（${club.name}）の商品は準備中です。`

  return {
    title,
    description,
    h1,
    altNameJa,
    facts,
    categories,
    totalProducts: views.length,
    seasons,
    kitGroups,
    kitGuideNote,
    hasOverseasPrice,
    hasDomesticPrice,
    related,
    officialStoreUrl,
  }
}

/**
 * 「種類から探す」の説明文を作る。
 *
 * ★このクラブのユニフォームの中で、実際に違いがある項目だけを挙げる。★
 *   リヴァプールのように半袖・長袖、大人用・子供用が並ぶクラブと、
 *   レプリカとオーセンティックしか無いクラブで、同じ説明を出さないため。
 *
 * ★違いは「同じ種類（ホーム・アウェイ…）の中」だけで数える。★
 *   文が「同じ種類のユニフォームでも」で始まるため。
 *   例: ホームがメンズ、サードがウィメンズだけのクラブで「メンズとウィメンズは別の商品」と書かない。
 */
function describeKitDifferences(kits: ProductView[]): string | null {
  const byType = KIT_ORDER.map((kitType) => kits.filter((view) => view.product.kitType === kitType))
  const distinct = <T>(pick: (view: ProductView) => T) =>
    byType.some((group) => new Set(group.map(pick)).size > 1)
  const pairs: string[] = []
  if (distinct((v) => v.product.authenticity)) pairs.push('レプリカとオーセンティック')
  if (distinct((v) => v.product.sleeve)) pairs.push('半袖と長袖')
  if (distinct((v) => (v.product.gender === 'kids' ? 'kids' : 'adult'))) pairs.push('大人用と子供用')
  if (distinct((v) => v.product.gender === 'women')) pairs.push('メンズとウィメンズ')
  if (distinct((v) => Boolean(v.product.player))) pairs.push('無地と選手名入り')
  if (pairs.length === 0) return null
  return `同じ種類のユニフォームでも、${pairs.join('、')}は別の商品で、価格も違います。`
}

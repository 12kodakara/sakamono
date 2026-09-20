/**
 * 商品一致の判定エンジン。
 *
 * 第1〜3段階で「第4段階で作る」と書いてきたものが、これです。
 *
 *   サカモノの商品  ×  国内ECの商品名
 *          ↓
 *   項目ごとに「一致 / 不一致 / 不明」を判定
 *          ↓
 *   confidence（0〜1）と ランク（A/B/C/D）
 *
 * ══════════════════════════════════════════════════════════
 * ★★ このファイルの設計で最も大事な考え方 ★★
 *
 *   点数を足し引きするだけでは足りない。
 *
 *   レプリカとオーセンティック、ホームとアウェイ、子供用と大人用、
 *   半袖と長袖、無地と選手名入りは、
 *   「少し似ていない」のではなく「別の商品」です。
 *   点数を下げるだけだと、他の項目が全部一致していれば
 *   合計点で基準を超えてしまいます。
 *
 *   そこで「これが食い違ったら、他が何点でも不採用」という
 *   hardReject の仕組みを別に用意しています。
 *
 * ══════════════════════════════════════════════════════════
 * ★★ 判定の順番（第4.6段階で明確にしたところ）★★
 *
 *   1. 項目ごとに 一致 / 不一致 / 不明 を出す
 *   2. ★先に hardReject を判定する★
 *   3. hardReject でなければ点数を付ける
 *
 *   2 と 3 の順番を逆にしてはいけません。
 *   「JANが一致している」「品番が一致している」という強い根拠があっても、
 *   袖丈やシーズンが食い違っていれば別商品です。
 *   陽性の根拠で矛盾を上書きすると、そこから誤一致が入り込みます。
 * ══════════════════════════════════════════════════════════
 */

import type {
  ConfidenceGrade,
  MatchMethod,
  Personalization,
  Product,
  ProductCondition,
} from '@/domain/types'
import {
  AUTHENTICITY_TERMS,
  GENDER_TERMS,
  KIT_TYPE_TERMS,
  OTHER_CLUB_TERMS,
  USED_TERMS,
  allManufacturerKeys,
  classifyPersonalization,
  clubAliases,
  detectSleeve,
  looksLikeBundle,
  manufacturerAliases,
  playerAliases,
  squadTerms,
  SPEC_VARIANT_TERMS,
} from './aliases'
import {
  containsAnyTerm,
  extractSeasons,
  isDistributableJan,
  isEanUsableAsJan,
  normalizeCode,
  normalizeLight,
  normalizeText,
  padded,
} from './textNormalize'
import { CONDITION_UNKNOWN_REVIEW_REASON, toConfidenceGrade } from './confidence'

/* ------------------------------------------------------------
 * 判定の単位
 * ---------------------------------------------------------- */

export type MatchDimension =
  | 'jan'
  | 'sku'
  | 'club'
  | 'manufacturer'
  | 'season'
  | 'kitType'
  | 'authenticity'
  | 'gender'
  | 'sleeve'
  | 'marking'
  | 'bundle'
  | 'condition'
  | 'price'

export const MATCH_DIMENSION_LABEL_JA: Record<MatchDimension, string> = {
  jan: 'JANコード',
  sku: 'メーカー品番',
  club: 'クラブ',
  manufacturer: 'メーカー',
  season: 'シーズン',
  kitType: 'ユニフォームの種類',
  authenticity: 'レプリカ／オーセンティック',
  gender: '対象（メンズ／キッズ等）',
  sleeve: '袖丈（半袖／長袖／ノースリーブ）',
  marking: 'マーキング（無地／選手名入り）',
  bundle: '単品かセットか',
  condition: '新品／中古',
  price: '価格の妥当性',
}

/** その項目の判定結果。 */
export type DimensionVerdict =
  /** 一致している */
  | 'match'
  /** 食い違っている */
  | 'mismatch'
  /** 判断できない（★一致とみなさない★） */
  | 'unknown'
  /** そもそもその項目が関係ない */
  | 'not-applicable'

export interface MatchSignal {
  dimension: MatchDimension
  verdict: DimensionVerdict
  /** 何をどう判断したか（画面や管理者向けの説明）。 */
  note: string
}

/** 検索のどの手掛かりで見つけた候補か。 */
export type MatchLevel = 'jan' | 'ean-as-jan' | 'sku' | 'attributes'

export const MATCH_LEVEL_LABEL_JA: Record<MatchLevel, string> = {
  jan: 'JANコード一致',
  'ean-as-jan': 'EAN（国内JANとして利用可）一致',
  sku: 'メーカー品番一致',
  attributes: '商品属性の一致',
}

/* ------------------------------------------------------------
 * 不採用の理由コード
 * ---------------------------------------------------------- */

/**
 * 「別商品だから不採用」の理由。
 *
 * ★項目名（MatchDimension）とは別に、理由の名前を持たせています。★
 *   ログや管理画面で「なぜ落ちたか」を追うとき、
 *   'sleeve' より 'sleeveMismatch' の方が意味がはっきりします。
 */
export type HardRejectCode =
  | 'wrongClub'
  | 'wrongManufacturer'
  | 'wrongSeason'
  | 'wrongKitType'
  | 'authenticityMismatch'
  | 'genderMismatch'
  | 'sleeveMismatch'
  | 'personalizationMismatch'
  | 'bundleMismatch'
  | 'usedCondition'

/**
 * 食い違ったら不採用にする項目と、その理由コード。
 *
 * ★ここに入っている項目は「別商品である」ことを意味します。★
 * 　点数を下げるのではなく、比較そのものから外します。
 *
 * ★JANの不一致は、ここに入れていません。★
 *
 *   第4.5段階の実データ検証で分かったこと:
 *   国内ECのJANは「サイズ単位」で付いていることが多く、
 *   同じシャツでもS・M・Lで別のJANになります。
 *   例）同じリヴァプール25/26ホームでも 4068809542110 / 4068809503807 …
 *
 *   そのため「JANが違う＝別商品」とすると、同じ商品を大量に取り逃がします
 *   （実測で21件中18件が不採用になりました）。
 *
 *   JANは「一致したら強い根拠」として使い、
 *   不一致は記録に残すだけにします。商品の違いは
 *   クラブ・シーズン・種類・袖丈・対象・メーカー・マーキングで見分けます。
 */
const HARD_REJECT_RULES: readonly { dimension: MatchDimension; code: HardRejectCode }[] = [
  { dimension: 'club', code: 'wrongClub' },
  { dimension: 'manufacturer', code: 'wrongManufacturer' },
  { dimension: 'season', code: 'wrongSeason' },
  { dimension: 'kitType', code: 'wrongKitType' },
  { dimension: 'authenticity', code: 'authenticityMismatch' },
  { dimension: 'gender', code: 'genderMismatch' },
  { dimension: 'sleeve', code: 'sleeveMismatch' },
  { dimension: 'marking', code: 'personalizationMismatch' },
  { dimension: 'bundle', code: 'bundleMismatch' },
  { dimension: 'condition', code: 'usedCondition' },
]

export const HARD_REJECT_LABEL_JA: Record<HardRejectCode, string> = {
  wrongClub: 'クラブが違う',
  wrongManufacturer: 'メーカーが違う',
  wrongSeason: 'シーズンが違う',
  wrongKitType: 'ユニフォームの種類が違う',
  authenticityMismatch: 'レプリカ／オーセンティックが違う',
  genderMismatch: '対象（メンズ／キッズ等）が違う',
  sleeveMismatch: '袖丈が違う',
  personalizationMismatch: 'マーキング（無地／選手名入り）が違う',
  bundleMismatch: 'セット商品なので中身が違う',
  usedCondition: '新品ではない',
}

/* ------------------------------------------------------------
 * JANの証拠の強さ
 * ---------------------------------------------------------- */

/**
 * JANを照合した結果を3つの状態で持つ。
 *
 *   exact       … 一致した（もっとも強い根拠）
 *   conflicting … 両方あるが違う値だった（★これだけでは不採用にしない★）
 *   missing     … どちらかが無く、照合できなかった
 *
 * ★conflicting を「別商品」と決めつけないこと。★
 *   国内ECのJANはサイズ単位で付いていることが多く、
 *   同じ商品でもサイズが違えば別のJANになります。
 *   商品（Product）側が代表の1つしか持っていなければ、
 *   同じ商品でも conflicting になります。
 */
export type JanEvidence = 'exact' | 'conflicting' | 'missing'

/* ------------------------------------------------------------
 * 判定結果
 * ---------------------------------------------------------- */

export interface MatchEvaluation {
  confidence: number
  grade: ConfidenceGrade
  matchMethod: MatchMethod
  matchLevel: MatchLevel
  /** ★これが true なら、点数に関わらず比較に使わない。★ */
  hardReject: boolean
  /** hardReject になった項目。 */
  hardRejectReasons: MatchDimension[]
  /** hardReject になった理由コード（ログ・管理画面向け）。 */
  hardRejectCodes: HardRejectCode[]
  /** 人の確認へ回すべきか。 */
  requiresReview: boolean
  reviewReasons: string[]
  signals: MatchSignal[]
  /** JANを照合できたか（exact / conflicting / missing）。 */
  janEvidence: JanEvidence
  /** 「同じ商品」と考えた根拠。 */
  positiveEvidence: string[]
  /** 「違う商品かもしれない」と考えた材料。 */
  negativeEvidence: string[]
  /** 判断できなかった項目。★一致とみなしていない項目の一覧★ */
  unknownAttributes: MatchDimension[]
  /**
   * 自動検証を通ったか。
   * 'automated' のときだけ、モール型の掲載でも自動で比較に使える。
   */
  verification: 'automated' | 'none'
}

/* ------------------------------------------------------------
 * 入力
 * ---------------------------------------------------------- */

export interface MatchCandidate {
  /** 国内側の商品名（外部サイトの原文）。 */
  title: string
  /** 国内側のJANコード（取れていれば）。 */
  jan?: string | null
  /** 国内側のブランド名（取れていれば）。 */
  brandName?: string | null
  /** 国内側の状態。 */
  condition?: ProductCondition
  /** 国内側の価格（円）。極端に安い出品を見つけるのに使う。 */
  priceJpy?: number | null
}

export interface MatchContext {
  /** 比べたいサカモノ側の商品。 */
  product: Product
  /** その商品のクラブ slug（言い換え辞書を引くため）。 */
  clubSlug: string
  /**
   * 妥当な価格帯の目安（円）。海外側の商品価格の円換算など。
   * ★価格だけで信頼度を上げるためではなく、
   *   極端に安い出品を見つけて「要確認」へ送るために使う。★
   */
  referencePriceJpy?: number | null
  /**
   * サイズ（ProductVariant）ごとのJAN。分かっている分だけ。
   *
   * ★同じ商品でもサイズごとにJANが違うため、ここを見ます。★
   *   全サイズのJANをそろえる必要はありません。
   *   分かっている分だけ渡せば、その分だけ一致を拾えます。
   */
  variantJans?: readonly (string | null)[]
}

/* ------------------------------------------------------------
 * しきい値
 * ---------------------------------------------------------- */

/** 属性一致だけで到達できる上限。★自動採用（0.85）へは届かせない。★ */
export const ATTRIBUTE_ONLY_MAX_CONFIDENCE = 0.84

/** 要確認へ送るときの上限（ランクCに収める）。 */
export const REVIEW_CAP_CONFIDENCE = 0.84

/**
 * 「相場に対して安すぎる」と判断する割合。
 * 目安価格の40%を下回る出品は、正規品でない可能性を考えて要確認にする。
 */
export const SUSPICIOUS_PRICE_RATIO = 0.4

/** 「新品かどうか確認できていない」ときの要確認理由（定義は confidence.ts）。 */
export { CONDITION_UNKNOWN_REVIEW_REASON }

/* ------------------------------------------------------------
 * 項目ごとの判定
 * ---------------------------------------------------------- */

function judgeJan(
  product: Product,
  candidate: MatchCandidate,
  variantJans: readonly (string | null)[],
): MatchSignal & { state: JanEvidence } {
  const candidateJan = normalizeCode(candidate.jan)

  // サカモノ側が使えるコード:
  //   商品のJAN ／ 日本の国コードで始まるEAN ／ サイズごとのJAN
  // ★開発用のダミーJAN（2で始まるインストアコード）は使わない。★
  //   実在しないコードなので、一致することも、食い違いに意味があることもありません。
  const ownJan = isDistributableJan(product.jan) ? normalizeCode(product.jan) : null
  const ownEan = normalizeCode(product.ean)
  const usableEan = isEanUsableAsJan(product.ean) ? ownEan : null
  const variantCodes = variantJans
    .map((value) => (isDistributableJan(value) ? normalizeCode(value) : null))
    .filter((code): code is string => code !== null)

  const ownCodes = [ownJan, usableEan, ...variantCodes].filter(
    (code): code is string => code !== null,
  )

  if (ownCodes.length === 0 || !candidateJan) {
    const note =
      ownEan && !usableEan
        ? 'EANはありますが、日本の国コード（45/49）で始まらないため国内JANとしては使えません'
        : '商品コードで照合できませんでした'
    return { dimension: 'jan', verdict: 'unknown', note, state: 'missing' }
  }

  if (ownCodes.includes(candidateJan)) {
    const viaVariant = !(ownJan === candidateJan || usableEan === candidateJan)
    return {
      dimension: 'jan',
      verdict: 'match',
      note: viaVariant
        ? `サイズ別のJANが一致しました（${candidateJan}）`
        : `JANが一致しました（${candidateJan}）`,
      state: 'exact',
    }
  }

  // ★ここで「別商品」と決めない。★ サイズ違いで別JANになるのが普通のため。
  return {
    dimension: 'jan',
    verdict: 'mismatch',
    note: `JANが異なります（自社 ${ownCodes.join(' / ')} ／ 相手 ${candidateJan}）。サイズ違いでも別のJANになるため、これだけでは別商品と判断しません`,
    state: 'conflicting',
  }
}

function judgeSku(product: Product, titlePadded: string): MatchSignal & { exact: boolean } {
  const sku = normalizeCode(product.manufacturerSku)
  if (!sku || sku.length < 4) {
    return {
      dimension: 'sku',
      verdict: 'unknown',
      note: 'メーカー品番が無い、または短すぎて照合に使えません',
      exact: false,
    }
  }

  // 品番は記号入りで書かれることがあるため、記号を落とした形で探す
  const titleCode = normalizeText(titlePadded).replace(/[^0-9a-z]/g, '').toUpperCase()
  if (titleCode.includes(sku)) {
    return { dimension: 'sku', verdict: 'match', note: `メーカー品番が一致しました（${sku}）`, exact: true }
  }

  return {
    dimension: 'sku',
    verdict: 'unknown',
    note: '商品名にメーカー品番が見当たりません',
    exact: false,
  }
}

function judgeClub(clubSlug: string, titlePadded: string): MatchSignal {
  const aliases = clubAliases(clubSlug)
  const hasOwn = aliases.length > 0 && containsAnyTerm(titlePadded, aliases)
  const otherClub = OTHER_CLUB_TERMS.find((term) => containsAnyTerm(titlePadded, [term]))

  // ★別クラブの名前が入っていたら、自クラブ名があっても一致させない。★
  if (otherClub) {
    return {
      dimension: 'club',
      verdict: 'mismatch',
      note: `別クラブの名前が入っています（${otherClub}）`,
    }
  }
  if (hasOwn) {
    return { dimension: 'club', verdict: 'match', note: 'クラブ名が一致しました' }
  }
  return { dimension: 'club', verdict: 'unknown', note: '商品名にクラブ名が見当たりません' }
}

function judgeManufacturer(product: Product, candidate: MatchCandidate, titlePadded: string): MatchSignal {
  const own = product.manufacturer?.trim()
  // 第3段階の取り込みでは「確認中」が入ることがある
  if (!own || own === '確認中') {
    return { dimension: 'manufacturer', verdict: 'unknown', note: 'メーカーが未確認です' }
  }

  const ownTerms = manufacturerAliases(own)
  const brandPadded = candidate.brandName ? padded(candidate.brandName) : null

  // ブランド名が取れているときは、そちらを優先して見る
  const haystack = brandPadded ?? titlePadded
  if (containsAnyTerm(haystack, ownTerms)) {
    return { dimension: 'manufacturer', verdict: 'match', note: `メーカーが一致しました（${own}）` }
  }

  // ★別ブランドがはっきり書かれていたら不一致。★
  //   adidas の商品に Nike の商品が当たるのを防ぐ。
  const ownKey = own.toLowerCase()
  const otherBrand = allManufacturerKeys()
    .filter((key) => key !== ownKey)
    .find((key) => containsAnyTerm(haystack, manufacturerAliases(key)))

  if (otherBrand) {
    return {
      dimension: 'manufacturer',
      verdict: 'mismatch',
      note: `別メーカーの商品です（自社 ${own} ／ 相手 ${otherBrand}）`,
    }
  }

  return { dimension: 'manufacturer', verdict: 'unknown', note: 'メーカーを判断できませんでした' }
}

function judgeSeason(product: Product, title: string): MatchSignal {
  if (!product.season) {
    return { dimension: 'season', verdict: 'unknown', note: '自社側のシーズンが未確認です' }
  }

  const found = extractSeasons(title)
  if (found.length === 0) {
    return { dimension: 'season', verdict: 'unknown', note: '商品名にシーズン表記が見当たりません' }
  }
  if (found.includes(product.season)) {
    return { dimension: 'season', verdict: 'match', note: `シーズンが一致しました（${product.season}）` }
  }
  return {
    dimension: 'season',
    verdict: 'mismatch',
    note: `シーズンが異なります（自社 ${product.season} ／ 相手 ${found.join(' / ')}）`,
  }
}

/**
 * 辞書から、商品名が示している種別を1つ求める。
 * 複数当てはまった場合は判断できないものとして null を返す。
 */
function detectFromTerms<T extends string>(
  titlePadded: string,
  terms: Record<T, readonly string[]>,
): T | null {
  const hits = (Object.keys(terms) as T[]).filter(
    (key) => terms[key].length > 0 && containsAnyTerm(titlePadded, terms[key]),
  )
  return hits.length === 1 ? hits[0] : null
}

/**
 * ホーム / アウェイ / サード を判定する。
 *
 * ★書かれていないものを「ホーム」と決めつけないこと。★
 *   ホームがいちばん売れるので推測したくなりますが、
 *   アウェイ・サードは別商品で価格も違います。
 */
function judgeKitType(product: Product, titlePadded: string): MatchSignal {
  if (!product.kitType || product.kitType === 'unknown') {
    return { dimension: 'kitType', verdict: 'unknown', note: '自社側のユニフォーム種類が未確認です' }
  }

  const detected = detectFromTerms(titlePadded, KIT_TYPE_TERMS)
  if (!detected) {
    return { dimension: 'kitType', verdict: 'unknown', note: '商品名から種類を判断できませんでした' }
  }
  if (detected === product.kitType) {
    return { dimension: 'kitType', verdict: 'match', note: `種類が一致しました（${detected}）` }
  }
  return {
    dimension: 'kitType',
    verdict: 'mismatch',
    note: `種類が異なります（自社 ${product.kitType} ／ 相手 ${detected}）`,
  }
}

function judgeAuthenticity(product: Product, titlePadded: string): MatchSignal {
  if (product.authenticity === null) {
    return {
      dimension: 'authenticity',
      verdict: 'not-applicable',
      note: 'レプリカ／オーセンティックの区別が無い商品です',
    }
  }
  if (product.authenticity === 'unknown') {
    return {
      dimension: 'authenticity',
      verdict: 'unknown',
      note: '自社側がレプリカかオーセンティックか未確認です',
    }
  }

  const detected = detectFromTerms(titlePadded, AUTHENTICITY_TERMS)
  if (!detected) {
    // ★書かれていないからレプリカ、とはしない。★
    return {
      dimension: 'authenticity',
      verdict: 'unknown',
      note: '商品名にレプリカ／オーセンティックの記載がありません',
    }
  }
  if (detected === product.authenticity) {
    return { dimension: 'authenticity', verdict: 'match', note: `仕様が一致しました（${detected}）` }
  }
  return {
    dimension: 'authenticity',
    verdict: 'mismatch',
    note: `レプリカ／オーセンティックが異なります（自社 ${product.authenticity} ／ 相手 ${detected}）`,
  }
}

function judgeGender(product: Product, titlePadded: string): MatchSignal {
  const detected = detectFromTerms(titlePadded, GENDER_TERMS)

  if (product.gender === 'unknown') {
    // 自社側が不明でも、相手が子供用だとはっきり分かるなら食い違いとして扱う
    if (detected === 'kids') {
      return {
        dimension: 'gender',
        verdict: 'mismatch',
        note: '相手が子供用です（自社側は対象未確認）',
      }
    }
    return { dimension: 'gender', verdict: 'unknown', note: '自社側の対象が未確認です' }
  }

  if (!detected) {
    return { dimension: 'gender', verdict: 'unknown', note: '商品名から対象を判断できませんでした' }
  }
  if (detected === product.gender) {
    return { dimension: 'gender', verdict: 'match', note: `対象が一致しました（${detected}）` }
  }

  // ユニセックスはメンズ表記と併記されることがあるので、食い違い扱いにしない
  const bothAdult =
    (product.gender === 'unisex' && (detected === 'men' || detected === 'women')) ||
    (detected === 'unisex' && (product.gender === 'men' || product.gender === 'women'))
  if (bothAdult) {
    return { dimension: 'gender', verdict: 'unknown', note: '対象の表記がそろいません（大人用どうし）' }
  }

  return {
    dimension: 'gender',
    verdict: 'mismatch',
    note: `対象が異なります（自社 ${product.gender} ／ 相手 ${detected}）`,
  }
}

/**
 * 袖丈を判定する。
 *
 * ★実データで見つかった取り違えです。★
 *   リヴァプール 25/26 ホームは 半袖(JV6423) と 長袖(JV6456) で
 *   別品番・別価格です。袖丈を見ないと別商品どうしを比べてしまいます。
 *
 * ★書かれていない袖丈を「一致」にしないこと。★
 *   分からないときは unknown にして、点数も上げません。
 */
function judgeSleeve(product: Product, titlePadded: string, titleLight: string): MatchSignal {
  const detected = detectSleeve(titlePadded, titleLight)

  if (product.sleeve === null) {
    return {
      dimension: 'sleeve',
      verdict: 'unknown',
      note: detected
        ? `自社側の袖丈が未確認です（相手は ${detected}）`
        : '自社側の袖丈が未確認です',
    }
  }

  if (!detected) {
    return { dimension: 'sleeve', verdict: 'unknown', note: '商品名から袖丈を判断できませんでした' }
  }
  if (detected === product.sleeve) {
    return { dimension: 'sleeve', verdict: 'match', note: `袖丈が一致しました（${detected}）` }
  }
  return {
    dimension: 'sleeve',
    verdict: 'mismatch',
    note: `袖丈が異なります（自社 ${product.sleeve} ／ 相手 ${detected}）`,
  }
}

/**
 * サカモノ側の商品が、無地なのか選手名入りなのか。
 *
 * personalization が未設定の商品は、選手名（player）の有無から決めます。
 * 既存のfixtureをすべて書き換えなくても動くようにするためです。
 */
export function targetPersonalization(product: Product): Personalization {
  if (product.personalization) return product.personalization
  return product.player ? 'player-marked' : 'plain'
}

/**
 * マーキング（無地 / 選手名入り / 名入れ）を判定する。
 *
 * ★無地と選手名入りは別商品です。★
 *   実データでは、同じ品番のまま「No.11 モハメド・サラー」と付くだけで
 *   7,920円 → 14,410円 になりました。同じ商品として比べてはいけません。
 *
 * ★ただし「マーキング対応」「別売」は、入っているとは限りません。★
 *   そういう表記は unknown（判断保留）にして、人の確認へ回します。
 *   断定して不採用にすると、無地の商品まで取り逃がします。
 */
function judgePersonalization(
  product: Product,
  clubSlug: string,
  titlePadded: string,
  titleLight: string,
): MatchSignal {
  const target = targetPersonalization(product)
  // ★そのクラブの選手名も手掛かりにする。★
  //   楽天では背番号なしで姓だけ書かれることがあるため。
  const detected = classifyPersonalization(titlePadded, titleLight, squadTerms(clubSlug))

  if (target === 'unknown' || detected === 'unknown') {
    return {
      dimension: 'marking',
      verdict: 'unknown',
      note:
        detected === 'unknown'
          ? 'マーキングに関する記載はありますが、入っているかどうかまでは読み取れません'
          : '自社側のマーキングの有無が未確認です',
    }
  }

  if (target === detected) {
    // 同じ「選手名入り」でも、選手が違えば別商品
    if (target === 'player-marked' && product.player) {
      if (containsAnyTerm(titlePadded, playerAliases(product.player))) {
        return {
          dimension: 'marking',
          verdict: 'match',
          note: `同じ選手のマーキングです（${product.player}）`,
        }
      }
      return {
        dimension: 'marking',
        verdict: 'unknown',
        note: `どちらも選手名入りですが、同じ選手（${product.player}）かどうか確認できません`,
      }
    }
    return {
      dimension: 'marking',
      verdict: 'match',
      note: target === 'plain' ? 'どちらも無地です' : 'マーキングの状態が一致しました',
    }
  }

  const LABEL: Record<Personalization, string> = {
    plain: '無地',
    'player-marked': '選手名・背番号入り',
    personalized: '名入れ（購入者が指定）',
    unknown: '不明',
  }
  return {
    dimension: 'marking',
    verdict: 'mismatch',
    note: `マーキングの状態が異なります（自社 ${LABEL[target]} ／ 相手 ${LABEL[detected]}）。価格が数千円変わるため、同じ商品として比べられません`,
  }
}

/**
 * 単品か、セット商品か。
 *
 * ★第4.6段階の実データ検証で見つけた誤一致への対策です。★
 *   「レプリカシャツ＆ショーツ … 上下セット」という出品が、
 *   クラブ・シーズン・種類・品番すべて一致するため
 *   シャツ単体の候補として採用されていました。
 *   中身が違うものを同じ価格で比べると、差額が嘘になります。
 *
 * ★サカモノ側がセット商品を扱うようになったら、ここを見直すこと。★
 *   いまの商品はすべて単品なので、セットであれば別商品です。
 */
function judgeBundle(titlePadded: string): MatchSignal {
  if (looksLikeBundle(titlePadded)) {
    return {
      dimension: 'bundle',
      verdict: 'mismatch',
      note: 'セット商品です（単品の価格とは比べられません）',
    }
  }
  return { dimension: 'bundle', verdict: 'match', note: '単品の出品とみられます' }
}
function judgeCondition(candidate: MatchCandidate, titlePadded: string): MatchSignal {
  const fromTitle = containsAnyTerm(titlePadded, USED_TERMS)

  if (candidate.condition === 'used' || fromTitle) {
    return {
      dimension: 'condition',
      verdict: 'mismatch',
      note: '中古・訳あり品です（新品価格の比較には使いません）',
    }
  }
  if (candidate.condition === 'new') {
    return { dimension: 'condition', verdict: 'match', note: '新品です' }
  }
  // ★取れなかったものを新品と決めつけない。★
  return { dimension: 'condition', verdict: 'unknown', note: '新品かどうか確認できませんでした' }
}

function judgePrice(candidate: MatchCandidate, context: MatchContext): MatchSignal {
  const price = candidate.priceJpy
  const reference = context.referencePriceJpy

  if (!price || !reference || reference <= 0) {
    return { dimension: 'price', verdict: 'unknown', note: '価格の妥当性を判断する目安がありません' }
  }

  if (price < reference * SUSPICIOUS_PRICE_RATIO) {
    return {
      dimension: 'price',
      verdict: 'mismatch',
      note: `相場（目安 ${Math.round(reference).toLocaleString('ja-JP')}円）に対して安すぎます（${Math.round(price).toLocaleString('ja-JP')}円）`,
    }
  }

  return { dimension: 'price', verdict: 'match', note: '価格は妥当な範囲です' }
}

/* ------------------------------------------------------------
 * 全体の判定
 * ---------------------------------------------------------- */

/** 属性一致による加点。合計しても自動採用の基準（0.85）へ届かないようにしてある。 */
const ATTRIBUTE_WEIGHTS: Partial<Record<MatchDimension, number>> = {
  club: 0.2,
  manufacturer: 0.1,
  season: 0.12,
  kitType: 0.08,
  authenticity: 0.08,
  gender: 0.05,
  sleeve: 0.04,
}

const ATTRIBUTE_BASE_CONFIDENCE = 0.4

/**
 * メーカー品番の一致を「強い根拠」として信じてよいか。
 *
 * ★品番が一致しただけでランクBにしない。★
 *   品番は説明文の中にたまたま混ざることがあります
 *   （「※JV6423とは別商品です」「関連商品: JV6423」など）。
 *   また、同じ品番の文字列が別シーズンの商品説明へ残っていることもあります。
 *
 *   そこで、最低限
 *     ・クラブが一致していること
 *     ・シーズンか種類のどちらかが一致していること
 *   を条件にします。どちらも読み取れない商品名は、
 *   属性一致どまり（自動採用しない）にします。
 */
function isSkuTrustworthy(verdictOf: (dimension: MatchDimension) => DimensionVerdict): boolean {
  if (verdictOf('club') !== 'match') return false
  return verdictOf('season') === 'match' || verdictOf('kitType') === 'match'
}

export function evaluateMatch(context: MatchContext, candidate: MatchCandidate): MatchEvaluation {
  const { product, clubSlug } = context
  const titlePadded = padded(candidate.title)
  // 「No.11」「L/S」のように記号そのものに意味がある判定には、記号を残した形を使う
  const titleLight = normalizeLight(candidate.title)

  const janSignal = judgeJan(product, candidate, context.variantJans ?? [])
  const skuSignal = judgeSku(product, titlePadded)

  const signals: MatchSignal[] = [
    janSignal,
    skuSignal,
    judgeClub(clubSlug, titlePadded),
    judgeManufacturer(product, candidate, titlePadded),
    judgeSeason(product, candidate.title),
    judgeKitType(product, titlePadded),
    judgeAuthenticity(product, titlePadded),
    judgeGender(product, titlePadded),
    judgeSleeve(product, titlePadded, titleLight),
    judgePersonalization(product, clubSlug, titlePadded, titleLight),
    judgeBundle(titlePadded),
    judgeCondition(candidate, titlePadded),
    judgePrice(candidate, context),
  ]

  const verdictOf = (dimension: MatchDimension): DimensionVerdict =>
    signals.find((signal) => signal.dimension === dimension)?.verdict ?? 'unknown'

  /* ══════════════════════════════════════════════════════
   * 1. ★先に不採用を判定する★
   *
   *   JANや品番が一致していても、ここで食い違いが見つかれば別商品です。
   *   陽性の根拠に矛盾を上書きさせません。
   * ════════════════════════════════════════════════════ */
  const violated = HARD_REJECT_RULES.filter((rule) => verdictOf(rule.dimension) === 'mismatch')
  const hardReject = violated.length > 0
  const hardRejectReasons = violated.map((rule) => rule.dimension)
  const hardRejectCodes = violated.map((rule) => rule.code)

  /* ---- 手掛かりの強さ（どうやって見つけた候補か）---- */
  let matchLevel: MatchLevel = 'attributes'
  let matchMethod: MatchMethod = 'attributes'
  if (janSignal.state === 'exact') {
    matchLevel = isEanUsableAsJan(product.ean) && !normalizeCode(product.jan) ? 'ean-as-jan' : 'jan'
    matchMethod = matchLevel === 'jan' ? 'jan' : 'ean'
  } else if (skuSignal.exact && isSkuTrustworthy(verdictOf)) {
    matchLevel = 'sku'
    matchMethod = 'sku'
  }

  /* ══════════════════════════════════════════════════════
   * 2. 点数を付ける（不採用なら 0 のまま）
   * ════════════════════════════════════════════════════ */
  let confidence = 0

  if (!hardReject) {
    if (matchLevel === 'jan' || matchLevel === 'ean-as-jan') {
      confidence = 0.99
    } else if (matchLevel === 'sku') {
      confidence = 0.9
    } else {
      confidence = ATTRIBUTE_BASE_CONFIDENCE
      for (const [dimension, weight] of Object.entries(ATTRIBUTE_WEIGHTS)) {
        if (verdictOf(dimension as MatchDimension) === 'match') confidence += weight ?? 0
      }
      // ★属性一致だけでは自動採用させない（Level 4 は候補発見用）。★
      confidence = Math.min(confidence, ATTRIBUTE_ONLY_MAX_CONFIDENCE)
    }
  }

  /* ══════════════════════════════════════════════════════
   * 3. 要確認の判断（不採用ではないが、自動では採らないもの）
   * ════════════════════════════════════════════════════ */
  const reviewReasons: string[] = []

  if (!hardReject) {
    // 品番は一致しているが、クラブ・シーズン・種類を読み取れない商品名
    if (skuSignal.exact && matchLevel === 'attributes') {
      reviewReasons.push(
        'メーカー品番は一致していますが、クラブ・シーズン・種類を商品名から確認できません',
      )
      confidence = Math.min(confidence, REVIEW_CAP_CONFIDENCE)
    }

    // ★ワッペン付き・特別仕様は別商品の可能性がある。★
    //   第5.4段階の実データで見つけた書き方です。
    //     「プレミア優勝+No Room For Racismパッチ付」
    //     「【WSL仕様】」
    //   ワッペンが付くと数千円変わります。ただしサカモノ側の商品が
    //   「ワッペン無し」と確定しているわけではないので、
    //   不採用にはせず自動採用だけ止めます。
    if (containsAnyTerm(titlePadded, SPEC_VARIANT_TERMS)) {
      reviewReasons.push('ワッペン付きや特別仕様の記載があります（別商品の可能性）')
      confidence = Math.min(confidence, REVIEW_CAP_CONFIDENCE)
    }
    // マーキングの状態を読み取れないもの（「マーキング対応」等）
    if (verdictOf('marking') === 'unknown') {
      reviewReasons.push('マーキング（選手名・背番号）の有無を確認できていません')
      confidence = Math.min(confidence, REVIEW_CAP_CONFIDENCE)
    }

    // 新品かどうか分からないものを新品最安値に混ぜない
    //
    // ★ここでは confidence を下げません（第5段階で直したところ）。★
    //   confidence とランクが表すのは「商品同定の確からしさ」だけです。
    //   新品か中古かは、同じ商品かどうかとは別の話です。
    //   中古のリヴァプール25/26ホームは、やはりリヴァプール25/26ホームです。
    //
    //   両者を混ぜて点数を下げると、
    //   「商品の特定はできているが、状態が分からない」ものと
    //   「そもそも同じ商品か怪しい」ものが同じランクになり、区別できません。
    //
    //   採用させないための歯止めは reviewReasons の側にあります
    //   （requiresReview → verification が 'none' になる）。
    if (verdictOf('condition') === 'unknown') {
      reviewReasons.push(CONDITION_UNKNOWN_REVIEW_REASON)
    }

    // ★安いという理由で信頼度を上げない。安すぎるものは要確認にする。★
    if (verdictOf('price') === 'mismatch') {
      reviewReasons.push('相場に対して価格が安すぎます')
      confidence = Math.min(confidence, REVIEW_CAP_CONFIDENCE)
    }
  }

  /* ══════════════════════════════════════════════════════
   * 4. 根拠を記録する
   *
   *   あとから「なぜ採用したのか」「なぜ落としたのか」を
   *   人が追えるようにしておきます。
   * ════════════════════════════════════════════════════ */
  const positiveEvidence = signals
    .filter((signal) => signal.verdict === 'match')
    .map((signal) => `${MATCH_DIMENSION_LABEL_JA[signal.dimension]}: ${signal.note}`)
  const negativeEvidence = signals
    .filter((signal) => signal.verdict === 'mismatch')
    .map((signal) => `${MATCH_DIMENSION_LABEL_JA[signal.dimension]}: ${signal.note}`)
  const unknownAttributes = signals
    .filter((signal) => signal.verdict === 'unknown')
    .map((signal) => signal.dimension)

  const grade = toConfidenceGrade(confidence)
  const requiresReview = reviewReasons.length > 0

  /* ---- 自動検証を通したか ---- */
  const verification: MatchEvaluation['verification'] =
    !hardReject && !requiresReview && (grade === 'A' || grade === 'B') && verdictOf('condition') === 'match'
      ? 'automated'
      : 'none'

  return {
    confidence,
    grade,
    matchMethod,
    matchLevel,
    hardReject,
    hardRejectReasons,
    hardRejectCodes,
    requiresReview,
    reviewReasons,
    signals,
    janEvidence: janSignal.state,
    positiveEvidence,
    negativeEvidence,
    unknownAttributes,
    verification,
  }
}

/** 自動で価格比較に使ってよいか。 */
export function isAutoAdoptable(evaluation: MatchEvaluation): boolean {
  return evaluation.verification === 'automated'
}

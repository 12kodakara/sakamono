/**
 * 商品名などから、サカモノの分類項目を読み取る。
 *
 * ★★ このファイルのいちばん大事な決まり ★★
 *
 *   はっきり書かれていないものは、推測しない。
 *
 * 商品名に「Home」と書いていないユニフォームを「たぶんホームだろう」で
 * home にしてしまうと、価格比較が静かに壊れる。
 * 分からないものは unknown / null のままにする。
 * 第2段階で作った仕組みにより、unknown は自動的に比較対象から外れる（安全側に倒れる）。
 *
 * 判定はすべて「原文にその語が含まれているか」だけで行い、
 * 統計的な当てずっぽうや、語順・文脈からの推定はしない。
 */

import type {
  Authenticity,
  GenderTarget,
  KitType,
  ProductCategory,
  SleeveLength,
} from '@/domain/types'

/** 比較しやすいように小文字化し、記号を空白へ寄せる。 */
function normalizeText(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9/]+/g, ' ').replace(/\s+/g, ' ').trim()} `
}

/** 語として含まれているか（部分一致による誤判定を避ける）。 */
function hasWord(haystack: string, word: string): boolean {
  return haystack.includes(` ${word} `)
}

function hasAnyWord(haystack: string, words: string[]): boolean {
  return words.some((word) => hasWord(haystack, word))
}

/* ------------------------------------------------------------
 * カテゴリ
 * ---------------------------------------------------------- */

/**
 * カテゴリを判定する。
 *
 * 第3段階では kits / training / jackets / other の4つから始める
 * （指示書どおり。細かい分類は取得元の情報が増えてから）。
 *
 * どれにも当てはまらないものは 'other'。
 * 「Tシャツかもしれない」程度の手掛かりで t-shirts にはしない。
 */
export function classifyCategory(title: string): ProductCategory {
  const text = normalizeText(title)

  // ユニフォーム: 「shirt」「jersey」「kit」＋ユニフォームらしい語
  const kitWords = ['shirt', 'jersey', 'kit']
  const kitContext = ['home', 'away', 'third', 'goalkeeper', 'gk', 'replica', 'authentic']
  if (hasAnyWord(text, kitWords) && hasAnyWord(text, kitContext)) {
    return 'kits'
  }

  if (hasAnyWord(text, ['training', 'traning', 'drill', 'warm'])) {
    return 'training'
  }

  if (hasAnyWord(text, ['jacket', 'coat', 'anorak', 'windbreaker', 'gilet'])) {
    return 'jackets'
  }

  // ★ここで「shirt が入っているから t-shirts だろう」とはしない★
  return 'other'
}

/* ------------------------------------------------------------
 * ユニフォームの種類
 * ---------------------------------------------------------- */

/**
 * ホーム / アウェイ / サード等を判定する。
 *
 * カテゴリが kits でなければ null（そもそも該当しない）。
 * kits なのに判別できなければ 'unknown'。
 */
export function classifyKitType(title: string, category: ProductCategory): KitType {
  if (category !== 'kits') return null

  const text = normalizeText(title)

  if (hasWord(text, 'home')) return 'home'
  if (hasWord(text, 'away')) return 'away'
  if (hasAnyWord(text, ['third', '3rd'])) return 'third'
  if (hasAnyWord(text, ['goalkeeper', 'gk'])) return 'goalkeeper'
  if (hasAnyWord(text, ['special', 'anniversary', 'commemorative'])) return 'special'

  return 'unknown'
}

/* ------------------------------------------------------------
 * レプリカ / オーセンティック
 * ---------------------------------------------------------- */

/**
 * レプリカ / オーセンティックを判定する。
 *
 * ★★ ここが最も慎重にすべき箇所 ★★
 *   レプリカとオーセンティックは価格が1万円以上違うことがある。
 *   取り違えたまま比較すると、大きく誤った差額を表示してしまう。
 *
 *   はっきり書かれていない限り 'unknown' にする。
 *   ★書かれていないからレプリカだろう、という判断は絶対にしない。★
 */
export function classifyAuthenticity(title: string, category: ProductCategory): Authenticity {
  // ユニフォーム以外はそもそも該当しない
  if (category !== 'kits') return null

  const text = normalizeText(title)

  const isAuthentic = hasAnyWord(text, ['authentic', 'matchday', 'vaporknit', 'adv', 'heat'])
  const isReplica = hasAnyWord(text, ['replica', 'stadium', 'fan'])

  // 両方の語が入っている商品名は判断できない
  if (isAuthentic && isReplica) return 'unknown'
  if (isAuthentic) return 'authentic'
  if (isReplica) return 'replica'

  return 'unknown'
}

/* ------------------------------------------------------------
 * シーズン
 * ---------------------------------------------------------- */

/**
 * シーズン表記を読み取る（'2025/26' の形へそろえる）。
 *
 * 対応する書き方:
 *   2025/26  2025-26  25/26  25-26
 *
 * 読み取れなければ null。★「今シーズンだろう」で埋めない。★
 *
 * 2桁表記（25/26）は 20xx として解釈する。
 * サッカーのシーズン表記で 1925/26 を指すことは実務上ないため。
 */
export function classifySeason(title: string): string | null {
  // 4桁始まり: 2025/26 または 2025-26
  const fourDigit = title.match(/\b(20\d{2})\s*[/-]\s*(\d{2})\b/)
  if (fourDigit) {
    const start = Number(fourDigit[1])
    const end = Number(fourDigit[2])
    // 連続するシーズンであることを確かめる（2025/27 のような表記は採用しない）
    if ((start + 1) % 100 === end) return `${start}/${fourDigit[2]}`
    return null
  }

  // 2桁始まり: 25/26 または 25-26
  const twoDigit = title.match(/\b(\d{2})\s*[/-]\s*(\d{2})\b/)
  if (twoDigit) {
    const start = Number(twoDigit[1])
    const end = Number(twoDigit[2])
    if ((start + 1) % 100 === end) {
      return `20${twoDigit[1]}/${twoDigit[2]}`
    }
    return null
  }

  return null
}

/* ------------------------------------------------------------
 * 対象・袖丈・選手名
 * ---------------------------------------------------------- */

/**
 * 対象（メンズ / ウィメンズ / キッズ）を判定する。
 *
 * ★書かれていない場合に 'unisex' や 'men' を当てずっぽうで入れない。★
 *   メンズとウィメンズはサイズも価格も違う別商品なので、
 *   取り違えると比較が壊れる。分からなければ 'unknown'。
 */
export function classifyGender(title: string): GenderTarget {
  const text = normalizeText(title)

  if (hasAnyWord(text, ['womens', 'women', 'ladies', 'female'])) return 'women'
  if (hasAnyWord(text, ['junior', 'juniors', 'kids', 'infant', 'infants', 'youth', 'baby'])) {
    return 'kids'
  }
  if (hasAnyWord(text, ['mens', 'men'])) return 'men'
  if (hasAnyWord(text, ['unisex'])) return 'unisex'

  return 'unknown'
}

/** 袖丈。書かれていなければ null（不明）。 */
export function classifySleeve(title: string): SleeveLength {
  const text = normalizeText(title)

  if (hasAnyWord(text, ['long']) && hasAnyWord(text, ['sleeve', 'sleeves'])) return 'long'
  if (hasAnyWord(text, ['short']) && hasAnyWord(text, ['sleeve', 'sleeves'])) return 'short'
  if (hasWord(text, 'ls')) return 'long'

  return null
}

/**
 * 選手名。
 *
 * ★商品名からの推測はしない。★
 *   商品名に含まれる大文字の語が選手名とは限らず
 *   （NIKE / LFC / YNWA など）、誤ると別商品として扱われてしまう。
 *   取得元に専用の項目ができるまでは常に null を返す。
 */
export function classifyPlayer(): string | null {
  return null
}

/* ------------------------------------------------------------
 * まとめ
 * ---------------------------------------------------------- */

export interface ClassifiedAttributes {
  category: ProductCategory
  kitType: KitType
  authenticity: Authenticity
  season: string | null
  gender: GenderTarget
  sleeve: SleeveLength
  player: string | null
}

/** 商品名から分かる範囲の属性をまとめて読み取る。 */
export function classifyFromTitle(title: string): ClassifiedAttributes {
  const category = classifyCategory(title)

  return {
    category,
    kitType: classifyKitType(title, category),
    authenticity: classifyAuthenticity(title, category),
    season: classifySeason(title),
    gender: classifyGender(title),
    sleeve: classifySleeve(title),
    player: classifyPlayer(),
  }
}

/* ------------------------------------------------------------
 * 商品URLの整形
 * ---------------------------------------------------------- */

/**
 * トラッキング用のパラメータを取り除き、商品そのものを指すURLにする。
 *
 * 取り除く対象は、Liverpool 公式ストアの robots.txt が
 * 「正規のURLではない」として除外しているものに合わせてある
 * （docs/data-sources/liverpool.md 第3章）。
 *
 * 判断できないパラメータは残す。消しすぎて商品ページが開けなくなる方が困るため。
 */
const TRACKING_PARAM_PREFIXES = ['utm_', 'f_']
const TRACKING_PARAM_NAMES = [
  'gclid',
  'queryid',
  'sort',
  'min_price',
  'max_price',
  'fbclid',
  'msclkid',
  'wgu',
  'wgexpiry',
  'affiliate',
  'ref',
]

export function normalizeProductUrl(rawUrl: string): string | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return null
  }

  if (url.protocol !== 'https:') return null

  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase()
    const isTracking =
      TRACKING_PARAM_NAMES.includes(lower) ||
      TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
    if (isTracking) url.searchParams.delete(key)
  }

  // ページ内リンク（#...）は商品の識別に関係しない
  url.hash = ''

  // 末尾のスラッシュはあってもなくても同じページなので、片方へそろえる
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '')
  }

  return url.toString()
}

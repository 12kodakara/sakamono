/**
 * 照合で使う言い換え辞書。
 *
 * 日本のECサイトでは、同じものが何通りにも書かれます。
 *
 *   Liverpool ／ Liverpool FC ／ リバプール ／ リヴァプール
 *   adidas ／ アディダス
 *   Authentic ／ オーセンティック ／ プレイヤーモデル
 *
 * ★辞書は1か所にまとめる。★
 *   照合のたびに各所へ書き散らすと、片方だけ直して食い違いが起きます。
 *
 * ★増やしすぎないこと。★
 *   「ホーム」と「1st」のように、本当に同じものだけを結び付けます。
 *   迷ったら入れない方が安全です。誤って結び付けた辞書は、
 *   別商品どうしを「同じ商品」と判定させ、価格比較を壊します。
 */

import type { Authenticity, GenderTarget, KitType } from '@/domain/types'
import { containsTerm } from './textNormalize'

/* ------------------------------------------------------------
 * クラブ
 * ---------------------------------------------------------- */

/**
 * クラブ名の言い換え。キーは Club['slug']。
 *
 * ★他クラブと紛れる短い語（"LFC" など）は入れていません。★
 *   商品名の一部にたまたま含まれて誤一致するためです。
 */
export const CLUB_ALIASES: Record<string, readonly string[]> = {
  liverpool: ['liverpool', 'liverpool fc', 'リバプール', 'リヴァプール'],
  tottenham: [
    'tottenham',
    'tottenham hotspur',
    'トッテナム',
    'トットナム',
    'スパーズ',
    'spurs',
  ],
  'fc-barcelona': ['barcelona', 'fc barcelona', 'バルセロナ', 'バルサ'],
  'real-madrid': ['real madrid', 'レアルマドリード', 'レアルマドリッド', 'レアル マドリード'],
}

/**
 * 「このクラブではない」と判断するための、他クラブの名前。
 *
 * 商品名に別クラブの名前が入っていたら、こちらのクラブ名が
 * 含まれていても一致させません（セット商品・比較記事などの誤検出対策）。
 */
export const OTHER_CLUB_TERMS: readonly string[] = [
  'manchester united',
  'マンチェスターユナイテッド',
  'マンu',
  'manchester city',
  'マンチェスターシティ',
  'マンc',
  'arsenal',
  'アーセナル',
  'chelsea',
  'チェルシー',
  'everton',
  'エバートン',
  'エヴァートン',
  'newcastle',
  'ニューカッスル',
  'atletico madrid',
  'アトレティコ',
  'juventus',
  'ユベントス',
  'ユヴェントス',
  'ac milan',
  'acミラン',
  'inter milan',
  'インテル',
  'bayern',
  'バイエルン',
  'dortmund',
  'ドルトムント',
  'psg',
  'paris saint germain',
  'パリサンジェルマン',
  'ajax',
  'アヤックス',
]

/** そのクラブの言い換え一覧を返す。未登録なら空配列。 */
export function clubAliases(clubSlug: string): readonly string[] {
  return CLUB_ALIASES[clubSlug] ?? []
}

/* ------------------------------------------------------------
 * メーカー
 * ---------------------------------------------------------- */

export const MANUFACTURER_ALIASES: Record<string, readonly string[]> = {
  nike: ['nike', 'ナイキ'],
  adidas: ['adidas', 'アディダス'],
  puma: ['puma', 'プーマ'],
  'new balance': ['new balance', 'ニューバランス', 'ニューバランス'],
  umbro: ['umbro', 'アンブロ'],
  castore: ['castore', 'カストレ'],
  macron: ['macron', 'マクロン'],
  kappa: ['kappa', 'カッパ'],
  hummel: ['hummel', 'ヒュンメル'],
  mizuno: ['mizuno', 'ミズノ'],
}

/** メーカー名の言い換え一覧。未登録なら、その名前そのものを返す。 */
export function manufacturerAliases(manufacturer: string): readonly string[] {
  const key = manufacturer.trim().toLowerCase()
  return MANUFACTURER_ALIASES[key] ?? [key]
}

/** すべてのメーカーの言い換えを平らにした一覧（別ブランド検出用）。 */
export function allManufacturerKeys(): string[] {
  return Object.keys(MANUFACTURER_ALIASES)
}

/* ------------------------------------------------------------
 * レプリカ / オーセンティック
 * ---------------------------------------------------------- */

/**
 * ★ここは最も慎重に扱う辞書です。★
 *   レプリカとオーセンティックは1万円以上値段が違うことがあり、
 *   取り違えると価格比較が大きく狂います。
 *
 *   どちらとも書かれていない商品は 'unknown' にします。
 *   ★書かれていないからレプリカ、という推測はしません。★
 */
export const AUTHENTICITY_TERMS: Record<NonNullable<Authenticity>, readonly string[]> = {
  replica: ['replica', 'レプリカ', 'stadium', 'スタジアム', 'ファン', 'fan version'],
  authentic: [
    'authentic',
    'オーセンティック',
    'プレイヤー',
    'プレーヤー',
    'player issue',
    'match version',
    'vaporknit',
    'ヴェイパー',
    'ベイパー',
    'adv',
    'heat rdy',
    'heat.rdy',
    'ヒートレディ',
  ],
  // 判別できない状態を表すだけなので、対応する語は無い
  unknown: [],
}

/* ------------------------------------------------------------
 * ユニフォームの種類
 * ---------------------------------------------------------- */

export const KIT_TYPE_TERMS: Record<NonNullable<KitType>, readonly string[]> = {
  home: ['home', 'ホーム', '1st', 'ファースト'],
  away: ['away', 'アウェイ', 'アウェー', '2nd', 'セカンド'],
  third: ['third', '3rd', 'サード', 'サードユニフォーム'],
  goalkeeper: ['goalkeeper', 'keeper', 'gk', 'ゴールキーパー', 'キーパー'],
  special: ['special', 'スペシャル', 'anniversary', 'アニバーサリー', '記念'],
  unknown: [],
}

/* ------------------------------------------------------------
 * 対象（メンズ / ウィメンズ / キッズ）
 * ---------------------------------------------------------- */

/**
 * ★キッズとアダルトの取り違えは特に危険です。★
 *   子供用は大人用よりかなり安いため、取り違えると
 *   「国内が激安」という誤った比較結果になります。
 */
export const GENDER_TERMS: Record<GenderTarget, readonly string[]> = {
  men: ['mens', "men's", 'men', 'メンズ', '男性用'],
  women: ['womens', "women's", 'women', 'ladies', 'ウィメンズ', 'ウーメンズ', 'レディース', '女性用'],
  kids: [
    'kids',
    'kid',
    'junior',
    'juniors',
    'youth',
    'infant',
    'boys',
    'girls',
    'キッズ',
    'ジュニア',
    'ユース',
    '子供',
    '子ども',
    'こども',
    'ベビー',
    '幼児',
  ],
  unisex: ['unisex', 'ユニセックス', '男女兼用'],
  unknown: [],
}

/* ------------------------------------------------------------
 * 袖丈
 * ---------------------------------------------------------- */

/**
 * 袖丈（半袖 / 長袖 / ノースリーブ）。
 *
 * ★実データで見つかった取り違えの原因です。★
 *   リヴァプール 25/26 ホームは 半袖(JV6423) / 長袖(JV6456) と
 *   品番から分かれており、価格も数千円違います。
 *   袖丈を見ないと、別商品どうしを同じ商品として比べてしまいます。
 *
 * ここには「語として安全に探せる書き方」だけを入れます。
 * 「L/S」「S/S」のような略記は語の境界の判定が別に必要なので、
 * 下の SLEEVE_ABBREVIATION_PATTERNS で扱います。
 */
export const SLEEVE_TERMS: Record<'short' | 'long' | 'sleeveless', readonly string[]> = {
  short: ['半袖', '半そで', 'short sleeve', 'shortsleeve', 'ショートスリーブ'],
  long: ['長袖', '長そで', 'long sleeve', 'longsleeve', 'ロングスリーブ'],
  sleeveless: ['ノースリーブ', 'sleeveless', '袖なし', '袖無し', 'タンクトップ', 'tank top'],
}

/**
 * 「L/S」「S/S」のような略記。
 *
 * ★語の境界に注意が必要です。★
 *   単純な部分一致にすると、サイズ表記「XL/S」の中の "L/S" を
 *   長袖と読み違えます。前後に英数字が来ないことを条件にしています。
 *   「LS」「SS」のような区切りの無い略記は、品番（JYF51など）や
 *   他の語に埋もれて誤検出しやすいため、あえて扱いません。
 */
const SLEEVE_ABBREVIATION_PATTERNS: Record<'short' | 'long', readonly RegExp[]> = {
  short: [/(?<![a-z0-9])s\s?[/／]\s?s(?![a-z0-9])/],
  long: [/(?<![a-z0-9])l\s?[/／]\s?s(?![a-z0-9])/],
}

/**
 * 商品名から袖丈を読み取る。
 *
 * @param titlePadded  normalizeText() で整えて前後に空白を付けた文字列
 * @param titleLight   normalizeLight() で整えた文字列（記号が残っているもの）
 * @returns 判断できたときだけ値を返す。書かれていない／複数あるときは null。
 *
 * ★複数の袖丈が書かれていたら判断しません。★
 *   「半袖・長袖 各種」のような書き方を、
 *   どちらか一方と決めつけないためです。
 */
export function detectSleeve(
  titlePadded: string,
  titleLight: string,
): 'short' | 'long' | 'sleeveless' | null {
  const hits = new Set<'short' | 'long' | 'sleeveless'>()

  for (const key of ['short', 'long', 'sleeveless'] as const) {
    if (SLEEVE_TERMS[key].some((term) => containsTerm(titlePadded, term))) hits.add(key)
  }
  for (const key of ['short', 'long'] as const) {
    if (SLEEVE_ABBREVIATION_PATTERNS[key].some((pattern) => pattern.test(titleLight))) hits.add(key)
  }

  return hits.size === 1 ? [...hits][0] : null
}

/* ------------------------------------------------------------
 * マーキング（無地 / 選手名入り / 名入れ）
 * ---------------------------------------------------------- */

/**
 * ★無地と選手マーキング入りは別商品です。★
 *
 *   実データでは、同じ品番（JV6423）のまま
 *   「No.11 モハメド・サラー」と付くだけで 7,920円 → 14,410円 になりました。
 *   4,000円以上の差を「同じ商品の値段の違い」として比べてはいけません。
 */

/**
 * 購入者が名前・番号を指定するもの（名入れ）。
 * 完成品ではないので、無地とも選手名入りとも違う扱いにします。
 */
export const PERSONALIZED_TERMS: readonly string[] = [
  '名入れ',
  'お名前入れ',
  'ネーム入れ',
  'オリジナルマーキング',
  'オーダーマーキング',
  'personalised',
  'personalized',
  'custom name',
]

/**
 * 「マーキングは別売」「マーキング対応」のような、
 * 商品そのものにマーキングが入っているとは限らない表記。
 *
 * ★これを「選手名入り」と読み違えると、無地の商品を取り逃がします。★
 *   判断を保留（unknown）にして、人の確認へ回します。
 */
export const PERSONALIZATION_OPTIONAL_TERMS: readonly string[] = [
  'マーキング可',
  'マーキング可能',
  'マーキング対応',
  'マーキング別売',
  'マーキング別途',
  'マーキングオプション',
  'マーキング承ります',
  'マーキングなし',
  'ネーム別売',
  '番号別売',
  'マーキング料金',
]

/** すでに選手名・背番号が入っていることを示す言葉。 */
export const PLAYER_MARKED_TERMS: readonly string[] = [
  'マーキング入り',
  'マーキング済',
  'マーキング付',
  '背番号入り',
  '番号入り',
  'ネーム入り',
  '選手名入り',
  'プリント入り',
  'name set',
  'nameset',
]

/**
 * マーキングに関係するが、それだけでは状態を決められない言葉。
 * 見つかったら unknown（判断保留）にします。
 */
export const MARKING_TERMS: readonly string[] = [
  'マーキング',
  '背番号',
  'ネーム',
  'ネーム&ナンバー',
  '選手名',
  'printing',
]

/**
 * 背番号の書き方。
 *
 * ★実データで見つかった見落としです。★
 *   「●リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー」
 *   のように、マーキングを表す語を使わず背番号だけを書く商品名が多数あります。
 *   語の一覧だけでは拾えないため、書き方そのものを見ます。
 *
 * ★メーカー品番の数字を背番号と読み違えないこと。★
 *   「JV6423」「JYF22-JV6423」のような品番は英字と続いているため、
 *   \b や空白の条件でそもそも当たりません。
 *   「25.5cm」のようなサイズ表記も、点の後ろが数字なので対象外です。
 */
const MARKING_NUMBER_PATTERNS: readonly RegExp[] = [
  // 「No.11」「NO 7」など
  /\bno\.?\s?\d{1,2}\b/i,
  // 「#11」など
  /#\s?\d{1,2}\b/,
  // 「背番号11」など
  /背番号\s?\d{1,2}/,
  //「7.フロリアン・ヴィルツ」「10.マック・アリスター」など、
  // 背番号のあとに点を打って選手名を続ける書き方。
  // 点の後ろが数字の場合（25.5cm など）は対象にしない。
  /(?:^|\s)\d{1,2}\s?[.．]\s?[^\d\s]/u,
]

/** 商品名にマーキング（選手名・背番号）の気配があるか。 */
export function hasMarkingIndicator(normalizedTitle: string): boolean {
  return MARKING_NUMBER_PATTERNS.some((pattern) => pattern.test(normalizedTitle))
}

/**
 * 商品名からマーキングの状態を読み取る。
 *
 * @param titlePadded  normalizeText() で整えて前後に空白を付けた文字列
 * @param titleLight   normalizeLight() で整えた文字列（「No.11」を読むため）
 *
 * ★判定の順番が大事です。★
 *   「マーキング可」は「マーキング」を含むので、
 *   細かい表現から先に見ていきます。
 */
export function classifyPersonalization(
  titlePadded: string,
  titleLight: string,
): 'plain' | 'player-marked' | 'personalized' | 'unknown' {
  // 1. 名入れ（購入者が指定するもの）
  if (PERSONALIZED_TERMS.some((term) => containsTerm(titlePadded, term))) return 'personalized'

  // 2. 「別売」「対応」など、入っているとは限らない表記 → 判断保留
  //    ★ここを先に見ないと、無地の商品を選手名入りと読み違えます。★
  if (PERSONALIZATION_OPTIONAL_TERMS.some((term) => containsTerm(titlePadded, term))) {
    return 'unknown'
  }

  // 3. すでに入っていることがはっきり書かれている／背番号が書かれている
  if (PLAYER_MARKED_TERMS.some((term) => containsTerm(titlePadded, term))) return 'player-marked'
  if (hasMarkingIndicator(titleLight)) return 'player-marked'

  // 4. マーキングに関する語はあるが、状態までは読み取れない
  if (MARKING_TERMS.some((term) => containsTerm(titlePadded, term))) return 'unknown'

  // 5. 何も書かれていなければ無地とみなす
  return 'plain'
}

/* ------------------------------------------------------------
 * 選手名
 * ---------------------------------------------------------- */

/**
 * 選手名の言い換え。
 *
 * ★手書きの辞書を無制限に増やさないこと。★
 *   選手は毎年入れ替わり、表記も「サラー／モハメド・サラー／Salah」と揺れます。
 *   全選手を書き並べると、必ず古くなって間違いの元になります。
 *
 *   ここは「どうしても必要になった選手だけ」を入れる受け口です。
 *   登録が無い選手は Product.player の表記をそのまま使います。
 */
export const PLAYER_ALIASES: Record<string, readonly string[]> = {
  // 例）'mohamed salah': ['salah', 'サラー', 'モハメド・サラー'],
}

/** その選手を表す語の一覧。未登録なら、渡された名前そのもの。 */
export function playerAliases(player: string): readonly string[] {
  const key = player.trim().toLowerCase()
  const registered = PLAYER_ALIASES[key]
  if (registered) return registered

  // 「モハメド・サラー」のように区切られていれば、姓だけでも探せるようにする
  const parts = player.split(/[\s・･]+/u).filter((part) => part.length >= 2)
  return parts.length > 1 ? [player, ...parts] : [player]
}

/* ------------------------------------------------------------
 * 状態（新品 / 中古）
 * ---------------------------------------------------------- */

/**
 * 中古・訳あり品を示す言葉。
 *
 * 新品価格の比較が目的なので、中古が国内最安値に混ざらないようにします。
 * Yahoo! APIの condition フィールドが最優先ですが、
 * 商品名からも拾えるようにしておきます。
 */
export const USED_TERMS: readonly string[] = [
  'used',
  '中古',
  'ユーズド',
  'ジャンク',
  '訳あり',
  'わけあり',
  'アウトレット',
  'b品',
  '難あり',
  '傷あり',
  '返品',
]

/** 新品であることを示す言葉。 */
export const NEW_TERMS: readonly string[] = ['new', '新品', '未使用', '未開封']

/* ------------------------------------------------------------
 * セット商品（上下セット・福袋など）
 * ---------------------------------------------------------- */

/**
 * 「中身が1点ではない」ことを示す言葉。
 *
 * ★第4.6段階の実データ検証で見つけた誤一致です。★
 *
 *   「adidas キッズ 25/26 LFC リバプールFC ホーム レプリカシャツ＆ショーツ
 *     JYF33/JV6436 JYF36/JV6441 上下セット セットアップ」
 *
 *   この出品はシャツ単体ではなく、シャツとショーツの上下セットです。
 *   クラブ・シーズン・種類・品番がすべて一致するため、
 *   属性を見るだけでは単体のシャツと区別できません。
 *   中身が違うものを同じ価格で比べると、差額が嘘になります。
 *
 * ★曖昧な語は入れないこと。★
 *   「ソックス」のような語を単体で入れると、
 *   「ソックスは別売」と書いてあるだけの単体商品まで落としてしまいます。
 *   はっきりセットだと分かる書き方だけを並べます。
 */
export const BUNDLE_TERMS: readonly string[] = [
  '上下セット',
  '上下組',
  'セットアップ',
  'セット販売',
  '2点セット',
  '3点セット',
  '二点セット',
  '三点セット',
  '福袋',
  // 「レプリカシャツ＆ショーツ」は記号を落とすと「シャツ ショーツ」になる
  'シャツ ショーツ',
  'シャツ パンツ',
]

/** 商品名が「1点ではない」ことを示しているか。 */
export function looksLikeBundle(titlePadded: string): boolean {
  return BUNDLE_TERMS.some((term) => containsTerm(titlePadded, term))
}

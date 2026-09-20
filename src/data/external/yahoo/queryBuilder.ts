/**
 * 検索条件の組み立て（YahooQueryBuilder）。
 *
 * ★検索文字列を画面やadapterの中で作らないこと。★
 *   あちこちで組み立てると、条件を直したいときに全部を探す羽目になります。
 *   「Productから検索条件を作る」処理はここだけに置きます。
 *
 * ══════════════════════════════════════════════════════════
 * 検索は手掛かりの強い順に試します（弱い手掛かりほど誤一致しやすいため）。
 *
 *   Level 1  JANコード完全一致
 *   Level 2  EANが国内JANとして使える場合のみ、JANとして検索
 *            ★EANだから自動的にJAN扱いはしない★
 *   Level 3  メーカー品番 + クラブ名
 *   Level 4  商品属性（クラブ・シーズン・種別・メーカー）
 *            ★これは候補を見つけるためだけ。自動採用はしない★
 * ══════════════════════════════════════════════════════════
 */

import type { Product } from '@/domain/types'
import { clubAliases } from '@/lib/matching/aliases'
import { isDistributableJan, isEanUsableAsJan, normalizeCode } from '@/lib/matching/textNormalize'
import { AUTHENTICITY_LABEL, KIT_TYPE_LABEL } from '@/lib/labels'

/** 1回分の検索条件。 */
export interface YahooSearchPlan {
  level: 'jan' | 'ean-as-jan' | 'sku' | 'attributes'
  /** 人が読んで分かる説明（dry-runの出力に使う）。 */
  description: string
  /**
   * APIへ渡すパラメータ（appid は含めない）。
   * 公式仕様のパラメータ名をそのまま使う。
   */
  params: Record<string, string>
}

export interface QueryBuilderOptions {
  /** 1回の検索で受け取る件数。控えめにする。 */
  results?: number
  /**
   * 新品だけに絞るか。
   * 既定は true（サカモノが比べたいのは新品価格のため）。
   */
  newOnly?: boolean
  /** 在庫ありだけに絞るか。 */
  inStockOnly?: boolean
}

const DEFAULT_RESULTS = 20

/** そのクラブを表す、検索に使う語（いちばん一般的な1つ）。 */
function primaryClubTerm(clubSlug: string, clubName: string): string {
  const aliases = clubAliases(clubSlug)
  return aliases[0] ?? clubName
}

/** 日本語のクラブ名（あれば）。日本のECサイトはこちらで登録されていることが多い。 */
function japaneseClubTerm(clubSlug: string): string | null {
  const aliases = clubAliases(clubSlug)
  return aliases.find((alias) => /[ぁ-んァ-ヶ一-龠]/.test(alias)) ?? null
}

function baseParams(options: QueryBuilderOptions): Record<string, string> {
  const params: Record<string, string> = {
    results: String(options.results ?? DEFAULT_RESULTS),
    // 安い順に並べると、極端に安い怪しい出品が上位へ来やすい。
    // 既定の関連度順のままにして、採否は照合エンジンに判断させる。
    sort: '-score',
  }
  // ★中古を国内新品最安値に混ぜないため、原則として新品に絞る。★
  if (options.newOnly !== false) params.condition = 'new'
  if (options.inStockOnly !== false) params.in_stock = 'true'
  return params
}

/**
 * 商品から検索条件の一覧を作る（強い手掛かりの順）。
 *
 * 使えない手掛かり（JANが無い等）は、その段階を飛ばします。
 * 呼び出し側は上から順に試し、十分な候補が得られた時点で止めてください。
 */
export function buildYahooSearchPlans(
  product: Product,
  clubSlug: string,
  clubName: string,
  options: QueryBuilderOptions = {},
): YahooSearchPlan[] {
  const plans: YahooSearchPlan[] = []

  /* ---- Level 1: JAN完全一致 ---- */
  // ★開発用のダミーJAN（2で始まるインストアコード）は投げない。★
  //   実在しないコードなので必ず0件になり、APIの呼び出しが1回むだになります。
  const jan = isDistributableJan(product.jan) ? normalizeCode(product.jan) : null
  if (jan) {
    plans.push({
      level: 'jan',
      description: `JANコード ${jan} で検索`,
      params: { ...baseParams(options), jan_code: jan },
    })
  }

  /* ---- Level 2: EANを国内JANとして使えるときだけ ---- */
  // ★EANだから自動的にJAN扱いにしない。★
  //   JANは EAN のうち日本の国コード（45 / 49）で始まるもの。
  //   欧州で採番されたEANを国内JANとして検索しても、
  //   見つかったらむしろ別商品の可能性が高い。
  const ean = normalizeCode(product.ean)
  if (!jan && ean && isEanUsableAsJan(product.ean)) {
    plans.push({
      level: 'ean-as-jan',
      description: `EAN ${ean} は日本の国コードで始まるため、JANとして検索`,
      params: { ...baseParams(options), jan_code: ean },
    })
  }

  /* ---- Level 3: メーカー品番 + クラブ名 ---- */
  const sku = normalizeCode(product.manufacturerSku)
  // 短すぎる品番は、他の商品の文字列とたまたま一致しやすいので使わない
  const usableSku = sku && sku.length >= 5 && !sku.startsWith('SAMPLE') ? sku : null
  if (usableSku) {
    // ★日本のECサイトは日本語のクラブ名で登録されていることが多い。★
    //   実データ検証で、英語名（liverpool）だと候補が 21件 → 2件 へ激減した。
    const clubTerm = japaneseClubTerm(clubSlug) ?? primaryClubTerm(clubSlug, clubName)
    plans.push({
      level: 'sku',
      description: `メーカー品番 ${usableSku} とクラブ名で検索`,
      params: { ...baseParams(options), query: `${usableSku} ${clubTerm}` },
    })
  }

  /* ---- Level 4: 商品属性（候補発見用）---- */
  const attributeQuery = buildAttributeQuery(product, clubSlug, clubName)
  if (attributeQuery) {
    plans.push({
      level: 'attributes',
      description: `商品属性で検索: ${attributeQuery}`,
      params: { ...baseParams(options), query: attributeQuery },
    })
  }

  return plans
}

/**
 * 属性から検索語を組み立てる。
 *
 * ★不明な項目は入れない。★
 *   「たぶんホームだろう」で 'ホーム' を足すと、
 *   アウェイの商品が結果から漏れたり、誤った候補が上位へ来たりします。
 *
 * 日本のECサイトは日本語表記が中心なので、日本語のクラブ名を優先します。
 */
export function buildAttributeQuery(
  product: Product,
  clubSlug: string,
  clubName: string,
): string | null {
  const terms: string[] = []

  const clubTerm = japaneseClubTerm(clubSlug) ?? primaryClubTerm(clubSlug, clubName)
  terms.push(clubTerm)

  // シーズンは分かっている場合だけ。国内は「25/26」表記が多い。
  if (product.season) {
    const shortSeason = product.season.replace(/^20/, '')
    terms.push(shortSeason)
  }

  // ユニフォームの種類（不明なら入れない）
  if (product.kitType && product.kitType !== 'unknown') {
    terms.push(KIT_TYPE_LABEL[product.kitType])
  }

  // レプリカ／オーセンティック（不明なら入れない）
  if (product.authenticity === 'replica' || product.authenticity === 'authentic') {
    terms.push(AUTHENTICITY_LABEL[product.authenticity])
  }

  // メーカー（未確認なら入れない）
  if (product.manufacturer && product.manufacturer !== '確認中') {
    terms.push(product.manufacturer)
  }

  // クラブ名だけでは範囲が広すぎるので、2語以上そろわなければ検索しない
  if (terms.length < 2) return null

  return terms.join(' ')
}

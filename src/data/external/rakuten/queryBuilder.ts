/**
 * 検索条件の組み立て（RakutenQueryBuilder）。
 *
 * ★検索文字列を画面やadapterの中で作らないこと。★
 *   「Productから検索条件を作る」処理はここだけに置きます。
 *
 * ══════════════════════════════════════════════════════════
 * 検索は手掛かりの強い順に試します（弱い手掛かりほど誤一致しやすいため）。
 *
 *   Level 1  メーカー品番だけで検索
 *   Level 2  メーカー品番 + クラブ名
 *   Level 3  商品属性（クラブ・シーズン・種別・メーカー）
 *            ★これは候補を見つけるためだけ。自動採用はしない★
 *
 * ★JAN検索の段階がありません。★
 *   楽天の商品検索APIは、検索に使える商品の識別子が
 *   keyword / itemCode / shopCode / genreId だけで、
 *   JAN（isbnjan等）のパラメータがありません。
 *   Yahoo!側の Level 1（jan_code）にあたるものが存在しないため、
 *   指示書12のとおり無理に実装していません。
 * ══════════════════════════════════════════════════════════
 */

import type { Product } from '@/domain/types'
import { clubAliases } from '@/lib/matching/aliases'
import { normalizeCode } from '@/lib/matching/textNormalize'
import { AUTHENTICITY_LABEL, KIT_TYPE_LABEL } from '@/lib/labels'
import type { RakutenSearchLevel } from './types'

/** 1回分の検索条件。 */
export interface RakutenSearchPlan {
  level: RakutenSearchLevel
  /** 人が読んで分かる説明（dry-runの出力に使う）。 */
  description: string
  /**
   * APIへ渡すパラメータ（applicationId / accessKey は含めない）。
   * 公式仕様のパラメータ名をそのまま使う。
   */
  params: Record<string, string>
}

export interface RakutenQueryBuilderOptions {
  /** 1回の検索で受け取る件数。★公式の上限は30。★ */
  hits?: number
  /** 在庫ありだけに絞るか（availability=1）。 */
  inStockOnly?: boolean
}

/** 公式仕様の上限。これを超えると 400 が返ります。 */
export const MAX_HITS = 30

const DEFAULT_HITS = 20

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

function baseParams(options: RakutenQueryBuilderOptions): Record<string, string> {
  const hits = Math.min(options.hits ?? DEFAULT_HITS, MAX_HITS)
  return {
    hits: String(hits),
    // 安い順に並べると、極端に安い怪しい出品が上位へ来やすい。
    // 既定の標準順のままにして、採否は照合エンジンに判断させる。
    sort: 'standard',
    // ★在庫ありだけに絞る（既定）。売り切れを最安値に混ぜないため。★
    availability: options.inStockOnly === false ? '0' : '1',
    // 1 = 検索対象を絞る（商品名・キャッチコピー等）。
    // 0 にすると商品説明文まで対象になり、
    // 「※JV6423とは別商品です」のような文まで拾って誤一致が増える。
    field: '1',
    // 素の商品オブジェクトが並ぶ形。入れ子を1枚減らせる。
    formatVersion: '2',
  }
}

/**
 * 検索キーワードが公式の制限に収まるか。
 *
 * ★公式仕様: 2文字以上、128バイト以内（UTF-8）。★
 *   超えると 400 が返るので、投げる前にこちらで弾きます。
 */
export function isUsableKeyword(keyword: string): boolean {
  const trimmed = keyword.trim()
  if (trimmed.length < 2) return false
  return Buffer.byteLength(trimmed, 'utf8') <= 128
}

/**
 * 商品から検索条件の一覧を作る（強い手掛かりの順）。
 *
 * 使えない手掛かり（品番が無い等）は、その段階を飛ばします。
 * 呼び出し側は上から順に試し、十分な候補が得られた時点で止めてください。
 */
export function buildRakutenSearchPlans(
  product: Product,
  clubSlug: string,
  clubName: string,
  options: RakutenQueryBuilderOptions = {},
): RakutenSearchPlan[] {
  const plans: RakutenSearchPlan[] = []

  /* ---- Level 1 / 2: メーカー品番 ---- */
  const sku = normalizeCode(product.manufacturerSku)
  // 短すぎる品番は、他の商品の文字列とたまたま一致しやすいので使わない。
  // SAMPLE- で始まるものは開発用のダミー。★実APIへ投げない。★
  const usableSku = sku && sku.length >= 5 && !sku.startsWith('SAMPLE') ? sku : null

  if (usableSku && isUsableKeyword(usableSku)) {
    plans.push({
      level: 'sku',
      description: `メーカー品番 ${usableSku} で検索`,
      params: { ...baseParams(options), keyword: usableSku },
    })

    // ★日本のECサイトは日本語のクラブ名で登録されていることが多い。★
    //   第4.5段階の実データ検証で、英語名だと候補が激減しました。
    const clubTerm = japaneseClubTerm(clubSlug) ?? primaryClubTerm(clubSlug, clubName)
    const withClub = `${usableSku} ${clubTerm}`
    if (isUsableKeyword(withClub)) {
      plans.push({
        level: 'sku-club',
        description: `メーカー品番 ${usableSku} とクラブ名で検索`,
        params: { ...baseParams(options), keyword: withClub },
      })
    }
  }

  /* ---- Level 3: 商品属性（候補発見用）---- */
  const attributeQuery = buildRakutenAttributeQuery(product, clubSlug, clubName)
  if (attributeQuery && isUsableKeyword(attributeQuery)) {
    plans.push({
      level: 'attributes',
      description: `商品属性で検索: ${attributeQuery}`,
      params: { ...baseParams(options), keyword: attributeQuery },
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
 *
 * ★Yahoo!側と同じ考え方で作っています。★
 *   語の辞書（clubAliases / KIT_TYPE_LABEL など）は共用です。
 *   提供元ごとに辞書を二重管理しません（指示書9）。
 */
export function buildRakutenAttributeQuery(
  product: Product,
  clubSlug: string,
  clubName: string,
): string | null {
  const terms: string[] = []

  const clubTerm = japaneseClubTerm(clubSlug) ?? primaryClubTerm(clubSlug, clubName)
  terms.push(clubTerm)

  // シーズンは分かっている場合だけ。国内は「25/26」表記が多い。
  if (product.season) {
    terms.push(product.season.replace(/^20/, ''))
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

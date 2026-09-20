/**
 * 商品一致の信頼度。
 *
 * 海外商品と国内商品が「同じ商品かどうか」は自動では確実に決まらない。
 * そこで confidence（0〜1）を必ず持たせ、一定の基準を満たしたものだけを
 * 価格差表示やランキングへ載せる。
 *
 * ★しきい値の定義はこのファイル1か所だけ。★
 *   数値（0.95 など）を他のファイルへ書き写さないこと。
 *
 * ── 呼び名の対応 ────────────────────────────────
 *   ランク  ConfidenceLevel  confidence   意味
 *   A       highest          >= 0.95      公式・正規専門店、または完全な商品同定
 *   B       high             >= 0.85      JAN / EAN / メーカーSKU による高確度一致
 *   C       medium           >= 0.70      商品属性による一致
 *   D       review           <  0.70      曖昧一致（要確認）
 *
 *   公開している価格比較へ自動で使ってよいのは A / B のみ。
 *   C / D は管理者の確認対象。
 * ──────────────────────────────────────────────
 *
 * このファイルが持つのは「段階の定義」と「使ってよいかの判定」だけ。
 * 実際に商品どうしを突き合わせて confidence を算出する処理は、
 * 第4段階で追加した src/lib/matching/engine.ts にある。
 */

import type { ConfidenceGrade, ConfidenceLevel, DomesticMatch, MatchMethod, Store } from '@/domain/types'

/**
 * 照合手段ごとの標準的な confidence 値。
 *
 *  ean / jan  : 商品コード完全一致 → ランクA
 *  manual     : 人が確認済み       → ランクA
 *  sku        : メーカー品番完全一致（＋クラブ一致）→ ランクB
 *  attributes : クラブ・シーズン・種別などの属性一致 → ランクC
 */
export const CONFIDENCE_BY_METHOD: Record<MatchMethod, number> = {
  ean: 0.99,
  jan: 0.99,
  sku: 0.9,
  attributes: 0.7,
  manual: 0.99,
}

/**
 * 信頼度の段階を決めるしきい値（その値「以上」でその段階になる）。
 *
 * 第1段階では medium を 0.65 にしていたが、第2段階のランク定義（C >= 0.70）に
 * 合わせて 0.70 へそろえた。0.65〜0.70 の値を持つデータは存在しないため、
 * 既存の判定結果は変わらない。
 */
export const CONFIDENCE_THRESHOLDS = {
  /** ランクA: 商品コード一致 or 人による確認済み */
  highest: 0.95,
  /** ランクB: メーカー品番一致 */
  high: 0.85,
  /** ランクC: 属性一致 */
  medium: 0.7,
} as const

/** ランク別のしきい値（上のしきい値を別名で見せているだけ。値は複製しない）。 */
export const CONFIDENCE_GRADE_THRESHOLDS = {
  A: CONFIDENCE_THRESHOLDS.highest,
  B: CONFIDENCE_THRESHOLDS.high,
  C: CONFIDENCE_THRESHOLDS.medium,
} as const

/**
 * 価格差表示・価格差ランキングへ自動掲載してよい下限。
 * ＝ ランクB の下限。これ未満の照合結果は公開面に出さない。
 */
export const COMPARABLE_MIN_CONFIDENCE = CONFIDENCE_THRESHOLDS.high

/** ConfidenceLevel ↔ ConfidenceGrade の対応表。 */
export const LEVEL_TO_GRADE: Record<ConfidenceLevel, ConfidenceGrade> = {
  highest: 'A',
  high: 'B',
  medium: 'C',
  review: 'D',
}

export const GRADE_TO_LEVEL: Record<ConfidenceGrade, ConfidenceLevel> = {
  A: 'highest',
  B: 'high',
  C: 'medium',
  D: 'review',
}

function assertConfidence(confidence: number): void {
  if (!Number.isFinite(confidence)) {
    throw new Error(`confidence が数値ではありません: ${confidence}`)
  }
  if (confidence < 0 || confidence > 1) {
    throw new Error(`confidence は0〜1の範囲で指定してください: ${confidence}`)
  }
}

/** confidence 値から段階を求める。 */
export function toConfidenceLevel(confidence: number): ConfidenceLevel {
  assertConfidence(confidence)

  if (confidence >= CONFIDENCE_THRESHOLDS.highest) return 'highest'
  if (confidence >= CONFIDENCE_THRESHOLDS.high) return 'high'
  if (confidence >= CONFIDENCE_THRESHOLDS.medium) return 'medium'
  return 'review'
}

/** confidence 値からランク（A/B/C/D）を求める。 */
export function toConfidenceGrade(confidence: number): ConfidenceGrade {
  return LEVEL_TO_GRADE[toConfidenceLevel(confidence)]
}

/** そのランクを公開の価格比較へ自動で使ってよいか。 */
export function isAutoComparableGrade(grade: ConfidenceGrade): boolean {
  return grade === 'A' || grade === 'B'
}

/** 段階の日本語ラベル（管理用途。公開ページでは基本的に出さない）。 */
export const CONFIDENCE_LEVEL_LABEL_JA: Record<ConfidenceLevel, string> = {
  highest: '最高信頼度',
  high: '高信頼度',
  medium: '中信頼度',
  review: '要確認',
}

/** ランクの日本語説明。商品詳細ページで「商品一致の確からしさ」を示すのに使う。 */
export const CONFIDENCE_GRADE_LABEL_JA: Record<ConfidenceGrade, string> = {
  A: 'A（商品コードまたは目視で確認済み）',
  B: 'B（メーカー品番が一致）',
  C: 'C（商品の特徴が一致・確認中）',
  D: 'D（一致の確認が取れていない）',
}

/**
 * この照合結果をもとに価格差を公開表示してよいか。
 *
 * - 人が確認済み（reviewed）なら confidence に関わらず表示してよい
 * - そうでなければ COMPARABLE_MIN_CONFIDENCE（ランクB）以上が必要
 */
export function isComparable(match: Pick<DomesticMatch, 'confidence' | 'reviewed'>): boolean {
  if (match.reviewed) return true
  return match.confidence >= COMPARABLE_MIN_CONFIDENCE
}

/**
 * 国内の販売元として、そのまま比較へ使ってよいストアか。
 *
 * ランクA の定義には「メーカー公式・国内正規専門店」が含まれる。
 * 商品同定の確からしさ（confidence）とは別に、
 * 「誰が売っているか」も見る必要があるため、判定をここで分けている。
 *
 *  official / authorized / affiliate … 販売元が特定できているので自動で使ってよい
 *  marketplace                       … 出品者が個別に存在し、中古・非正規・別商品が
 *                                      混ざり得る。次のどちらかが要る:
 *                                        - 人の確認（reviewed）
 *                                        - 照合エンジンの自動検証（verification: automated）
 *                                          ＝商品コード一致・属性矛盾なし・新品・相場内
 */
export function isTrustedDomesticStore(
  store: Pick<Store, 'type'>,
  match: Pick<DomesticMatch, 'reviewed' | 'verification'>,
): boolean {
  if (store.type !== 'marketplace') return true

  // 人が目視で確認済み
  if (match.reviewed) return true

  // 照合エンジンの厳格な条件（商品コード一致・属性矛盾なし・新品・
  // 相場から外れていない）をすべて通ったもの
  return match.verification === 'automated'
}

/**
 * 「新品かどうか確認できていない」ときの要確認理由。
 *
 * ★文言を2か所に書かないための定数です。★
 *   採用の判定（isAdoptableOffer）がこの理由を名指しで扱うため、
 *   文字列がずれると歯止めが効かなくなります。
 */
export const CONDITION_UNKNOWN_REVIEW_REASON = '新品かどうか確認できていません'

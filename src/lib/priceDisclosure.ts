/**
 * 「この価格を公開して見せてよいか」を1か所で決める。
 *
 * ══════════════════════════════════════════════════════════
 * ★なぜ必要か★
 *
 *   いま画面に出ている価格・割引率・国内との差額は、すべて動作確認用の
 *   サンプル値です（データ取得層が isSampleData: true を返しています）。
 *
 *   全ページの上部に「開発中のサンプル表示です」の帯を出していますが、
 *   それでは防げない誤認がありました。
 *
 *     ・検索結果に出る説明文に金額が入っていた
 *       （例「日本到着推定額は14,089円。」）。検索結果に帯は出ません。
 *     ・「21%OFF」「国内より1,231円安い」のような言い切りの表示
 *     ・サンプル価格で並べ替えたセール一覧・価格差ランキング
 *
 *   売っていない値段を売値のように見せること自体が リスクです。
 *   帯で言い添えるのではなく、**公開する画面には出さない**ようにします。
 *
 * ★やり方★
 *   公開用のビルド（NEXT_PUBLIC_SITE_PREVIEW=false）で、かつデータが
 *   サンプルのときだけ、価格のもと（掲載・価格履歴・国内照合）を
 *   画面へ渡しません。
 *
 *   価格が無い状態は、もともと画面が持っている通り道です。
 *   「価格情報を確認できていません。」と出て、セール一覧と
 *   価格差ランキングは空になり、sitemap からも自動で外れます。
 *   架空の値で埋めることはしません。
 *
 * ★消すのはデータではなく表示です★
 *   fixture の掲載データは残したままです。価格計算のテスト
 *   （ケースA〜F など）は手元の実行でこれまで通り動きます。
 *   実データに入れ替われば isSampleData が false になり、
 *   価格表示はそのまま戻ります。
 * ══════════════════════════════════════════════════════════
 */

import { IS_PREVIEW } from '@/lib/site'

/** 価格を出さない理由。画面に出す文の出し分けにも使う。 */
export type PriceWithholdReason =
  /** 出典が確認できていない（サンプル）価格のため、公開画面には出さない。 */
  | 'unverified-sample'
  /** 出さない理由は無い。 */
  | null

export interface PriceDisclosureInput {
  /** データ取得層がサンプルデータを返しているか。 */
  isSampleData: boolean
  /**
   * 公開用のビルドか。
   * 既定は site.ts の IS_PREVIEW（未設定なら「公開ではない」側に倒す）。
   */
  isPublicBuild?: boolean
}

/**
 * 公開画面へ価格を出してよいか。
 *
 * ★手元の確認（開発・テスト）では今まで通り価格が出ます。★
 *   数字が見えないと、計算が合っているかを目で確かめられないためです。
 *   出さないのは公開するビルドだけに絞ります。
 */
export function priceWithholdReason(input: PriceDisclosureInput): PriceWithholdReason {
  const isPublicBuild = input.isPublicBuild ?? !IS_PREVIEW
  if (isPublicBuild && input.isSampleData) return 'unverified-sample'
  return null
}

/** 価格を出してよいか（true なら出してよい）。 */
export function canPublishPrices(input: PriceDisclosureInput): boolean {
  return priceWithholdReason(input) === null
}

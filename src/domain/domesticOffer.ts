/**
 * 国内の販売候補（提供元によらない共通の形）。
 *
 * Yahoo!ショッピング・楽天・専門店など、国内の価格はいくつもの場所から集まります。
 * 提供元ごとにレスポンスの形はばらばらなので、
 * 一度この形へそろえてから先の処理（比較・採用判定）へ渡します。
 *
 *   Yahoo! APIレスポンス  ─┐
 *   楽天 APIレスポンス    ─┼→ DomesticOffer →  照合 → DomesticMatch → 価格比較
 *   その他                ─┘
 *
 * ★提供元固有のフィールドをここへ持ち込まないこと。★
 *   ここが提供元に依存すると、提供元を足すたびに下流も直すことになります。
 */

import type { ConfidenceGrade, IsoDateTime, ProductCondition } from './types'
import { CONDITION_UNKNOWN_REVIEW_REASON } from '@/lib/matching/confidence'

/** どこから取った候補か。増えても下流を変えずに済むよう文字列の型で持つ。 */
export type DomesticOfferSource = 'yahoo' | 'rakuten' | 'manual'

export const DOMESTIC_OFFER_SOURCE_LABEL_JA: Record<DomesticOfferSource, string> = {
  yahoo: 'Yahoo!ショッピング',
  rakuten: '楽天市場',
  manual: '手動登録',
}

export interface DomesticOffer {
  source: DomesticOfferSource
  /** 提供元での商品ID。 */
  externalId: string
  /** 商品名（提供元の原文）。 */
  title: string
  /** 商品ページURL。 */
  url: string

  /** 価格（円・税込）。★0や負の値は取り込み時点で弾く。★ */
  priceJpy: number
  /** 通常価格（円）。取れなければ null。★current で埋めないこと。★ */
  regularPriceJpy: number | null
  /**
   * 国内送料（円）。
   * ★条件が分からない場合は null。0円と決めつけないこと。★
   */
  shippingJpy: number | null
  /**
   * 送料込みの総額（円）。送料が分からなければ null。
   * ★海外側の日本到着推定額（送料込み）と条件をそろえて比べるため、
   *   比較にはこちらを使う。★
   */
  totalPriceJpy: number | null

  sellerId: string | null
  sellerName: string | null

  /** 在庫。★取れなければ null。true と決めつけない。★ */
  inStock: boolean | null
  /** 新品／中古。★取れなければ unknown。★ */
  condition: ProductCondition
  /**
   * 新品かどうかを、どうやって確かめたか（第5段階で追加）。
   *
   *   api-new       … 提供元のAPIが「新品」と明言している
   *   api-used      … 提供元のAPIが「中古」と明言している
   *   title-checked … ★APIに項目が無く、商品名に中古を示す語が無いことだけ確認した★
   *   unknown       … 確かめられていない
   *
   * ★title-checked は「新品である」ことの証明ではありません。★
   *   楽天市場の商品検索APIには新品／中古の項目そのものがありません。
   *   「中古と書かれていない」は「新品だ」とは違います。
   *   出品者が書き忘れているだけかもしれません。
   *   そのため既定では自動採用しません（isAdoptableOffer を参照）。
   */
  conditionEvidence: 'api-new' | 'api-used' | 'title-checked' | 'unknown'

  /** 商品一致の信頼度（0〜1）。 */
  matchConfidence: number
  /** 信頼度ランク。 */
  matchGrade: ConfidenceGrade
  /** どの手掛かりで見つけたか（jan / sku / attributes など）。 */
  matchLevel: string

  /**
   * ★なぜ同じ商品だと考えたのか／なぜ違うと考えたのか。★
   *
   *   採用したものも落としたものも、根拠を残しておかないと
   *   あとから人が確かめられません。誤一致を見つける手掛かりになります。
   */
  positiveEvidence: string[]
  negativeEvidence: string[]
  /** 判断できなかった項目。★「一致」ではないことを明示するために持つ。★ */
  unknownAttributes: string[]
  /** 不採用の理由コード（sleeveMismatch など）。 */
  rejectCodes: string[]
  /** 比較対象から外した場合、その理由。空なら採用候補。 */
  rejectReasons: string[]
  /** 人の確認へ回すべき理由。空なら自動で扱える。 */
  reviewReasons: string[]
  /**
   * 自動検証を通ったか。
   * モール型の掲載は、これが 'automated' でないと価格比較に使わない。
   */
  verification: 'automated' | 'none'

  /**
   * ポイント還元やキャンペーンの表示（第5段階で追加）。
   *
   * ★これを価格から差し引かないこと。★
   *   「10,000円・1,000ポイント還元」を「実質9,000円」として比べると、
   *   ポイントを使わない人にも、会員条件を満たさない人にも当てはまらない
   *   数字を「国内最安」として見せることになります。
   *   ポイントは現金ではありません。表示のための覚え書きとしてだけ持ちます。
   *   クーポン（会員限定・アプリ限定・枚数限定）も同じ扱いです。
   */
  rewardNote: string | null
  /** 画像URL。★利用条件が未確認のうちは表示に使わない。記録のみ。★ */
  imageUrl: string | null

  /** いつ時点の情報か。 */
  fetchedAt: IsoDateTime
}

/**
 * 採用の方針（第5段階で追加）。
 *
 * ★既定はいちばん厳しい設定です。★
 *   ここを緩めると、確かめていないものが「国内最安」として画面へ出ます。
 *   緩めるかどうかは、実データを見たうえで人が決めてください。
 */
export interface AdoptionPolicy {
  /**
   * 提供元のAPIに新品／中古の項目が無いとき、
   * 「商品名に中古を示す語が無いこと」をもって新品として扱うか。
   *
   * ★既定は false（扱わない）。★
   *
   *   楽天市場の商品検索APIには新品／中古の項目そのものがありません。
   *   そのため楽天の候補は、既定ではすべて「新品か確認できていない」
   *   として自動採用から外れます。
   *
   *   true にすると、商品名に「中古」「訳あり」等が無いものを
   *   新品として扱います。これは推測です。出品者が書き忘れていれば、
   *   中古が新品最安値として画面に出ます。
   *
   *   ★true にする前に、実データで中古がどれくらい混ざるかを
   *     必ず目視で確かめてください。★
   */
  acceptTitleCheckedCondition: boolean
}

/** 既定の方針（いちばん厳しい）。 */
export const STRICT_ADOPTION_POLICY: AdoptionPolicy = {
  acceptTitleCheckedCondition: false,
}

/**
 * 「新品かどうか確認できていない」ことだけを見逃してよい候補か。
 *
 * ★見逃してよいのは、提供元のAPIにそもそも項目が無い場合だけです。★
 *   Yahoo!のように項目がある提供元で値が取れていないなら、
 *   それは「その出品者が書いていない」ということなので見逃しません。
 *
 * ★方針で明示的に許可したときにだけ true になります。★
 */
function canWaiveConditionCheck(offer: DomesticOffer, policy: AdoptionPolicy): boolean {
  if (!policy.acceptTitleCheckedCondition) return false
  if (offer.conditionEvidence !== 'title-checked') return false
  // 商品名に中古とあったものは、方針に関わらず通さない
  return offer.condition !== 'used'
}

/** 価格比較へ自動で使ってよい候補か。 */
export function isAdoptableOffer(
  offer: DomesticOffer,
  policy: AdoptionPolicy = STRICT_ADOPTION_POLICY,
): boolean {
  if (offer.rejectReasons.length > 0) return false
  // ★送料が分からない候補は総額を出せないので比較に使わない（第2段階の方針と同じ）★
  if (offer.totalPriceJpy === null) return false

  const waivable = canWaiveConditionCheck(offer, policy)

  // ★見逃してよいのは「新品か確認できていない」という理由ひとつだけ。★
  //   他の要確認理由（税別価格・相場より安すぎる・マーキング不明など）は、
  //   方針をどう決めても必ず残ります。
  const outstanding = waivable
    ? offer.reviewReasons.filter((reason) => reason !== CONDITION_UNKNOWN_REVIEW_REASON)
    : offer.reviewReasons
  if (outstanding.length > 0) return false

  if (offer.condition !== 'new' && !waivable) return false
  if (offer.verification !== 'automated' && !waivable) return false
  if (offer.inStock !== true) return false
  return offer.matchGrade === 'A' || offer.matchGrade === 'B'
}

/**
 * 方針を緩めたら何件増えるか。
 *
 * ★画面には使いません。人が方針を決めるための材料です。★
 */
export function countWouldBeAdopted(
  offers: DomesticOffer[],
  policy: AdoptionPolicy,
): number {
  return offers.filter((offer) => isAdoptableOffer(offer, policy)).length
}

/**
 * 海外商品 ↔ 国内掲載の照合結果（DomesticMatch）の fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 *
 * 判定エンジン（実際に商品を突き合わせて confidence を算出する処理）は
 * 第2段階でもまだ実装しません。ここでは
 * 「判定エンジンが出力したらこうなる」という形のデータを手で用意しています。
 * 第3段階で判定エンジンを作ったら、この配列は生成結果へ置き換わります。
 *
 * confidence の値は CONFIDENCE_BY_METHOD から取り、
 * 照合手段と信頼度が矛盾しないようにしています。
 *
 * ■ わざと通らないようにしてあるデータ
 *   価格比較が壊れないことを確かめるため、次の4件は比較対象から外れます。
 *
 *   1. match-thfc-scarf         … 信頼度がランクCで未確認（ケースD）
 *   2. match-lfc-home-r-marketplace … モール型の出品で人の確認が無い
 *   3. match-fcb-home-r-oos     … 在庫切れ
 *   4. match-rma-home-a-wrong   … レプリカとオーセンティックの取り違え（ケースF）
 *
 *   特に 4 は重要です。confidence はランクB（0.9）と高いのに、
 *   結び付け先はレプリカの掲載で、比較したい商品はオーセンティックです。
 *   属性の食い違いを見ずに confidence だけで判断すると、
 *   「国内購入の方が1万円以上安い」という誤った差額が出てしまいます。
 */

import type { DomesticMatch, MatchMethod } from '@/domain/types'
import { CONFIDENCE_BY_METHOD } from '@/lib/matching/confidence'

interface MatchSeed {
  id: string
  productId: string
  storeListingId: string
  matchMethod: MatchMethod
  reviewed: boolean
}

function match(seed: MatchSeed): DomesticMatch {
  return {
    ...seed,
    confidence: CONFIDENCE_BY_METHOD[seed.matchMethod],
    createdAt: '2026-09-18T09:00:00.000Z',
  }
}

export const domesticMatchFixtures: DomesticMatch[] = [
  // ケースB（国内購入の方が安い）で使う。モール型なので人の確認済みにしてある。
  match({
    id: 'match-lfc-away-a',
    productId: 'product-lfc-2526-away-authentic',
    storeListingId: 'listing-lfc-away-a-domestic',
    matchMethod: 'sku',
    reviewed: true,
  }),
  match({
    id: 'match-thfc-home-r',
    productId: 'product-thfc-2526-home-replica',
    storeListingId: 'listing-thfc-home-r-domestic',
    matchMethod: 'ean',
    reviewed: false,
  }),
  // ↓ ケースD: 信頼度が基準に届かない例。価格差表示・ランキングへは出さない。
  match({
    id: 'match-thfc-scarf',
    productId: 'product-thfc-2526-scarf',
    storeListingId: 'listing-thfc-scarf-domestic',
    matchMethod: 'attributes',
    reviewed: false,
  }),
  match({
    id: 'match-fcb-home-r',
    productId: 'product-fcb-2526-home-replica',
    storeListingId: 'listing-fcb-home-r-domestic',
    matchMethod: 'ean',
    reviewed: true,
  }),
  match({
    id: 'match-fcb-third-r',
    productId: 'product-fcb-2526-third-replica',
    storeListingId: 'listing-fcb-third-r-domestic',
    matchMethod: 'sku',
    reviewed: true,
  }),
  match({
    id: 'match-rma-home-r',
    productId: 'product-rma-2526-home-replica',
    storeListingId: 'listing-rma-home-r-domestic',
    matchMethod: 'ean',
    reviewed: false,
  }),
  match({
    id: 'match-rma-home-a',
    productId: 'product-rma-2526-home-authentic',
    storeListingId: 'listing-rma-home-a-domestic',
    matchMethod: 'manual',
    reviewed: true,
  }),

  /* ==========================================================
   * 第2段階で追加した検証用の照合結果
   * ======================================================== */

  // ケースA: 海外購入がかなり安い
  match({
    id: 'match-lfc-2425-home-r',
    productId: 'product-lfc-2425-home-replica',
    storeListingId: 'listing-lfc-2425-home-domestic',
    matchMethod: 'ean',
    reviewed: true,
  }),

  // ↓ 在庫切れのため比較対象から外れる例（信頼度と販売元は問題なし）
  match({
    id: 'match-fcb-home-r-oos',
    productId: 'product-fcb-2526-home-replica',
    storeListingId: 'listing-fcb-home-r-domestic-oos',
    matchMethod: 'ean',
    reviewed: true,
  }),

  /*
   * ↓ ケースF: レプリカとオーセンティックの取り違え。
   *   product-rma-2526-home-authentic（オーセンティック）に対して、
   *   レプリカの国内掲載（listing-rma-home-r-domestic）を結び付けている。
   *   confidence は 0.9（ランクB）と高いが、
   *   レプリカ／オーセンティックが食い違うので比較対象から外す。
   */
  match({
    id: 'match-rma-home-a-wrong',
    productId: 'product-rma-2526-home-authentic',
    storeListingId: 'listing-rma-home-r-domestic',
    matchMethod: 'sku',
    reviewed: false,
  }),
]

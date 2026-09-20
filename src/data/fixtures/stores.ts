/**
 * 販売元（ストア）の fixture データ。
 *
 * ★これは開発用のサンプルデータです。★
 *
 * ■ 命名の方針
 *   - 海外公式ストア: 実在する公式ストアの名称・URLを使用しています
 *     （公開情報であり、事実として正しいものだけを入れています）。
 *   - 国内の比較対象: 実在の販売店名は使っていません。
 *     サンプル価格を実在の店舗へ結び付けてしまうと誤解を招くためです。
 *     第2段階でAPI接続する際に、実際の販売元へ置き換えます。
 */

import type { Store } from '@/domain/types'

export const storeFixtures: Store[] = [
  /* ----- 海外公式ストア ------------------------------------ */
  {
    id: 'store-lfc-official',
    slug: 'liverpool-official-store',
    name: 'Liverpool FC Official Store',
    type: 'official',
    currency: 'GBP',
    country: 'イギリス',
    japanShippingAvailable: true,
    shippingType: 'direct',
    affiliateAvailable: false,
    active: true,
  },
  {
    id: 'store-thfc-official',
    slug: 'tottenham-official-store',
    name: 'Tottenham Hotspur Official Store',
    type: 'official',
    currency: 'GBP',
    country: 'イギリス',
    japanShippingAvailable: true,
    shippingType: 'direct',
    affiliateAvailable: false,
    active: true,
  },
  {
    id: 'store-fcb-official',
    slug: 'fc-barcelona-official-store',
    name: 'FC Barcelona Official Store',
    type: 'official',
    currency: 'EUR',
    country: 'スペイン',
    japanShippingAvailable: true,
    shippingType: 'direct',
    affiliateAvailable: false,
    active: true,
  },
  {
    id: 'store-rma-official',
    slug: 'real-madrid-official-store',
    name: 'Real Madrid Official Store',
    type: 'official',
    currency: 'EUR',
    country: 'スペイン',
    japanShippingAvailable: true,
    shippingType: 'direct',
    affiliateAvailable: false,
    active: true,
  },

  /* ----- 国内の比較対象（すべて架空の販売元） ---------------- */
  {
    id: 'store-jp-sample-a',
    slug: 'sample-domestic-shop-a',
    name: '国内販売店A（サンプル）',
    type: 'authorized',
    currency: 'JPY',
    country: '日本',
    japanShippingAvailable: true,
    shippingType: 'domestic',
    affiliateAvailable: false,
    active: true,
  },
  {
    id: 'store-jp-sample-b',
    slug: 'sample-domestic-mall-b',
    name: '国内モールB（サンプル）',
    type: 'marketplace',
    currency: 'JPY',
    country: '日本',
    japanShippingAvailable: true,
    shippingType: 'domestic',
    affiliateAvailable: false,
    active: true,
  },

  /* ----- 第2段階で追加した検証用のストア ---------------------- */
  {
    /**
     * 送料不明のケース（ケースC）を確かめるための架空の海外ストア。
     * ShippingRule が type: 'unknown' になっており、
     * 日本到着推定額を「算出不可」として扱えるかを確認する。
     */
    id: 'store-select-c',
    slug: 'sample-overseas-select-c',
    name: '海外セレクトショップC（サンプル）',
    type: 'authorized',
    currency: 'GBP',
    country: 'イギリス',
    japanShippingAvailable: true,
    shippingType: 'direct',
    affiliateAvailable: false,
    active: true,
  },
  {
    /**
     * 出品者が個別に存在するモール型（フリマ）の想定。
     * 極端に安い出品が混ざることがあるため、
     * 人の確認（DomesticMatch.reviewed）が無いかぎり比較には使わない。
     * 「単純な最安値を採用しない」ことを確かめるためのストア。
     */
    id: 'store-jp-marketplace-c',
    slug: 'sample-domestic-marketplace-c',
    name: '国内フリマC（サンプル）',
    type: 'marketplace',
    currency: 'JPY',
    country: '日本',
    japanShippingAvailable: true,
    shippingType: 'domestic',
    affiliateAvailable: false,
    active: true,
  },
]

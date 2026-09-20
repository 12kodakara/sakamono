/**
 * 送料の決まり（ShippingRule）の fixture データ。
 *
 * ★これは開発用のサンプルデータです。実際の送料ではありません。★
 *
 * 送料を商品価格から切り離して持つことで、
 * 「送料だけを新しい情報へ差し替える」ことができるようにしています。
 *
 * 4つのタイプをすべて使い、計算を確かめられるようにしてあります。
 *   fixed     … store-thfc-official / store-jp-sample-b / store-jp-marketplace-c
 *   threshold … store-lfc-official / store-jp-sample-a
 *   estimated … store-fcb-official / store-rma-official
 *   unknown   … store-select-c（送料不明のケース確認用）
 */

import type { ShippingRule } from '@/domain/types'

const UPDATED_AT = '2026-09-18T09:00:00.000Z'
const SOURCE = 'サンプル（開発用）'

export const shippingRuleFixtures: ShippingRule[] = [
  /* ----- 海外ストア ---------------------------------------- */
  {
    id: 'ship-lfc-official-jp',
    storeId: 'store-lfc-official',
    destinationCountry: 'JP',
    type: 'threshold',
    currency: 'GBP',
    amount: 15,
    freeShippingThreshold: 150,
    updatedAt: UPDATED_AT,
    source: SOURCE,
  },
  {
    id: 'ship-thfc-official-jp',
    storeId: 'store-thfc-official',
    destinationCountry: 'JP',
    type: 'fixed',
    currency: 'GBP',
    amount: 14,
    updatedAt: UPDATED_AT,
    source: SOURCE,
  },
  {
    id: 'ship-fcb-official-jp',
    storeId: 'store-fcb-official',
    destinationCountry: 'JP',
    type: 'estimated',
    currency: 'EUR',
    amount: 18,
    updatedAt: UPDATED_AT,
    source: SOURCE,
    note: '送料が決済画面でしか確定しないため、サカモノが置いた推定値です。',
  },
  {
    id: 'ship-rma-official-jp',
    storeId: 'store-rma-official',
    destinationCountry: 'JP',
    type: 'estimated',
    currency: 'EUR',
    amount: 20,
    updatedAt: UPDATED_AT,
    source: SOURCE,
    note: '送料が決済画面でしか確定しないため、サカモノが置いた推定値です。',
  },
  {
    // ★送料不明のケース（ケースC）。0円として計算されないことを確認するためのデータ。
    id: 'ship-select-c-jp',
    storeId: 'store-select-c',
    destinationCountry: 'JP',
    type: 'unknown',
    currency: 'GBP',
    updatedAt: UPDATED_AT,
    source: SOURCE,
    note: '日本向けの送料が公開されておらず、確認できていません。',
  },

  /* ----- 国内ストア ---------------------------------------- */
  {
    id: 'ship-jp-sample-a',
    storeId: 'store-jp-sample-a',
    destinationCountry: 'JP',
    type: 'threshold',
    currency: 'JPY',
    amount: 660,
    freeShippingThreshold: 10000,
    updatedAt: UPDATED_AT,
    source: SOURCE,
  },
  {
    id: 'ship-jp-sample-b',
    storeId: 'store-jp-sample-b',
    destinationCountry: 'JP',
    type: 'fixed',
    currency: 'JPY',
    amount: 550,
    updatedAt: UPDATED_AT,
    source: SOURCE,
  },
  {
    id: 'ship-jp-marketplace-c',
    storeId: 'store-jp-marketplace-c',
    destinationCountry: 'JP',
    type: 'fixed',
    currency: 'JPY',
    amount: 0,
    updatedAt: UPDATED_AT,
    source: SOURCE,
    note: '送料込みの出品です。',
  },
]

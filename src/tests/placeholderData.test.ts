/**
 * 商品データに、開発用のダミーが混ざっていないかを見張るテスト。
 *
 * ══════════════════════════════════════════════════════════
 * ★「本番に出す商品の情報」と「テスト・開発用のデータ」を分けて考えます。★
 *
 *   ここで見るのは商品そのものの情報（src/data/fixtures/products.ts）です。
 *     ・仮の品番（SAMPLE-…）
 *     ・実在しないコード（「20」で始まる13桁は店舗内管理用の予約番号）
 *   これらは商品を指す「事実」のふりをしてしまうため、置いてはいけません。
 *
 *   一方、次のものは開発用のデータとして残しています（ここでは禁止しません）。
 *     ・掲載と価格（src/data/fixtures/listings.ts。すべて example.com のサンプル）
 *     ・サンプルの販売元（国内販売店A など）
 *     ・外部APIのサンプル応答（src/data/external の各 sample ファイル）
 *   サイトは「開発中のサンプル表示です」と全ページに明示したうえで動いています。
 *   実データへ置き換える工程で、掲載と価格も順に入れ替えます。
 *
 * ★公式確認済みの商品には、掲載のダミーも許しません。★
 *   その検査は src/tests/officialChecks.test.ts にあります。
 * ══════════════════════════════════════════════════════════
 */

import { describe, expect, it } from 'vitest'
import { listingFixtures, productFixtures, storeFixtures } from '@/data/fixtures'

/** 「20」で始まる13桁＝店舗内管理用の予約番号。実在の商品には付かない。 */
const PLACEHOLDER_CODE = /^20\d{11}$/

describe('★商品データにダミーを混ぜない★', () => {
  it('仮の品番（SAMPLE-…）を持つ商品が無い', () => {
    const found = productFixtures
      .filter((product) => /^(SAMPLE|TEST|DUMMY|FAKE)/i.test(product.manufacturerSku ?? ''))
      .map((product) => `${product.id}: ${product.manufacturerSku}`)
    expect(found).toEqual([])
  })

  it('実在しないJAN/EAN（「20」で始まる13桁）を持つ商品が無い', () => {
    const found = productFixtures
      .filter((product) => PLACEHOLDER_CODE.test(product.jan ?? '') || PLACEHOLDER_CODE.test(product.ean ?? ''))
      .map((product) => `${product.id}: ${product.jan ?? '-'} / ${product.ean ?? '-'}`)
    expect(found).toEqual([])
  })

  it('JAN・EANは8桁または13桁の数字か、未確認（null）だけ', () => {
    for (const product of productFixtures) {
      for (const code of [product.jan, product.ean]) {
        if (code !== null) expect(code, product.id).toMatch(/^\d{8}$|^\d{13}$/)
      }
    }
  })

  it('商品名・英語名にダミーを示す語が入っていない', () => {
    for (const product of productFixtures) {
      expect(`${product.name} ${product.nameJa}`, product.id).not.toMatch(/sample|dummy|placeholder|test|todo/i)
    }
  })

  it('画像は自前のプレースホルダーか、権利を確認した画像だけ（外部URLの直参照が無い）', () => {
    for (const product of productFixtures) {
      expect(product.image.src, product.id).not.toMatch(/^https?:\/\//)
      expect(['placeholder', 'licensed', 'remote']).toContain(product.image.source)
    }
  })

  /*
   * 掲載・価格は、実データ化が済むまで開発用のサンプルのままです。
   * ★減っていくことは歓迎しますが、増えていないことだけ見張ります。★
   * 実データを入れるときは、この数を下げてから（または実URLで置き換えてから）進めます。
   */
  it('ダミーURLの掲載が、いまの件数より増えていない', () => {
    const dummy = listingFixtures.filter((listing) => /example\.(com|org|net)/.test(listing.externalUrl))
    expect(dummy.length).toBeLessThanOrEqual(20)
  })

  it('サンプルの販売元が、いまの数より増えていない', () => {
    const sampleStores = storeFixtures.filter((store) => /sample/i.test(store.slug))
    expect(sampleStores.length).toBeLessThanOrEqual(4)
    // サンプルの販売元は、実在の店名を名乗らない（誤解を招かないため）
    for (const store of sampleStores) expect(store.name).toMatch(/サンプル/)
  })
})

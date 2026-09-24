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
import {
  domesticMatchFixtures,
  listingFixtures,
  priceSnapshotFixtures,
  productFixtures,
  storeFixtures,
} from '@/data/fixtures'

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

/* ============================================================
 * 重複していた仮商品の削除（2026-09-23）
 *
 * リヴァプールの「ホーム レプリカ（ウィメンズ）」は、公式確認済みの
 * JV6423 と、クラブ・シーズン・種類・仕様・袖まで同じで、違いは性別の値だけでした。
 * 独立した品番が無く、作られた経緯も照合の検証用だったため削除しています。
 *   監査記録: docs/data-sources/placeholder-audit.md
 * ========================================================== */

describe('★重複していた仮商品を戻さない★', () => {
  it('ウィメンズのホーム レプリカが商品データに無い', () => {
    const found = productFixtures.filter(
      (product) =>
        product.id === 'product-lfc-2526-womens-home-replica' ||
        product.slug === 'liverpool-2025-26-womens-home-replica',
    )
    expect(found).toEqual([])
  })

  it('公式確認済みの JV6423 と、判定保留の2商品は残っている', () => {
    const ids = new Set(productFixtures.map((product) => product.id))
    // JV6423（公式確認済み・Grade A）
    expect(ids.has('product-lfc-2526-home-replica')).toBe(true)
    expect(
      productFixtures.find((product) => product.id === 'product-lfc-2526-home-replica')?.manufacturerSku,
    ).toBe('JV6423')
    // マーキング版（バリエーション）と、調査待ちのゴールキーパー
    expect(ids.has('product-lfc-2526-home-replica-salah')).toBe(true)
    expect(ids.has('product-lfc-2526-goalkeeper-replica')).toBe(true)
  })

  it('商品の件数と、ユニフォームの件数', () => {
    expect(productFixtures).toHaveLength(22)
    expect(productFixtures.filter((product) => product.category === 'kits')).toHaveLength(19)
  })

  it('★削除した商品を指す掲載・照合・価格履歴が残っていない★', () => {
    const productIds = new Set(productFixtures.map((product) => product.id))
    for (const listing of listingFixtures) {
      expect(productIds.has(listing.productId), `掲載 ${listing.id} の参照先`).toBe(true)
    }
    const listingIds = new Set(listingFixtures.map((listing) => listing.id))
    for (const match of domesticMatchFixtures) {
      expect(productIds.has(match.productId), `照合 ${match.id} の商品`).toBe(true)
      expect(listingIds.has(match.storeListingId), `照合 ${match.id} の掲載`).toBe(true)
    }
    for (const snapshot of priceSnapshotFixtures) {
      expect(listingIds.has(snapshot.storeListingId), `価格履歴 ${snapshot.id} の掲載`).toBe(true)
    }
  })
})

/**
 * 人手で公式情報を確認した商品のテスト。
 *
 * 記録: docs/data-sources/manual-official-checks.md
 *
 * ★公式表示と一致することを確認した値が、あとの編集で変わっていないかを守ります。★
 *   変えるときは、先に公式情報を確認し直して記録を更新してください。
 *
 * ★品番と商品の結び付きも守ります。★
 *   品番を別の商品へ付け替えると、照合で「同じ商品」と誤判定させてしまいます。
 */

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listingFixtures, productFixtures, storeFixtures } from '@/data/fixtures'

const PRODUCTS_SOURCE = readFileSync('src/data/fixtures/products.ts', 'utf8')
const RECORD = readFileSync('docs/data-sources/manual-official-checks.md', 'utf8')

/** 記録に書いた公式表示の値（画面に表示が無かった項目は含めない）。 */
const CONFIRMED = [
  {
    sku: 'JV6487',
    id: 'product-lfc-2526-away-replica',
    clubId: 'club-liverpool',
    season: '2025/26',
    kitType: 'away',
    authenticity: 'replica',
    manufacturer: 'adidas',
  },
  {
    sku: 'JV6456',
    id: 'product-lfc-2526-home-replica-long',
    clubId: 'club-liverpool',
    season: '2025/26',
    kitType: 'home',
    authenticity: 'replica',
    manufacturer: 'adidas',
    sleeve: 'long',
  },
  {
    sku: 'JV6436',
    id: 'product-lfc-2526-home-replica-junior',
    clubId: 'club-liverpool',
    season: '2025/26',
    kitType: 'home',
    authenticity: 'replica',
    manufacturer: 'adidas',
    gender: 'kids',
  },
  {
    sku: 'JV6423',
    id: 'product-lfc-2526-home-replica',
    clubId: 'club-liverpool',
    season: '2025/26',
    kitType: 'home',
    authenticity: 'replica',
    manufacturer: 'adidas',
  },
  {
    sku: 'KA6855',
    id: 'product-lfc-2526-third-replica',
    clubId: 'club-liverpool',
    season: '2025/26',
    kitType: 'third',
    authenticity: 'replica',
    manufacturer: 'adidas',
  },
  {
    sku: 'JJ1931',
    id: 'product-rma-2526-home-replica',
    clubId: 'club-real-madrid',
    season: '2025/26',
    kitType: 'home',
    authenticity: 'replica',
    manufacturer: 'adidas',
    gender: 'men',
    sleeve: 'short',
  },
  {
    sku: 'JV5918',
    id: 'product-rma-2526-home-authentic',
    clubId: 'club-real-madrid',
    season: '2025/26',
    // ★レプリカ（JJ1931）とは別商品・別品番。★
    kitType: 'home',
    authenticity: 'authentic',
    manufacturer: 'adidas',
    gender: 'men',
    sleeve: 'short',
  },
  {
    sku: 'JY4237',
    id: 'product-lfc-2526-home-authentic',
    clubId: 'club-liverpool',
    season: '2025/26',
    // ★レプリカ（JV6423）とは別商品。取り違えると価格比較が大きく狂う。★
    kitType: 'home',
    authenticity: 'authentic',
    manufacturer: 'adidas',
  },
] as const

/**
 * 同じ品番を持ってよい、確認済み商品以外の商品。
 *
 * マーキング（選手名・背番号）は無地のシャツへ後から入れるため、
 * 実際のデータでも品番は無地と同じになります。
 * 「品番が一致した＝同じ商品」と判断しないことを確かめるための商品です。
 */
const SHARED_SKU_EXCEPTIONS: Record<string, string[]> = {
  JV6423: ['product-lfc-2526-home-replica-salah'],
}

/**
 * まだ開発用のサンプル掲載（example.com・サンプル価格・サンプルの販売元）が残っている商品。
 *
 * ★商品そのものの公式確認と、掲載・価格の正しさは別の問題です。★
 *   公式確認できたからといって、サンプルの価格や販売元が正しくなるわけではありません。
 *   掲載の実データ化は別の工程で行い、済んだらこの一覧から外します。
 */
const SAMPLE_LISTINGS_REMAIN = new Set([
  'product-rma-2526-home-replica',
  'product-rma-2526-home-authentic',
])

describe('★人手で公式確認した商品★', () => {
  it('確認済みの品番は8件で、重複していない', () => {
    const skus = CONFIRMED.map((checked) => checked.sku)
    expect(skus).toHaveLength(8)
    expect(new Set(skus).size).toBe(skus.length)
  })

  for (const checked of CONFIRMED) {
    it(`${checked.sku} は公式表示と一致する値のまま`, () => {
      const product = productFixtures.find((item) => item.id === checked.id)
      expect(product, `${checked.id} が見つかりません`).toBeDefined()
      const { sku, ...expected } = checked
      expect(product).toMatchObject({ ...expected, manufacturerSku: sku, category: 'kits' })
    })

    it(`${checked.sku} を別の商品へ付け替えていない`, () => {
      const holders = productFixtures
        .filter((item) => item.manufacturerSku === checked.sku)
        .map((item) => item.id)
      const allowed = [checked.id, ...(SHARED_SKU_EXCEPTIONS[checked.sku] ?? [])]
      expect([...holders].sort()).toEqual([...allowed].sort())
    })

    it(`${checked.sku} の公式確認の記録がある`, () => {
      // 記録（docs）と商品データ（コメント）の両方から追跡できること
      expect(RECORD).toContain(`${checked.sku}（${checked.id}）`)
      expect(PRODUCTS_SOURCE).toContain(`manual-official-checks.md（${checked.sku}）`)
    })
  }

  /*
   * ★レプリカとオーセンティックの取り違えを防ぐ。★
   *   同じクラブ・同じシーズン・同じ種類で仕様だけが違う組は、
   *   品番を入れ替えると価格比較が大きく狂います（1万円以上違うことがある）。
   */
  it('★同じホームでも、レプリカとオーセンティックは別の品番★', () => {
    const pairs = [
      { replica: 'JJ1931', authentic: 'JV5918', club: 'club-real-madrid' },
      { replica: 'JV6423', authentic: 'JY4237', club: 'club-liverpool' },
    ]
    for (const pair of pairs) {
      const replica = productFixtures.find((item) => item.manufacturerSku === pair.replica)!
      const authentic = productFixtures.find((item) => item.manufacturerSku === pair.authentic)!
      expect(replica.id, pair.replica).not.toBe(authentic.id)
      expect(pair.replica).not.toBe(pair.authentic)
      for (const product of [replica, authentic]) {
        expect(product.clubId).toBe(pair.club)
        expect(product.season).toBe('2025/26')
        expect(product.kitType).toBe('home')
      }
      expect(replica.authenticity).toBe('replica')
      expect(authentic.authenticity).toBe('authentic')
    }
  })

  it('★確認時点の価格・在庫を商品データへ入れていない★', () => {
    const ids = new Set<string>(
      CONFIRMED.map((checked) => checked.id).filter((id) => !SAMPLE_LISTINGS_REMAIN.has(id)),
    )
    expect(listingFixtures.filter((listing) => ids.has(listing.productId))).toEqual([])
  })

  it('★仮のJAN/EANや公式画像を入れていない★', () => {
    for (const checked of CONFIRMED) {
      const product = productFixtures.find((item) => item.id === checked.id)!
      expect(product.jan).toBeNull()
      expect(product.ean).toBeNull()
      expect(product.image.source).toBe('placeholder')
    }
  })

  /*
   * ★公式確認済みの商品に、開発用のダミーを混ぜない。★
   *   ここで見るのは確認済みの商品だけです。
   *   ほかの商品（まだ実データ化していないもの）には、
   *   開発用のサンプル掲載が残っていて構いません。
   */
  it('★確認済み商品に、ダミーのURL・販売元・コードが無い★', () => {
    const sampleStores = new Set(
      storeFixtures.filter((store) => /sample/i.test(store.slug)).map((store) => store.id),
    )
    for (const checked of CONFIRMED) {
      const product = productFixtures.find((item) => item.id === checked.id)!
      const listings = SAMPLE_LISTINGS_REMAIN.has(checked.id)
        ? [] // 掲載の実データ化はこれからの商品（上の SAMPLE_LISTINGS_REMAIN を参照）
        : listingFixtures.filter((listing) => listing.productId === product.id)
      for (const listing of listings) {
        expect(listing.externalUrl, `${checked.sku}: ダミーURL`).not.toMatch(/example\.(com|org|net)/)
        expect(sampleStores.has(listing.storeId), `${checked.sku}: サンプル販売元`).toBe(false)
      }
      // 「20」で始まる13桁は店舗内管理用の予約番号（実在商品には付かない）
      for (const code of [product.jan, product.ean]) {
        if (code) expect(code, `${checked.sku}: 仮コード`).not.toMatch(/^20\d{11}$/)
      }
      expect(product.manufacturerSku, `${checked.sku}: 仮の品番`).not.toMatch(/^SAMPLE/i)
    }
  })
})

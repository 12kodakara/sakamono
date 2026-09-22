/**
 * 人手で公式情報を確認した商品のテスト。
 *
 * 記録: docs/data-sources/manual-official-checks.md
 *
 * ★公式表示と一致することを確認した値が、あとの編集で変わっていないかを守ります。★
 *   変えるときは、先に公式情報を確認し直して記録を更新してください。
 */

import { describe, expect, it } from 'vitest'
import { listingFixtures, productFixtures } from '@/data/fixtures'

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
] as const

describe('★人手で公式確認した商品★', () => {
  for (const checked of CONFIRMED) {
    it(`${checked.sku} は公式表示と一致する値のまま`, () => {
      const products = productFixtures.filter((product) => product.manufacturerSku === checked.sku)
      // 品番は1商品だけを指す
      expect(products).toHaveLength(1)
      const [product] = products
      const { sku: _sku, ...expected } = checked
      expect(product).toMatchObject({ ...expected, category: 'kits' })
    })
  }

  it('★確認時点の価格・在庫を商品データへ入れていない★', () => {
    const ids = new Set<string>(CONFIRMED.map((checked) => checked.id))
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
})

/**
 * 商品ページの「買いに行く先」（src/lib/purchaseLink.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・押しても買えないリンク（example.com などの予約ドメイン）をボタンにしない
 *   ・商品ページURLが分からないときは、そのことを隠さずに書く
 *   ・行き先が無いときは、あるように見せない
 *   ・URLを組み立てて「商品ページ」のふりをさせない
 *   ・外部へ出るボタンは1商品ページに1つだけ
 */

import { describe, expect, it } from 'vitest'
import { buildPurchaseLink, isRealStoreUrl } from '@/lib/purchaseLink'
import { listProductViews } from '@/data/repository'

describe('買える URL かどうかの判定', () => {
  it('★予約ドメイン（example.com など）は買える先として扱わない★', () => {
    // 仕様書・サンプル用に予約されたドメインなので、実在の店ではない
    expect(isRealStoreUrl('https://example.com/sample-listing/abc')).toBe(false)
    expect(isRealStoreUrl('https://example.org/x')).toBe(false)
    expect(isRealStoreUrl('https://example.net/x')).toBe(false)
    expect(isRealStoreUrl('https://shop.example.com/x')).toBe(false)
  })

  it('https の実在ドメインは買える先として扱う', () => {
    expect(isRealStoreUrl('https://store.liverpoolfc.com/')).toBe(true)
    expect(isRealStoreUrl('https://www.psvfanstore.nl/')).toBe(true)
  })

  it('http・空・壊れたURLは扱わない', () => {
    expect(isRealStoreUrl('http://store.liverpoolfc.com/')).toBe(false)
    expect(isRealStoreUrl('')).toBe(false)
    expect(isRealStoreUrl(null)).toBe(false)
    expect(isRealStoreUrl('store.liverpoolfc.com')).toBe(false)
  })
})

describe('行き先の決め方', () => {
  const base = {
    clubNameJa: 'リヴァプール',
    officialStoreUrl: 'https://store.liverpoolfc.com/',
    listingUrl: null,
    listingStoreName: null,
    productCode: 'JV6423',
  }

  it('本物の商品URLがあれば、そこへ送る', () => {
    const link = buildPurchaseLink({
      ...base,
      listingUrl: 'https://store.liverpoolfc.com/products/xyz',
      listingStoreName: 'Liverpool FC Official Store',
    })
    expect(link.kind).toBe('listing')
    expect(link.href).toBe('https://store.liverpoolfc.com/products/xyz')
    expect(link.label).toBe('Liverpool FC Official Storeで見る')
    // 商品ページへ直接行けるので、断り書きは要らない
    expect(link.note).toBeNull()
  })

  it('★サンプルURLのときは、そこへ送らず公式ストアへ送る★', () => {
    const link = buildPurchaseLink({
      ...base,
      listingUrl: 'https://example.com/sample-listing/lfc-2526-h-r',
      listingStoreName: 'Liverpool FC Official Store',
    })
    expect(link.kind).toBe('official-store')
    expect(link.href).toBe('https://store.liverpoolfc.com/')
    expect(link.href).not.toContain('example.com')
  })

  it('公式ストアへ送るときは、商品ページURLが未確認だと書く', () => {
    const link = buildPurchaseLink(base)
    expect(link.kind).toBe('official-store')
    expect(link.note).toContain('確認できていません')
  })

  it('品番が分かっていれば、それで探すよう案内する', () => {
    const link = buildPurchaseLink(base)
    expect(link.note).toContain('JV6423')
  })

  it('品番が分からなければ、品番を案内しない（作らない）', () => {
    const link = buildPurchaseLink({ ...base, productCode: null })
    expect(link.note).toContain('商品名から探して')
    expect(link.note).not.toContain('品番「')
  })

  it('★行き先が無ければボタンを出さない★', () => {
    const link = buildPurchaseLink({ ...base, officialStoreUrl: null })
    expect(link.kind).toBe('none')
    expect(link.href).toBeNull()
    expect(link.label).toBeNull()
  })

  it('公式ストアURLが http なら送らない', () => {
    const link = buildPurchaseLink({ ...base, officialStoreUrl: 'http://store.liverpoolfc.com/' })
    expect(link.kind).toBe('none')
  })

  it('★URLを組み立てて商品ページのふりをさせない★', () => {
    // 品番を渡しても、行き先はストアのトップのまま（検索URLを作らない）
    const link = buildPurchaseLink(base)
    expect(link.href).toBe('https://store.liverpoolfc.com/')
    expect(link.href).not.toContain('JV6423')
    expect(link.href).not.toContain('search')
  })
})

describe('★実データ：すべての商品に、押せば行ける先が1つある★', () => {
  it('どの商品も予約ドメインへ送らない', async () => {
    for (const view of await listProductViews()) {
      const link = buildPurchaseLink({
        clubNameJa: view.club.nameJa,
        officialStoreUrl: view.club.officialStoreUrl ?? null,
        listingUrl: view.overseas?.listing.externalUrl ?? null,
        listingStoreName: view.overseas?.store.name ?? null,
        productCode: view.product.manufacturerSku,
      })
      if (link.href) expect(isRealStoreUrl(link.href), view.product.id).toBe(true)
    }
  })

  it('クラブ公式ストアが分かっている商品には、必ず行き先がある', async () => {
    for (const view of await listProductViews()) {
      const link = buildPurchaseLink({
        clubNameJa: view.club.nameJa,
        officialStoreUrl: view.club.officialStoreUrl ?? null,
        listingUrl: view.overseas?.listing.externalUrl ?? null,
        listingStoreName: view.overseas?.store.name ?? null,
        productCode: view.product.manufacturerSku,
      })
      if (isRealStoreUrl(view.club.officialStoreUrl)) {
        expect(link.kind, view.product.id).not.toBe('none')
        expect(link.href, view.product.id).toBeTruthy()
      }
    }
  })

  it('★価格が無い商品にも行き先がある（外へ出る道を絶たない）★', async () => {
    const views = await listProductViews()
    const withoutPrice = views.filter(
      (view) => view.overseas === null && view.comparison.domesticPrice.reference === null,
    )
    expect(withoutPrice.length).toBeGreaterThan(0)
    for (const view of withoutPrice) {
      const link = buildPurchaseLink({
        clubNameJa: view.club.nameJa,
        officialStoreUrl: view.club.officialStoreUrl ?? null,
        listingUrl: null,
        listingStoreName: null,
        productCode: view.product.manufacturerSku,
      })
      expect(link.kind, view.product.id).toBe('official-store')
    }
  })
})

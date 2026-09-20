/**
 * 国内比較価格の選び方のテスト。
 *
 * ★単純な最安値を採用しないこと★
 * ★レプリカ／オーセンティックを取り違えないこと★
 * を重点的に確かめる。
 */

import { describe, expect, it } from 'vitest'
import type { DomesticMatch, Product, Store, StoreListing } from '@/domain/types'
import {
  evaluateDomesticOffer,
  summarizeDomesticPrice,
  type DomesticOfferCandidate,
} from '@/domain/services/domesticPrice'
import { checkVariantCompatibility } from '@/domain/services/variantMatch'
import type { ShippingResolution } from '@/domain/services/shipping'
import { CONFIDENCE_BY_METHOD, toConfidenceGrade } from '@/lib/matching/confidence'

/* ------------------------------------------------------------
 * テスト用のデータ作り
 * ---------------------------------------------------------- */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-base',
    clubId: 'club-real-madrid',
    slug: 'real-madrid-2025-26-home-replica',
    name: 'Test Shirt',
    nameJa: 'テストシャツ',
    season: '2025/26',
    manufacturer: 'adidas',
    manufacturerSku: 'TEST-001',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    image: { src: '/x.svg', alt: 'x', width: 800, height: 800, source: 'placeholder' },
    active: true,
    ...overrides,
  }
}

function makeStore(overrides: Partial<Store> = {}): Store {
  return {
    id: 'store-jp',
    slug: 'store-jp',
    name: '国内販売店（テスト）',
    type: 'authorized',
    currency: 'JPY',
    country: '日本',
    japanShippingAvailable: true,
    shippingType: 'domestic',
    affiliateAvailable: false,
    active: true,
    ...overrides,
  }
}

function makeListing(overrides: Partial<StoreListing> = {}): StoreListing {
  return {
    id: 'listing-jp',
    productId: 'product-base',
    storeId: 'store-jp',
    externalId: 'x',
    externalUrl: 'https://example.com/x',
    currency: 'JPY',
    currentPrice: 20000,
    regularPrice: 20000,
    discountRate: 0,
    inStock: true,
    lastCheckedAt: '2026-09-18T09:00:00.000Z',
    ...overrides,
  }
}

function makeMatch(overrides: Partial<DomesticMatch> = {}): DomesticMatch {
  return {
    id: 'match-1',
    productId: 'product-base',
    storeListingId: 'listing-jp',
    confidence: CONFIDENCE_BY_METHOD.ean,
    matchMethod: 'ean',
    reviewed: false,
    createdAt: '2026-09-18T09:00:00.000Z',
    ...overrides,
  }
}

const freeShipping: ShippingResolution = {
  amountJpy: 0,
  status: 'free',
  isEstimate: false,
  note: '',
  rule: null,
}

const unknownShipping: ShippingResolution = {
  amountJpy: null,
  status: 'unknown',
  isEstimate: false,
  note: '',
  rule: null,
}

function makeCandidate(overrides: Partial<DomesticOfferCandidate> = {}): DomesticOfferCandidate {
  const match = overrides.match ?? makeMatch()
  const listing = overrides.listing ?? makeListing()
  return {
    listing,
    store: overrides.store ?? makeStore(),
    match,
    product: overrides.product !== undefined ? overrides.product : makeProduct(),
    shipping: overrides.shipping ?? freeShipping,
    itemPriceJpy: overrides.itemPriceJpy ?? listing.currentPrice,
    grade: overrides.grade ?? toConfidenceGrade(match.confidence),
  }
}

/* ------------------------------------------------------------
 * バリエーション照合
 * ---------------------------------------------------------- */

describe('バリエーションの照合', () => {
  it('同じ商品レコードなら比較してよい', () => {
    const product = makeProduct()
    expect(checkVariantCompatibility(product, product).compatible).toBe(true)
  })

  it('★レプリカとオーセンティックを取り違えない★', () => {
    const replica = makeProduct({ id: 'p-replica', authenticity: 'replica' })
    const authentic = makeProduct({ id: 'p-authentic', authenticity: 'authentic' })

    const result = checkVariantCompatibility(authentic, replica)
    expect(result.compatible).toBe(false)
    expect(result.mismatches).toContain('authenticity')
  })

  it('シーズン違いを取り違えない', () => {
    const a = makeProduct({ id: 'p-a', season: '2025/26' })
    const b = makeProduct({ id: 'p-b', season: '2024/25' })
    expect(checkVariantCompatibility(a, b).mismatches).toContain('season')
  })

  it('対象（メンズ／ウィメンズ）違いを取り違えない', () => {
    const a = makeProduct({ id: 'p-a', gender: 'men' })
    const b = makeProduct({ id: 'p-b', gender: 'women' })
    expect(checkVariantCompatibility(a, b).mismatches).toContain('gender')
  })

  it('袖丈違いを取り違えない', () => {
    const a = makeProduct({ id: 'p-a', sleeve: 'short' })
    const b = makeProduct({ id: 'p-b', sleeve: 'long' })
    expect(checkVariantCompatibility(a, b).mismatches).toContain('sleeve')
  })

  it('選手名入りと無地を取り違えない', () => {
    const plain = makeProduct({ id: 'p-a', player: null })
    const named = makeProduct({ id: 'p-b', player: 'Salah' })
    expect(checkVariantCompatibility(plain, named).mismatches).toContain('player')
  })

  it('片方が未記録の項目は、食い違いとして扱わない', () => {
    const known = makeProduct({ id: 'p-a', sleeve: 'short' })
    const unknown = makeProduct({ id: 'p-b', sleeve: null })
    expect(checkVariantCompatibility(known, unknown).mismatches).not.toContain('sleeve')
  })
})

/* ------------------------------------------------------------
 * 候補の審査
 * ---------------------------------------------------------- */

describe('国内候補の審査', () => {
  const product = makeProduct()

  it('条件を満たせば除外理由なし', () => {
    const result = evaluateDomesticOffer(makeCandidate(), product)
    expect(result.reasons).toEqual([])
  })

  it('★信頼度が足りなければ除外する★', () => {
    const candidate = makeCandidate({
      match: makeMatch({
        confidence: CONFIDENCE_BY_METHOD.attributes,
        matchMethod: 'attributes',
        reviewed: false,
      }),
    })
    expect(evaluateDomesticOffer(candidate, product).reasons).toContain('low-confidence')
  })

  it('人が確認済みなら信頼度が低くても使える', () => {
    const candidate = makeCandidate({
      match: makeMatch({
        confidence: CONFIDENCE_BY_METHOD.attributes,
        matchMethod: 'attributes',
        reviewed: true,
      }),
    })
    expect(evaluateDomesticOffer(candidate, product).reasons).not.toContain('low-confidence')
  })

  it('在庫切れは除外する', () => {
    const candidate = makeCandidate({ listing: makeListing({ inStock: false }) })
    expect(evaluateDomesticOffer(candidate, product).reasons).toContain('out-of-stock')
  })

  it('★モール型で人の確認が無ければ除外する★', () => {
    const candidate = makeCandidate({
      store: makeStore({ type: 'marketplace' }),
      match: makeMatch({ reviewed: false }),
    })
    expect(evaluateDomesticOffer(candidate, product).reasons).toContain('untrusted-store')
  })

  it('モール型でも人が確認済みなら使える', () => {
    const candidate = makeCandidate({
      store: makeStore({ type: 'marketplace' }),
      match: makeMatch({ reviewed: true }),
    })
    expect(evaluateDomesticOffer(candidate, product).reasons).not.toContain('untrusted-store')
  })

  it('国内送料が分からなければ除外する', () => {
    const candidate = makeCandidate({ shipping: unknownShipping })
    expect(evaluateDomesticOffer(candidate, product).reasons).toContain('shipping-unknown')
  })

  it('★信頼度が高くてもバリエーションが違えば除外する★', () => {
    const authentic = makeProduct({ id: 'p-authentic', authenticity: 'authentic' })
    const candidate = makeCandidate({
      product: makeProduct({ id: 'p-replica', authenticity: 'replica' }),
      match: makeMatch({ confidence: CONFIDENCE_BY_METHOD.ean, reviewed: true }),
    })

    const result = evaluateDomesticOffer(candidate, authentic)
    expect(result.reasons).toContain('variant-mismatch')
    expect(result.variantMismatches).toContain('authenticity')
  })
})

/* ------------------------------------------------------------
 * まとめ
 * ---------------------------------------------------------- */

describe('国内比較価格の選択', () => {
  const product = makeProduct()

  it('審査を通ったものの中で、送料込み総額が最安のものを採用する', () => {
    const summary = summarizeDomesticPrice(
      [
        makeCandidate({
          listing: makeListing({ id: 'l-1', currentPrice: 22000 }),
          match: makeMatch({ id: 'm-1', storeListingId: 'l-1' }),
          itemPriceJpy: 22000,
        }),
        makeCandidate({
          listing: makeListing({ id: 'l-2', currentPrice: 19800 }),
          match: makeMatch({ id: 'm-2', storeListingId: 'l-2' }),
          itemPriceJpy: 19800,
        }),
      ],
      product,
    )

    expect(summary.referencePriceJpy).toBe(19800)
    expect(summary.lowestPriceJpy).toBe(19800)
    expect(summary.offerCount).toBe(2)
    expect(summary.confidence).toBe('A')
  })

  it('国内送料を含めた総額で比べる', () => {
    const summary = summarizeDomesticPrice(
      [
        makeCandidate({
          listing: makeListing({ id: 'l-1', currentPrice: 19800 }),
          match: makeMatch({ id: 'm-1', storeListingId: 'l-1' }),
          itemPriceJpy: 19800,
          shipping: { amountJpy: 660, status: 'fixed', isEstimate: false, note: '', rule: null },
        }),
      ],
      product,
    )

    expect(summary.referenceItemPriceJpy).toBe(19800)
    expect(summary.referenceShippingJpy).toBe(660)
    expect(summary.referencePriceJpy).toBe(20460)
  })

  it('★極端に安いモール出品は採用しない★', () => {
    const summary = summarizeDomesticPrice(
      [
        // 怪しく安いフリマ出品（人の確認なし）
        makeCandidate({
          store: makeStore({ id: 'store-flea', type: 'marketplace' }),
          listing: makeListing({ id: 'l-flea', currentPrice: 9800 }),
          match: makeMatch({ id: 'm-flea', storeListingId: 'l-flea', reviewed: false }),
          itemPriceJpy: 9800,
        }),
        // 正規取扱店
        makeCandidate({
          listing: makeListing({ id: 'l-shop', currentPrice: 21800 }),
          match: makeMatch({ id: 'm-shop', storeListingId: 'l-shop', reviewed: true }),
          itemPriceJpy: 21800,
        }),
      ],
      product,
    )

    expect(summary.referencePriceJpy).toBe(21800)
    expect(summary.offerCount).toBe(1)
    expect(summary.examinedCount).toBe(2)
    expect(summary.excluded[0].reasons).toContain('untrusted-store')
  })

  it('中央値を求められる', () => {
    const prices = [18000, 20000, 22000]
    const summary = summarizeDomesticPrice(
      prices.map((price, index) =>
        makeCandidate({
          listing: makeListing({ id: `l-${index}`, currentPrice: price }),
          match: makeMatch({ id: `m-${index}`, storeListingId: `l-${index}` }),
          itemPriceJpy: price,
        }),
      ),
      product,
    )

    expect(summary.medianPriceJpy).toBe(20000)
  })

  it('採用できるものが1件も無ければ null を返す（0円にしない）', () => {
    const summary = summarizeDomesticPrice(
      [makeCandidate({ listing: makeListing({ inStock: false }) })],
      product,
    )

    expect(summary.referencePriceJpy).toBeNull()
    expect(summary.lowestPriceJpy).toBeNull()
    expect(summary.medianPriceJpy).toBeNull()
    expect(summary.confidence).toBeNull()
    expect(summary.offerCount).toBe(0)
  })
})

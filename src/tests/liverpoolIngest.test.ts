/**
 * Liverpool 取り込みパイプラインのテスト。
 *
 * 生データの検証 → 正規化 → Product / StoreListing / Variant / PriceSnapshot
 * までを確かめる。
 *
 * ★失敗時に0円の商品を作らないこと★ を特に重点的に見る。
 */

import { describe, expect, it } from 'vitest'
import { validateRawFeed, validateRawProduct } from '@/data/external/liverpool/rawSchema'
import {
  deriveStockStatus,
  normalizeLiverpoolProducts,
} from '@/data/external/liverpool/normalize'
import { runIngestion, measureCoverage } from '@/data/external/liverpool/ingest'
import {
  FileRawSource,
  InMemoryRawSource,
  createHttpRawSource,
} from '@/data/external/liverpool/rawSource'
import { IngestionError, mustStopOnError } from '@/data/external/liverpool/errors'
import { isFresh } from '@/data/external/liverpool/cache'
import { liverpoolSampleFeed } from '@/data/external/liverpool/sampleRaw'
import type { LiverpoolRawProduct } from '@/data/external/liverpool/types'
import { validateProduct, validateProductVariant, validateStoreListing } from '@/domain/validation'

/* ------------------------------------------------------------
 * テスト用のデータ作り
 * ---------------------------------------------------------- */

function makeRaw(overrides: Partial<LiverpoolRawProduct> = {}): LiverpoolRawProduct {
  return {
    externalId: 'TEST-0001',
    title: 'Sample LFC 25/26 Home Replica Shirt - Mens',
    url: 'https://example.com/sample-liverpool/test-0001',
    currency: 'GBP',
    currentPrice: 64.95,
    regularPrice: 84.95,
    sku: 'TEST-SKU-0001',
    ean: '2000000001001',
    imageUrl: 'https://example.com/img/0001.jpg',
    variants: [
      { externalId: 'v1', size: 'M', sku: 'TEST-SKU-0001-M', ean: null, available: true },
    ],
    fetchedAt: '2026-09-19T00:00:00.000Z',
    ...overrides,
  }
}

function normalizeOne(overrides: Partial<LiverpoolRawProduct> = {}) {
  return normalizeLiverpoolProducts([makeRaw(overrides)])
}

/* ============================================================
 * 生データの検証
 * ========================================================== */

describe('生データの検証', () => {
  it('正しい商品は通る', () => {
    const result = validateRawProduct(makeRaw())
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('オブジェクトでないものを弾く', () => {
    expect(validateRawProduct(null).valid).toBe(false)
    expect(validateRawProduct('shirt').valid).toBe(false)
  })

  it('★現在価格が無ければ取り込まない（0円にしない）★', () => {
    const result = validateRawProduct(makeRaw({ currentPrice: null }))
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.kind === 'invalid-price')).toBe(true)
  })

  it('マイナスの価格を弾く', () => {
    expect(validateRawProduct(makeRaw({ currentPrice: -1 })).valid).toBe(false)
    expect(validateRawProduct(makeRaw({ regularPrice: -1 })).valid).toBe(false)
  })

  it('通貨が無ければ取り込まない', () => {
    expect(validateRawProduct(makeRaw({ currency: null })).valid).toBe(false)
  })

  it('URLが https でなければ弾く', () => {
    expect(validateRawProduct(makeRaw({ url: 'http://example.com/x' })).valid).toBe(false)
  })

  it('型が違う項目を弾く（想定外のスキーマ）', () => {
    const broken = { ...makeRaw(), sku: 123 }
    const result = validateRawProduct(broken)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.kind === 'unexpected-schema')).toBe(true)
  })

  it('通常価格が無い場合は警告にとどめて取り込む', () => {
    const result = validateRawProduct(makeRaw({ regularPrice: null }))
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.message.includes('通常価格'))).toBe(true)
  })

  it('SKU・EAN・バリエーションが無い場合も警告にとどめる', () => {
    const result = validateRawProduct(makeRaw({ sku: null, ean: null, variants: [] }))
    expect(result.valid).toBe(true)
    expect(result.warnings.length).toBeGreaterThanOrEqual(3)
  })

  it('★在庫が取れていない variant は警告を出す（在庫ありにしない）★', () => {
    const result = validateRawProduct(
      makeRaw({
        variants: [{ externalId: 'v1', size: 'M', sku: null, ean: null, available: null }],
      }),
    )
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.message.includes('在庫'))).toBe(true)
  })

  it('フィード全体の検証では、壊れた商品だけを落として続行する', () => {
    const result = validateRawFeed({
      origin: 'sample',
      sourceNote: 'テスト',
      fetchedAt: '2026-09-19T00:00:00.000Z',
      products: [makeRaw(), makeRaw({ externalId: 'BAD', currentPrice: null })],
    })

    expect(result.validProducts).toHaveLength(1)
    expect(result.rejectedCount).toBe(1)
  })

  it('入手経路の記録が無いフィードを弾く', () => {
    const result = validateRawFeed({
      origin: 'mystery',
      sourceNote: '',
      fetchedAt: '2026-09-19T00:00:00.000Z',
      products: [],
    })
    expect(result.errors.some((e) => e.message.includes('origin'))).toBe(true)
    expect(result.errors.some((e) => e.message.includes('sourceNote'))).toBe(true)
  })
})

/* ============================================================
 * 正規化
 * ========================================================== */

describe('正規化: Product', () => {
  it('Product を作れて、既存の検証も通る', () => {
    const { products } = normalizeOne()
    expect(products).toHaveLength(1)
    expect(validateProduct(products[0])).toEqual([])
  })

  it('分かる属性を埋める', () => {
    const { products } = normalizeOne()
    const product = products[0]

    expect(product.clubId).toBe('club-liverpool')
    expect(product.season).toBe('2025/26')
    expect(product.category).toBe('kits')
    expect(product.kitType).toBe('home')
    expect(product.authenticity).toBe('replica')
    expect(product.gender).toBe('men')
    expect(product.manufacturerSku).toBe('TEST-SKU-0001')
    expect(product.ean).toBe('2000000001001')
  })

  it('★メーカー名を推測しない★', () => {
    // 取得元にメーカーの項目が無いため「Nike」と決めつけない
    const { products } = normalizeOne()
    expect(products[0].manufacturer).toBe('確認中')
  })

  it('★シーズンが分からなければ null のまま★', () => {
    const { products } = normalizeOne({ title: 'Sample LFC Home Replica Shirt' })
    expect(products[0].season).toBeNull()
    expect(validateProduct(products[0])).toEqual([])
  })

  it('★Replica / Authentic が分からなければ unknown★', () => {
    const { products } = normalizeOne({ title: 'Sample LFC 25/26 Home Shirt' })
    expect(products[0].authenticity).toBe('unknown')
  })

  it('Authentic を Replica と取り違えない', () => {
    const { products } = normalizeOne({ title: 'Sample LFC 25/26 Home Authentic Shirt - Mens' })
    expect(products[0].authenticity).toBe('authentic')
  })

  it('★画像URLは記録するが表示には使わない★', () => {
    const { products } = normalizeOne()
    expect(products[0].image.source).toBe('placeholder')
    expect(products[0].image.src.startsWith('/images/')).toBe(true)
    expect(products[0].image.sourceUrl).toBe('https://example.com/img/0001.jpg')
  })

  it('SKUが無ければ null', () => {
    const { products } = normalizeOne({ sku: null })
    expect(products[0].manufacturerSku).toBeNull()
  })

  it('slug が重複しない', () => {
    const data = normalizeLiverpoolProducts([
      makeRaw({ externalId: 'A', url: 'https://example.com/p/a' }),
      makeRaw({ externalId: 'B', url: 'https://example.com/p/b' }),
    ])
    const slugs = data.products.map((p) => p.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('同じ商品が2回入っていたら1件にする', () => {
    const data = normalizeLiverpoolProducts([makeRaw(), makeRaw()])
    expect(data.products).toHaveLength(1)
    expect(data.issues.some((i) => i.message.includes('2回'))).toBe(true)
  })
})

describe('正規化: StoreListing', () => {
  it('StoreListing を作れて、既存の検証も通る', () => {
    const { listings } = normalizeOne()
    expect(listings).toHaveLength(1)
    expect(validateStoreListing(listings[0])).toEqual([])
  })

  it('セール価格と通常価格を区別する', () => {
    const { listings } = normalizeOne()
    expect(listings[0].currentPrice).toBe(64.95)
    expect(listings[0].regularPrice).toBe(84.95)
    expect(listings[0].discountRate).toBeGreaterThan(0)
  })

  it('★通常価格が無い場合、セールを作り出さない★', () => {
    const { listings } = normalizeOne({ regularPrice: null })
    expect(listings[0].regularPrice).toBe(listings[0].currentPrice)
    expect(listings[0].discountRate).toBe(0)
  })

  it('★値上げ（通常価格 < 現在価格）をセール扱いしない★', () => {
    const { listings, issues } = normalizeOne({ regularPrice: 50, currentPrice: 64.95 })
    expect(listings[0].discountRate).toBe(0)
    expect(listings[0].regularPrice).toBe(64.95)
    expect(issues.some((i) => i.kind === 'invalid-price')).toBe(true)
  })

  it('取得元の通貨をそのまま保持する', () => {
    expect(normalizeOne({ currency: 'GBP' }).listings[0].currency).toBe('GBP')
    // 日本向けストアが円で返してきた場合もその事実を残す
    expect(normalizeOne({ currency: 'JPY', currentPrice: 12800, regularPrice: 12800 }).listings[0].currency).toBe('JPY')
  })

  it('対応していない通貨は取り込まない', () => {
    const data = normalizeLiverpoolProducts([makeRaw({ currency: 'CHF' })])
    expect(data.listings).toHaveLength(0)
    expect(data.issues.some((i) => i.message.includes('対応していない通貨'))).toBe(true)
  })

  it('URLからトラッキングパラメータを取り除く', () => {
    const { listings } = normalizeOne({ url: 'https://example.com/p/x?utm_source=mail' })
    expect(listings[0].externalUrl).toBe('https://example.com/p/x')
  })
})

describe('正規化: 在庫とバリエーション', () => {
  it('バリエーションを作れて、既存の検証も通る', () => {
    const { variants } = normalizeOne()
    expect(variants).toHaveLength(1)
    expect(variants[0].size).toBe('M')
    expect(variants[0].sku).toBe('TEST-SKU-0001-M')
    expect(variants[0].availability).toBe('available')
    expect(validateProductVariant(variants[0])).toEqual([])
  })

  it('★在庫が取れていない variant は unknown（在庫ありにしない）★', () => {
    const { variants } = normalizeOne({
      variants: [{ externalId: 'v1', size: 'M', sku: null, ean: null, available: null }],
    })
    expect(variants[0].availability).toBe('unknown')
  })

  it('1サイズでも在庫があれば available', () => {
    expect(
      deriveStockStatus([
        { id: '1', storeListingId: 'l', size: 'S', sku: null, ean: null, jan: null, availability: 'unavailable' },
        { id: '2', storeListingId: 'l', size: 'M', sku: null, ean: null, jan: null, availability: 'available' },
      ]),
    ).toBe('available')
  })

  it('全サイズ売り切れなら unavailable', () => {
    expect(
      deriveStockStatus([
        { id: '1', storeListingId: 'l', size: 'S', sku: null, ean: null, jan: null, availability: 'unavailable' },
        { id: '2', storeListingId: 'l', size: 'M', sku: null, ean: null, jan: null, availability: 'unavailable' },
      ]),
    ).toBe('unavailable')
  })

  it('★サイズ情報が無ければ unknown（在庫ありにしない）★', () => {
    expect(deriveStockStatus([])).toBe('unknown')

    const { listings } = normalizeOne({ variants: [] })
    expect(listings[0].stockStatus).toBe('unknown')
    expect(listings[0].inStock).toBe(false)
  })

  it('全サイズ不明なら unknown', () => {
    expect(
      deriveStockStatus([
        { id: '1', storeListingId: 'l', size: 'S', sku: null, ean: null, jan: null, availability: 'unknown' },
      ]),
    ).toBe('unknown')
  })
})

describe('正規化: PriceSnapshot', () => {
  it('取得時点の価格を履歴として残す', () => {
    const { snapshots } = normalizeOne()
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].price).toBe(64.95)
    expect(snapshots[0].currency).toBe('GBP')
    expect(snapshots[0].recordedAt).toBe('2026-09-19T00:00:00.000Z')
  })

  it('掲載と結び付いている', () => {
    const { snapshots, listings } = normalizeOne()
    expect(snapshots[0].storeListingId).toBe(listings[0].id)
  })
})

/* ============================================================
 * 取得元とエラー処理
 * ========================================================== */

describe('取得元', () => {
  it('★公式サイトからの自動取得は実装していない（呼ぶと止まる）★', () => {
    expect(() => createHttpRawSource()).toThrow(IngestionError)
    try {
      createHttpRawSource()
    } catch (error) {
      expect(error).toBeInstanceOf(IngestionError)
      expect((error as IngestionError).kind).toBe('blocked')
      expect((error as IngestionError).message).toContain('利用規約')
    }
  })

  it('blocked は再試行してはいけない種類として扱う', () => {
    expect(mustStopOnError('blocked')).toBe(true)
    expect(mustStopOnError('network')).toBe(false)
    expect(mustStopOnError('timeout')).toBe(false)
  })

  it('ファイルが見つからない場合は source-missing として失敗する', async () => {
    const source = new FileRawSource('external/liverpool/__does_not_exist__.json')
    await expect(source.load()).rejects.toThrow(IngestionError)
    await source.load().catch((error: IngestionError) => {
      expect(error.kind).toBe('source-missing')
    })
  })

  it('壊れたJSONは parse エラーになる', async () => {
    const { mkdir, writeFile, rm } = await import('node:fs/promises')
    await mkdir('.cache/test', { recursive: true })
    const path = '.cache/test/broken.json'
    await writeFile(path, '{ this is not json', 'utf8')

    const source = new FileRawSource(path)
    await source.load().catch((error: IngestionError) => {
      expect(error.kind).toBe('parse')
    })

    await rm(path, { force: true })
  })
})

describe('キャッシュ', () => {
  const entry = { storedAt: '2026-09-19T00:00:00.000Z', ttlMs: 3600_000, note: '', payload: 1 }

  it('期限内なら有効', () => {
    expect(isFresh(entry, new Date('2026-09-19T00:30:00.000Z'))).toBe(true)
  })

  it('期限を過ぎたら無効', () => {
    expect(isFresh(entry, new Date('2026-09-19T02:00:00.000Z'))).toBe(false)
  })

  it('保存日時が壊れていたら無効', () => {
    expect(isFresh({ ...entry, storedAt: 'broken' })).toBe(false)
  })
})

/* ============================================================
 * 取り込み全体
 * ========================================================== */

describe('取り込み全体（サンプルデータ）', () => {
  it('サンプルはサンプルとして印が付く', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))
    expect(result.file.isSampleData).toBe(true)
    expect(result.file.origin).toBe('sample')
  })

  it('10件すべてを取り込める', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))
    expect(result.fetchedCount).toBe(10)
    expect(result.validCount).toBe(10)
    expect(result.rejectedCount).toBe(0)
    expect(result.normalized.products).toHaveLength(10)
    expect(result.normalized.listings).toHaveLength(10)
    expect(result.normalized.snapshots).toHaveLength(10)
  })

  it('--limit 相当の件数制限が効く', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed), { limit: 3 })
    expect(result.fetchedCount).toBe(3)
    expect(result.normalized.products).toHaveLength(3)
  })

  it('取得状況を集計できる', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))
    const coverage = result.coverage

    expect(coverage.total).toBe(10)
    expect(coverage.price.rate).toBe(1)
    // わざと欠けさせた項目が、欠けたものとして数えられている
    expect(coverage.regularPrice.rate).toBeLessThan(1)
    expect(coverage.sku.rate).toBeLessThan(1)
    expect(coverage.ean.rate).toBeLessThan(1)
    expect(coverage.variants.rate).toBeLessThan(1)
  })

  it('生成したデータが既存の検証をすべて通る', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))

    for (const product of result.normalized.products) {
      expect(validateProduct(product)).toEqual([])
    }
    for (const listing of result.normalized.listings) {
      expect(validateStoreListing(listing)).toEqual([])
    }
    for (const variant of result.normalized.variants) {
      expect(validateProductVariant(variant)).toEqual([])
    }
  })

  it('★0円の商品が1つも生成されない★', async () => {
    const result = await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))
    for (const listing of result.normalized.listings) {
      expect(listing.currentPrice).toBeGreaterThan(0)
      expect(listing.regularPrice).toBeGreaterThan(0)
    }
  })

  it('フィードの形が壊れていれば止まる', async () => {
    const broken = new InMemoryRawSource({
      origin: 'sample',
      sourceNote: '',
      fetchedAt: 'broken',
      products: [],
    })
    await expect(runIngestion(broken)).rejects.toThrow(IngestionError)
  })

  it('取得状況の集計は生データ0件でも壊れない', () => {
    const coverage = measureCoverage([], {
      products: [],
      listings: [],
      variants: [],
      snapshots: [],
      issues: [],
    })
    expect(coverage.total).toBe(0)
    expect(coverage.price.rate).toBe(0)
  })
})

/* ============================================================
 * fixture を壊していないこと
 * ========================================================== */

describe('fixture との分離', () => {
  it('★取り込み結果が fixture を汚さない★', async () => {
    const { fixtureDataset } = await import('@/data/fixtures')
    const before = fixtureDataset.products.length

    await runIngestion(new InMemoryRawSource(liverpoolSampleFeed))

    const { fixtureDataset: after } = await import('@/data/fixtures')
    expect(after.products.length).toBe(before)
    // 取り込んだ商品のIDは fixture に存在しない
    expect(after.products.some((p) => p.id.startsWith('product-lfc-ext-'))).toBe(false)
  })
})

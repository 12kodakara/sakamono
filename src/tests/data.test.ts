/**
 * データ・slug・信頼度のテスト。
 *
 * fixture を足したり直したりしたときに、
 * 形の崩れや参照の食い違いをすぐ見つけられるようにしておく。
 *
 * 実行方法:  npm test
 */

import { describe, expect, it } from 'vitest'
import { fixtureDataset } from '@/data/fixtures'
import { leagueFixtures } from '@/data/fixtures/leagues'
import { clubFixtures } from '@/data/fixtures/clubs'
import { productFixtures } from '@/data/fixtures/products'
import { validateDataset, validateProduct } from '@/domain/validation'
import type { Product } from '@/domain/types'
import { buildProductSlug, isValidSlug, toSlug } from '@/lib/slug'
import {
  COMPARABLE_MIN_CONFIDENCE,
  CONFIDENCE_BY_METHOD,
  CONFIDENCE_THRESHOLDS,
  isComparable,
  toConfidenceLevel,
} from '@/lib/matching/confidence'

describe('slug', () => {
  it('正しい形式だけを受け入れる', () => {
    expect(isValidSlug('liverpool')).toBe(true)
    expect(isValidSlug('liverpool-2025-26-home-replica')).toBe(true)

    expect(isValidSlug('Liverpool')).toBe(false) // 大文字
    expect(isValidSlug('liverpool_fc')).toBe(false) // アンダースコア
    expect(isValidSlug('-liverpool')).toBe(false) // 先頭のハイフン
    expect(isValidSlug('liverpool-')).toBe(false) // 末尾のハイフン
    expect(isValidSlug('liver--pool')).toBe(false) // 連続ハイフン
    expect(isValidSlug('')).toBe(false)
    expect(isValidSlug('リヴァプール')).toBe(false) // 日本語
  })

  it('文字列から slug を作れる', () => {
    expect(toSlug('Tottenham Hotspur')).toBe('tottenham-hotspur')
    expect(toSlug('  FC   Barcelona  ')).toBe('fc-barcelona')
    expect(toSlug('Atlético Madrid')).toBe('atletico-madrid') // 発音記号を落とす
    expect(toSlug('2025/26 Home')).toBe('2025-26-home')
  })

  it('作った slug は必ず正しい形式になる', () => {
    const inputs = ['Real Madrid CF', '---', 'A & B', 'Ligue 1 (France)', 'Über Kit!!']
    for (const input of inputs) {
      const slug = toSlug(input)
      if (slug !== '') expect(isValidSlug(slug)).toBe(true)
    }
  })

  it('商品 slug を組み立てられる', () => {
    expect(buildProductSlug('liverpool', '2025/26', 'home replica')).toBe(
      'liverpool-2025-26-home-replica',
    )
  })
})

describe('商品データの検証', () => {
  /** テスト用の正しい商品データ。必要な項目だけ上書きして使う。 */
  function makeProduct(overrides: Partial<Product> = {}): Product {
    return {
      id: 'product-test',
      clubId: 'club-liverpool',
      slug: 'liverpool-2025-26-home-replica',
      name: 'Test Shirt',
      nameJa: 'テストシャツ',
      season: '2025/26',
      manufacturer: 'Nike',
      manufacturerSku: 'TEST-001',
      jan: null,
      ean: null,
      category: 'kits',
      kitType: 'home',
      authenticity: 'replica',
      sleeve: 'short',
      gender: 'men',
      player: null,
      image: { src: '/images/x.svg', alt: 'テスト', width: 800, height: 800, source: 'placeholder' },
      active: true,
      ...overrides,
    }
  }

  it('正しい商品はエラーなし', () => {
    expect(validateProduct(makeProduct())).toEqual([])
  })

  it('slug の形式が不正なら検出する', () => {
    expect(validateProduct(makeProduct({ slug: 'Liverpool Home' })).length).toBeGreaterThan(0)
  })

  it('シーズンの書式が違えば検出する', () => {
    expect(validateProduct(makeProduct({ season: '2025-26' })).length).toBeGreaterThan(0)
    expect(validateProduct(makeProduct({ season: '2025/26' }))).toEqual([])
  })

  it('ユニフォーム以外に kitType が付いていれば検出する', () => {
    const errors = validateProduct(makeProduct({ category: 'scarves', kitType: 'home' }))
    expect(errors.length).toBeGreaterThan(0)
  })

  it('ユニフォームなのに kitType が無ければ検出する', () => {
    expect(validateProduct(makeProduct({ kitType: null })).length).toBeGreaterThan(0)
  })

  it('EAN / JAN は8桁または13桁の数字のみ受け付ける', () => {
    expect(validateProduct(makeProduct({ ean: '2000000000017' }))).toEqual([])
    expect(validateProduct(makeProduct({ jan: '20000017' }))).toEqual([])
    expect(validateProduct(makeProduct({ ean: '123' })).length).toBeGreaterThan(0)
    expect(validateProduct(makeProduct({ ean: 'ABCDEFGHIJKLM' })).length).toBeGreaterThan(0)
  })

  it('画像の代替テキストが無ければ検出する', () => {
    const product = makeProduct()
    product.image = { ...product.image, alt: '' }
    expect(validateProduct(product).length).toBeGreaterThan(0)
  })
})

describe('fixture データセット', () => {
  it('全体の検証を通る（ID重複・参照切れが無い）', () => {
    expect(validateDataset(fixtureDataset)).toEqual([])
  })

  it('対象リーグは5つで、Bundesliga を含まない', () => {
    expect(leagueFixtures).toHaveLength(5)

    const names = leagueFixtures.map((league) => league.name)
    expect(names).toEqual([
      'Premier League',
      'La Liga',
      'Serie A',
      'Ligue 1',
      'Eredivisie',
    ])
    expect(names).not.toContain('Bundesliga')
    expect(leagueFixtures.some((league) => league.slug === 'bundesliga')).toBe(false)
  })

  it('登録済みのクラブは5つ', () => {
    /*
     * MVPの4クラブに、公式一次情報で確認できた商品があるクラブを足していきます。
     * パリ・サンジェルマンは、リーグ・アンで最初に商品が入ったクラブです。
     */
    expect(clubFixtures.filter((club) => club.active)).toHaveLength(5)
    expect(clubFixtures.map((club) => club.slug).sort()).toEqual([
      'fc-barcelona',
      'liverpool',
      'paris-saint-germain',
      'real-madrid',
      'tottenham',
    ])
  })

  it('★クラブには、商品が1つ以上ある★', () => {
    /*
     * 商品の無いクラブを足すと、中身の無いクラブページができてしまいます
     * （isClubListable が false になり、sitemap にも載りません）。
     * クラブを足すときは、必ず商品と一緒に足します。
     */
    const withProducts = new Set(productFixtures.map((product) => product.clubId))
    const empty = clubFixtures.filter((club) => club.active && !withProducts.has(club.id)).map((club) => club.slug)
    expect(empty).toEqual([])
  })

  it('すべてのクラブが、存在するリーグに属している', () => {
    const leagueIds = new Set(leagueFixtures.map((league) => league.id))
    for (const club of clubFixtures) {
      expect(leagueIds.has(club.leagueId)).toBe(true)
    }
  })

  it('商品画像はすべてプレースホルダーである（権利確認前の画像を置かない）', () => {
    for (const product of fixtureDataset.products) {
      expect(product.image.source).toBe('placeholder')
    }
  })
})

describe('商品一致の信頼度', () => {
  it('境界の値で段階が切り替わる', () => {
    expect(toConfidenceLevel(1)).toBe('highest')
    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.highest)).toBe('highest')
    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.highest - 0.0001)).toBe('high')

    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.high)).toBe('high')
    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.high - 0.0001)).toBe('medium')

    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.medium)).toBe('medium')
    expect(toConfidenceLevel(CONFIDENCE_THRESHOLDS.medium - 0.0001)).toBe('review')

    expect(toConfidenceLevel(0)).toBe('review')
  })

  it('0〜1の範囲外は受け付けない', () => {
    expect(() => toConfidenceLevel(-0.1)).toThrow()
    expect(() => toConfidenceLevel(1.1)).toThrow()
  })

  it('照合手段ごとの信頼度が設計どおりの段階になる', () => {
    expect(toConfidenceLevel(CONFIDENCE_BY_METHOD.ean)).toBe('highest')
    expect(toConfidenceLevel(CONFIDENCE_BY_METHOD.jan)).toBe('highest')
    expect(toConfidenceLevel(CONFIDENCE_BY_METHOD.manual)).toBe('highest')
    expect(toConfidenceLevel(CONFIDENCE_BY_METHOD.sku)).toBe('high')
    expect(toConfidenceLevel(CONFIDENCE_BY_METHOD.attributes)).toBe('medium')
  })

  it('基準未満かつ未確認の照合は、価格差表示の対象にしない', () => {
    expect(isComparable({ confidence: CONFIDENCE_BY_METHOD.attributes, reviewed: false })).toBe(
      false,
    )
    expect(isComparable({ confidence: COMPARABLE_MIN_CONFIDENCE, reviewed: false })).toBe(true)
    expect(isComparable({ confidence: COMPARABLE_MIN_CONFIDENCE - 0.01, reviewed: false })).toBe(
      false,
    )
  })

  it('人が確認済みなら信頼度が低くても表示してよい', () => {
    expect(isComparable({ confidence: 0.1, reviewed: true })).toBe(true)
  })
})

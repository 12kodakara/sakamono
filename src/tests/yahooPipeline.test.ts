/**
 * Yahoo!ショッピング 取り込みパイプラインのテスト。
 *
 *   検索条件の組み立て → APIレスポンスの検証 → DomesticOffer →
 *   サカモノ内部モデル → 国内価格のまとめ
 *
 * 通信まわり（利用制限・再試行・タイムアウト）は fetch を差し替えて確かめます。
 * ★テスト中に外部へ通信することはありません。★
 */

import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@/domain/types'
import { isAdoptableOffer } from '@/domain/domesticOffer'
import { IngestionError, isRetryable, mustStopOnError } from '@/data/external/ingestionErrors'
import {
  buildAttributeQuery,
  buildYahooSearchPlans,
} from '@/data/external/yahoo/queryBuilder'
import {
  normalizeYahooUrl,
  validateYahooHit,
  validateYahooResponse,
} from '@/data/external/yahoo/rawSchema'
import {
  buildShippingRuleFromLabel,
  readShippingJpy,
  summarizeOffers,
  toDomesticOffers,
  toSakamonoModels,
} from '@/data/external/yahoo/normalize'
import {
  MIN_REQUEST_INTERVAL_MS,
  YahooShoppingClient,
  missingAppIdError,
  readYahooAppId,
} from '@/data/external/yahoo/client'
import { SampleSearchExecutor, runYahooSearch } from '@/data/external/yahoo/ingest'
import { yahooSampleResponse } from '@/data/external/yahoo/sampleResponse'
import { validateStore, validateStoreListing } from '@/domain/validation'

/* ------------------------------------------------------------
 * テスト用のデータ
 * ---------------------------------------------------------- */

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-test',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica',
    name: 'Liverpool FC 2025/26 Home Replica Shirt',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    manufacturer: 'Nike',
    manufacturerSku: 'JV6423',
    jan: '4999999999999',
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

const matchContext = { product: makeProduct(), clubSlug: 'liverpool', referencePriceJpy: 20000 }

function hit(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: 'リバプール 25/26 ホーム レプリカ ユニフォーム ナイキ メンズ',
    url: 'https://example.com/sample-yahoo/item-1',
    code: 'item-1',
    condition: 'new',
    inStock: true,
    price: 21800,
    janCode: '4999999999999',
    brand: { name: 'ナイキ' },
    seller: { sellerId: 'shop-a', name: 'テスト店A' },
    shipping: { name: '送料無料' },
    ...overrides,
  }
}

/* ============================================================
 * 検索条件の組み立て
 * ========================================================== */

describe('YahooQueryBuilder', () => {
  it('JANがあればJAN検索を最優先にする', () => {
    const plans = buildYahooSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC')
    expect(plans[0].level).toBe('jan')
    expect(plans[0].params.jan_code).toBe('4999999999999')
  })

  it('★EANを自動的にJAN扱いしない★', () => {
    // 英国で採番されたEAN（50〜）は国内JANとして使えない
    const plans = buildYahooSearchPlans(
      makeProduct({ jan: null, ean: '5012345678900' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(plans.some((plan) => plan.level === 'ean-as-jan')).toBe(false)
  })

  it('日本の国コードで始まるEANならJANとして検索する', () => {
    const plans = buildYahooSearchPlans(
      makeProduct({ jan: null, ean: '4901234567894' }),
      'liverpool',
      'Liverpool FC',
    )
    const plan = plans.find((item) => item.level === 'ean-as-jan')
    expect(plan?.params.jan_code).toBe('4901234567894')
  })

  it('★メーカー品番と日本語のクラブ名で検索する★', () => {
    // 実データ検証での発見: 英語名（liverpool）で検索すると
    // 候補が 21件 → 2件 へ激減した。日本のECサイトは日本語名で登録されている。
    const plans = buildYahooSearchPlans(
      makeProduct({ jan: null, ean: null }),
      'liverpool',
      'Liverpool FC',
    )
    const plan = plans.find((item) => item.level === 'sku')
    expect(plan?.params.query).toContain('JV6423')
    expect(plan?.params.query).toContain('リバプール')
  })

  it('サンプル用の品番は検索に使わない', () => {
    const plans = buildYahooSearchPlans(
      makeProduct({ jan: null, ean: null, manufacturerSku: 'SAMPLE-LFC-2526-H-R' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(plans.some((plan) => plan.level === 'sku')).toBe(false)
  })

  it('属性検索は日本語のクラブ名を使う', () => {
    const query = buildAttributeQuery(makeProduct(), 'liverpool', 'Liverpool FC')
    expect(query).toContain('リバプール')
    expect(query).toContain('25/26')
    expect(query).toContain('ホーム')
    expect(query).toContain('レプリカ')
  })

  it('★分からない属性は検索語に入れない★', () => {
    const query = buildAttributeQuery(
      makeProduct({ season: null, kitType: 'unknown', authenticity: 'unknown', manufacturer: '確認中' }),
      'liverpool',
      'Liverpool FC',
    )
    // クラブ名だけでは範囲が広すぎるので検索しない
    expect(query).toBeNull()
  })

  it('原則として新品・在庫ありに絞る', () => {
    const plans = buildYahooSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC')
    expect(plans[0].params.condition).toBe('new')
    expect(plans[0].params.in_stock).toBe('true')
  })
})

/* ============================================================
 * レスポンスの検証
 * ========================================================== */

describe('APIレスポンスの検証', () => {
  it('正しい商品は通る', () => {
    const result = validateYahooHit(hit(), '2026-09-19T00:00:00.000Z')
    expect(result.valid).toBe(true)
    expect(result.product?.price).toBe(21800)
    expect(result.product?.janCode).toBe('4999999999999')
  })

  it('★価格が無い商品は取り込まない（0円商品を作らない）★', () => {
    expect(validateYahooHit(hit({ price: null }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
    expect(validateYahooHit(hit({ price: 0 }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
    expect(validateYahooHit(hit({ price: -100 }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
  })

  it('商品名が無い商品を弾く', () => {
    expect(validateYahooHit(hit({ name: '' }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
  })

  it('URLが不正な商品を弾く', () => {
    expect(validateYahooHit(hit({ url: 'http://example.com/x' }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
    expect(validateYahooHit(hit({ url: 'not a url' }), '2026-09-19T00:00:00.000Z').valid).toBe(false)
  })

  it('オブジェクトでないものを弾く', () => {
    expect(validateYahooHit(null, '2026-09-19T00:00:00.000Z').valid).toBe(false)
    expect(validateYahooHit('shirt', '2026-09-19T00:00:00.000Z').valid).toBe(false)
  })

  it('★在庫・状態が不明でも「あり」「新品」にしない★', () => {
    const result = validateYahooHit(
      hit({ inStock: undefined, condition: undefined }),
      '2026-09-19T00:00:00.000Z',
    )
    expect(result.product?.availability).toBe('unknown')
    expect(result.product?.condition).toBe('unknown')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it('通常価格を priceLabel から読み取る', () => {
    const result = validateYahooHit(
      hit({ priceLabel: { defaultPrice: 24200 } }),
      '2026-09-19T00:00:00.000Z',
    )
    expect(result.product?.regularPrice).toBe(24200)
  })

  it('★通常価格が現在価格より安い場合は採用しない（値上げをセールにしない）★', () => {
    const result = validateYahooHit(
      hit({ price: 21800, priceLabel: { defaultPrice: 19800 } }),
      '2026-09-19T00:00:00.000Z',
    )
    expect(result.product?.regularPrice).toBeNull()
  })

  it('壊れたレスポンスを弾く', () => {
    expect(validateYahooResponse(null, '2026-09-19T00:00:00.000Z').valid).toBe(false)
    expect(validateYahooResponse('<html>', '2026-09-19T00:00:00.000Z').valid).toBe(false)
  })

  it('0件の結果を異常として扱わない', () => {
    const result = validateYahooResponse(
      { totalResultsAvailable: 0, totalResultsReturned: 0 },
      '2026-09-19T00:00:00.000Z',
    )
    expect(result.valid).toBe(true)
    expect(result.products).toEqual([])
  })

  it('壊れた商品だけを落として続行する', () => {
    const result = validateYahooResponse(
      { totalResultsAvailable: 2, hits: [hit(), hit({ price: null, url: 'https://example.com/x2' })] },
      '2026-09-19T00:00:00.000Z',
    )
    expect(result.products).toHaveLength(1)
    expect(result.rejectedCount).toBe(1)
  })

  it('トラッキングパラメータを取り除く', () => {
    expect(normalizeYahooUrl('https://example.com/p?sc_e=abc&utm_source=x&size=M')).toBe(
      'https://example.com/p?size=M',
    )
  })
})

/* ============================================================
 * DomesticOffer への変換
 * ========================================================== */

describe('DomesticOffer への変換', () => {
  function offersFrom(hits: Record<string, unknown>[]) {
    const validation = validateYahooResponse(
      { totalResultsAvailable: hits.length, hits },
      '2026-09-19T00:00:00.000Z',
    )
    return toDomesticOffers(validation.products, matchContext, 'jan')
  }

  it('一致した商品は採用候補になる', () => {
    const [offer] = offersFrom([hit()])
    expect(offer.source).toBe('yahoo')
    expect(offer.matchGrade).toBe('A')
    expect(offer.condition).toBe('new')
    expect(offer.inStock).toBe(true)
    expect(isAdoptableOffer(offer)).toBe(true)
  })

  it('送料無料なら総額を出せる', () => {
    const [offer] = offersFrom([hit()])
    expect(offer.shippingJpy).toBe(0)
    expect(offer.totalPriceJpy).toBe(21800)
  })

  it('★「条件付き送料無料」は総額を出せない（0円にしない）★', () => {
    const [offer] = offersFrom([hit({ shipping: { name: '条件付き送料無料' } })])
    expect(offer.shippingJpy).toBeNull()
    expect(offer.totalPriceJpy).toBeNull()
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('別クラブの商品は不採用理由が付く', () => {
    const [offer] = offersFrom([
      hit({ name: 'マンチェスターユナイテッド 25/26 ホーム レプリカ', janCode: null }),
    ])
    expect(offer.rejectReasons.length).toBeGreaterThan(0)
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('中古品は不採用理由が付く', () => {
    const [offer] = offersFrom([hit({ condition: 'used' })])
    expect(offer.rejectReasons).toContain('中古品です')
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('在庫切れは不採用理由が付く', () => {
    const [offer] = offersFrom([hit({ inStock: false })])
    expect(offer.rejectReasons).toContain('在庫切れです')
  })

  it('同じURLの商品は1件にまとめる', () => {
    expect(offersFrom([hit(), hit()])).toHaveLength(1)
  })

  it('送料の読み取り', () => {
    expect(readShippingJpy('送料無料')).toBe(0)
    expect(readShippingJpy('条件付き送料無料')).toBeNull()
    expect(readShippingJpy(null)).toBeNull()
  })

  it('送料の決まりを作れる', () => {
    expect(buildShippingRuleFromLabel('store-x', '送料無料').type).toBe('fixed')
    expect(buildShippingRuleFromLabel('store-x', '送料無料').amount).toBe(0)
    expect(buildShippingRuleFromLabel('store-x', '条件付き送料無料').type).toBe('unknown')
    expect(buildShippingRuleFromLabel('store-x', null).type).toBe('unknown')
  })
})

/* ============================================================
 * 国内価格のまとめ
 * ========================================================== */

describe('国内価格のまとめ', () => {
  function offersFrom(hits: Record<string, unknown>[]) {
    const validation = validateYahooResponse(
      { totalResultsAvailable: hits.length, hits },
      '2026-09-19T00:00:00.000Z',
    )
    return toDomesticOffers(validation.products, matchContext, 'jan')
  }

  it('採用候補の最安値を選ぶ', () => {
    const summary = summarizeOffers(
      offersFrom([
        hit({ url: 'https://example.com/a', code: 'a', price: 23800 }),
        hit({ url: 'https://example.com/b', code: 'b', price: 21800 }),
      ]),
    )
    expect(summary.lowestPriceJpy).toBe(21800)
    expect(summary.adoptedCount).toBe(2)
  })

  it('中央値を計算する', () => {
    const summary = summarizeOffers(
      offersFrom([
        hit({ url: 'https://example.com/a', code: 'a', price: 20000 }),
        hit({ url: 'https://example.com/b', code: 'b', price: 22000 }),
        hit({ url: 'https://example.com/c', code: 'c', price: 24000 }),
      ]),
    )
    expect(summary.medianPriceJpy).toBe(22000)
  })

  it('候補が1件ならその価格が中央値', () => {
    const summary = summarizeOffers(offersFrom([hit()]))
    expect(summary.medianPriceJpy).toBe(21800)
  })

  it('★候補が0件なら null（0円にしない）★', () => {
    const summary = summarizeOffers([])
    expect(summary.lowestPriceJpy).toBeNull()
    expect(summary.medianPriceJpy).toBeNull()
    expect(summary.adoptedCount).toBe(0)
  })

  it('★店舗数はAPIの総件数ではなく、採用できた候補の件数★', () => {
    const summary = summarizeOffers(
      offersFrom([
        hit({ url: 'https://example.com/a', code: 'a' }),
        hit({ url: 'https://example.com/b', code: 'b', condition: 'used' }),
        hit({ url: 'https://example.com/c', code: 'c', name: 'アーセナル 25/26 ホーム', janCode: null }),
      ]),
    )
    expect(summary.candidateCount).toBe(3)
    expect(summary.adoptedCount).toBe(1)
  })

  it('A/B以外は自動採用しない', () => {
    const summary = summarizeOffers(
      offersFrom([hit({ janCode: null, name: 'リバプール ユニフォーム' })]),
    )
    expect(summary.adoptedCount).toBe(0)
  })
})

/* ============================================================
 * サカモノ内部モデルへの変換
 * ========================================================== */

describe('サカモノ内部モデルへの変換', () => {
  it('Store / StoreListing / DomesticMatch を作れて、既存の検証も通る', () => {
    const validation = validateYahooResponse(
      { totalResultsAvailable: 1, hits: [hit()] },
      '2026-09-19T00:00:00.000Z',
    )
    const offers = toDomesticOffers(validation.products, matchContext, 'jan')
    const models = toSakamonoModels(
      makeProduct(),
      offers,
      new Map([[offers[0].externalId, '送料無料']]),
    )

    expect(models.stores).toHaveLength(1)
    expect(validateStore(models.stores[0])).toEqual([])
    expect(validateStoreListing(models.listings[0])).toEqual([])

    // ★出品者が個別にいるモール型として扱う★
    expect(models.stores[0].type).toBe('marketplace')
    // ★取得データであることを記録する（開発用fixtureと区別するため）★
    expect(models.stores[0].dataOrigin).toBe('live')
  })

  it('照合の自動検証を通ったものだけ verification が automated になる', () => {
    const validation = validateYahooResponse(
      {
        totalResultsAvailable: 2,
        hits: [
          hit({ url: 'https://example.com/ok', code: 'ok' }),
          hit({ url: 'https://example.com/ng', code: 'ng', condition: 'unknown' }),
        ],
      },
      '2026-09-19T00:00:00.000Z',
    )
    const offers = toDomesticOffers(validation.products, matchContext, 'jan')
    const models = toSakamonoModels(makeProduct(), offers, new Map())

    expect(models.matches[0].verification).toBe('automated')
    expect(models.matches[1].verification).toBe('none')
    expect(models.matches[0].sourceLabel).toBe('yahoo')
  })
})

/* ============================================================
 * 通信まわり
 * ========================================================== */

describe('APIキー', () => {
  it('未設定なら null を返す（★build/testを落とさない★）', () => {
    expect(readYahooAppId({})).toBeNull()
    expect(readYahooAppId({ YAHOO_CLIENT_ID: '  ' })).toBeNull()
  })

  it('設定されていれば読み取る', () => {
    expect(readYahooAppId({ YAHOO_CLIENT_ID: 'test-id' })).toBe('test-id')
  })

  it('未設定のエラーは分かりやすい説明を持つ', () => {
    const error = missingAppIdError()
    expect(error.kind).toBe('auth-missing')
    expect(error.message).toContain('YAHOO_CLIENT_ID')
    expect(error.message).toContain('.env.local')
  })
})

describe('通信エラーの扱い', () => {
  function makeClient(fetchImpl: typeof fetch) {
    return new YahooShoppingClient({
      appId: 'test-app-id',
      noCache: true,
      fetchImpl,
      // テストでは待たない
      sleepImpl: async () => {},
    })
  }

  const plan = { level: 'jan' as const, description: 'test', params: { jan_code: '123' } }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status })
  }

  it('★APIキーをリクエスト記録に残さない★', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ totalResultsAvailable: 0 }))
    const result = await makeClient(fetchImpl as unknown as typeof fetch).search(plan)

    expect(result.requestParams).not.toHaveProperty('appid')
    expect(JSON.stringify(result)).not.toContain('test-app-id')
  })

  it('429（利用制限）は数回だけ再試行する', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow(
      IngestionError,
    )
    // 初回 + 再試行2回
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('429のあと成功すれば結果を返す', async () => {
    let call = 0
    const fetchImpl = vi.fn(async () => {
      call += 1
      return call === 1 ? jsonResponse({}, 429) : jsonResponse({ totalResultsAvailable: 0 })
    })
    const result = await makeClient(fetchImpl as unknown as typeof fetch).search(plan)
    expect(result.products).toEqual([])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('★4xx（429以外）は再試行しない★', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 404))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('APIキーが拒否されたら止める', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 403))
    await makeClient(fetchImpl as unknown as typeof fetch)
      .search(plan)
      .catch((error: IngestionError) => {
        expect(error.kind).toBe('auth-invalid')
        expect(mustStopOnError(error.kind)).toBe(true)
      })
  })

  it('5xx は再試行する', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('タイムアウトを区別する', async () => {
    const fetchImpl = vi.fn(async () => {
      const error = new Error('aborted')
      error.name = 'AbortError'
      throw error
    })
    await makeClient(fetchImpl as unknown as typeof fetch)
      .search(plan)
      .catch((error: IngestionError) => {
        expect(error.kind).toBe('timeout')
      })
  })

  it('JSONでない応答を parse エラーにする', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>error</html>', { status: 200 }))
    await makeClient(fetchImpl as unknown as typeof fetch)
      .search(plan)
      .catch((error: IngestionError) => {
        expect(error.kind).toBe('parse')
      })
  })

  it('再試行してよい種類を区別している', () => {
    expect(isRetryable('rate-limited')).toBe(true)
    expect(isRetryable('timeout')).toBe(true)
    expect(isRetryable('server-error')).toBe(true)
    // ★4xx や設定ミスは再試行しない★
    expect(isRetryable('auth-invalid')).toBe(false)
    expect(isRetryable('unexpected-schema')).toBe(false)
  })

  it('リクエストの間隔をあける設定になっている', () => {
    // 公式の制限は1クエリ/秒。余裕を持たせる。
    expect(MIN_REQUEST_INTERVAL_MS).toBeGreaterThanOrEqual(1000)
  })
})

/* ============================================================
 * 全体（サンプル応答）
 * ========================================================== */

describe('取り込み全体（サンプル応答）', () => {
  it('サンプルの12件を処理できる', async () => {
    const result = await runYahooSearch(new SampleSearchExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
      referencePriceJpy: 20000,
      maxSearches: 1,
    })

    expect(result.summary.candidateCount).toBe(yahooSampleResponse.hits?.length)
    expect(result.summary.hardRejectedCount).toBeGreaterThan(0)
    expect(result.summary.reviewCount).toBeGreaterThan(0)
  })

  it('★採用されるのは照合・状態・在庫・送料のすべてを満たしたものだけ★', async () => {
    const result = await runYahooSearch(new SampleSearchExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
      referencePriceJpy: 20000,
      maxSearches: 1,
    })

    expect(result.summary.adoptedCount).toBe(1)
    expect(result.summary.lowestPriceJpy).toBe(20800)

    for (const offer of result.summary.adopted) {
      expect(offer.condition).toBe('new')
      expect(offer.inStock).toBe(true)
      expect(offer.verification).toBe('automated')
      expect(offer.totalPriceJpy).not.toBeNull()
    }
  })

  it('★極端に安い出品・中古・別クラブを採用しない★', async () => {
    const result = await runYahooSearch(new SampleSearchExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
      referencePriceJpy: 20000,
      maxSearches: 1,
    })

    const adoptedPrices = result.summary.adopted.map((offer) => offer.priceJpy)
    expect(adoptedPrices).not.toContain(1980) // 極端に安い
    expect(adoptedPrices).not.toContain(9800) // 中古
    expect(adoptedPrices).not.toContain(19900) // 別クラブ
    expect(adoptedPrices).not.toContain(12800) // ジュニア
  })

  it('検索の記録にAPIキーが残らない', async () => {
    const result = await runYahooSearch(new SampleSearchExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
      maxSearches: 1,
    })
    expect(JSON.stringify(result.searches)).not.toContain('appid')
  })
})

/**
 * 楽天市場 商品検索API 取り込みパイプラインのテスト。
 *
 * ★このテストの主眼は「取れること」ではなく、
 *   「取れないものを取れたことにしないこと」★
 *
 *   ・0円の商品を作らない
 *   ・税別価格を税込価格として比べない
 *   ・送料不明を0円にしない
 *   ・新品と確かめていないものを新品最安値にしない
 *   ・ポイントを現金値引きとして引かない
 *   ・認証情報を記録・出力へ残さない
 *
 * ★照合のルールはYahoo!と共通のエンジンを使っています。★
 *   ここでは「共通エンジンが楽天側でも同じように効くこと」を確かめます。
 */

import { describe, expect, it, vi } from 'vitest'
import type { Product } from '@/domain/types'
import { isAdoptableOffer, countWouldBeAdopted } from '@/domain/domesticOffer'
import type { MatchContext } from '@/lib/matching/engine'
import {
  MAX_HITS,
  RakutenIchibaClient,
  SampleRakutenExecutor,
  buildRakutenAttributeQuery,
  buildRakutenSearchPlans,
  describeMissingCredentials,
  describePointReward,
  describeTaxBasis,
  isUsableKeyword,
  missingCredentialsError,
  normalizeRakutenUrl,
  readRakutenCredentials,
  readRakutenShippingJpy,
  redactCredentials,
  runRakutenSearch,
  toDomesticOffer,
  toDomesticOffers,
  toSakamonoModels,
  validateRakutenItem,
  validateRakutenResponse,
} from '@/data/external/rakuten'
import type { RakutenRawItem } from '@/data/external/rakuten'

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
    manufacturer: 'adidas',
    manufacturerSku: 'JV6423',
    jan: null,
    ean: null,
    category: 'kits',
    kitType: 'home',
    authenticity: 'replica',
    sleeve: 'short',
    gender: 'men',
    player: null,
    personalization: 'plain',
    image: { src: '/x.svg', alt: 'x', width: 800, height: 800, source: 'placeholder' },
    active: true,
    ...overrides,
  }
}

function context(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    product: makeProduct(),
    clubSlug: 'liverpool',
    referencePriceJpy: 15_830,
    ...overrides,
  }
}

/** 公式仕様のフィールド名で1件分を作る。 */
function apiItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    itemName: 'リバプール 25-26 ホーム 半袖レプリカユニフォーム adidas JYF22-JV6423',
    itemCode: 'test-shop:item-1',
    itemPrice: 8980,
    itemUrl: 'https://example.com/rakuten/item-1',
    shopCode: 'test-shop',
    shopName: 'テストショップ',
    mediumImageUrls: ['https://example.com/rakuten/image.jpg'],
    availability: 1,
    taxFlag: 0,
    postageFlag: 0,
    pointRate: 1,
    ...overrides,
  }
}

/** 検証済みの生データを作る。 */
function rawItem(overrides: Partial<RakutenRawItem> = {}): RakutenRawItem {
  const result = validateRakutenItem(apiItem(), '2026-09-19T00:00:00.000Z')
  return { ...(result.item as RakutenRawItem), ...overrides }
}

/* ============================================================
 * 検索条件の組み立て
 * ========================================================== */

describe('RakutenQueryBuilder', () => {
  it('★JAN検索の段階を作らない（楽天APIが対応していないため）★', () => {
    const plans = buildRakutenSearchPlans(
      makeProduct({ jan: '4901234567894' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(plans.some((plan) => (plan.level as string) === 'jan')).toBe(false)
    expect(plans.every((plan) => plan.params.jan_code === undefined)).toBe(true)
  })

  it('メーカー品番を最優先にする', () => {
    const plans = buildRakutenSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC')
    expect(plans[0].level).toBe('sku')
    expect(plans[0].params.keyword).toBe('JV6423')
  })

  it('品番とクラブ名の組み合わせも作る（日本語のクラブ名を優先）', () => {
    const plans = buildRakutenSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC')
    const withClub = plans.find((plan) => plan.level === 'sku-club')
    expect(withClub?.params.keyword).toBe('JV6423 リバプール')
  })

  it('★開発用のダミー品番（SAMPLE-）を実APIへ投げない★', () => {
    const plans = buildRakutenSearchPlans(
      makeProduct({ manufacturerSku: 'SAMPLE-LFC-2526-H-R' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(plans.every((plan) => plan.level === 'attributes')).toBe(true)
  })

  it('品番が無ければ属性検索だけになる', () => {
    const plans = buildRakutenSearchPlans(
      makeProduct({ manufacturerSku: null }),
      'liverpool',
      'Liverpool FC',
    )
    expect(plans).toHaveLength(1)
    expect(plans[0].level).toBe('attributes')
  })

  it('★不明な項目を検索語に入れない★', () => {
    const query = buildRakutenAttributeQuery(
      makeProduct({ kitType: 'unknown', authenticity: 'unknown' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(query).not.toContain('ホーム')
    expect(query).not.toContain('レプリカ')
  })

  it('クラブ名だけしか手掛かりが無ければ属性検索をしない（範囲が広すぎる）', () => {
    const query = buildRakutenAttributeQuery(
      makeProduct({ season: null, kitType: null, authenticity: null, manufacturer: '確認中' }),
      'liverpool',
      'Liverpool FC',
    )
    expect(query).toBeNull()
  })

  it('公式仕様の制限（2文字以上・128バイト以内）を守る', () => {
    expect(isUsableKeyword('a')).toBe(false)
    expect(isUsableKeyword('JV6423')).toBe(true)
    // 日本語は1文字3バイト。44文字で132バイトになり上限を超える
    expect(isUsableKeyword('あ'.repeat(44))).toBe(false)
  })

  it('1回に受け取る件数が公式の上限を超えない', () => {
    const plans = buildRakutenSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC', {
      hits: 100,
    })
    expect(Number(plans[0].params.hits)).toBeLessThanOrEqual(MAX_HITS)
  })

  it('既定で在庫ありに絞る', () => {
    const plans = buildRakutenSearchPlans(makeProduct(), 'liverpool', 'Liverpool FC')
    expect(plans[0].params.availability).toBe('1')
  })
})

/* ============================================================
 * レスポンスの検証
 * ========================================================== */

describe('APIレスポンスの検証', () => {
  const at = '2026-09-19T00:00:00.000Z'

  it('正しい商品は通る', () => {
    const result = validateRakutenItem(apiItem(), at)
    expect(result.valid).toBe(true)
    expect(result.item?.price).toBe(8980)
    expect(result.item?.shopCode).toBe('test-shop')
  })

  it('★価格が無い・0以下の商品は取り込まない（0円商品を作らない）★', () => {
    expect(validateRakutenItem(apiItem({ itemPrice: null }), at).valid).toBe(false)
    expect(validateRakutenItem(apiItem({ itemPrice: 0 }), at).valid).toBe(false)
    expect(validateRakutenItem(apiItem({ itemPrice: -100 }), at).valid).toBe(false)
  })

  it('商品名が無い商品は取り込まない', () => {
    expect(validateRakutenItem(apiItem({ itemName: '' }), at).valid).toBe(false)
    expect(validateRakutenItem(apiItem({ itemName: undefined }), at).valid).toBe(false)
  })

  it('URLが不正な商品は取り込まない', () => {
    expect(validateRakutenItem(apiItem({ itemUrl: 'http://example.com/x' }), at).valid).toBe(false)
    expect(validateRakutenItem(apiItem({ itemUrl: 'not a url' }), at).valid).toBe(false)
  })

  it('オブジェクトでない要素を取り込まない', () => {
    expect(validateRakutenItem('文字列', at).valid).toBe(false)
    expect(validateRakutenItem(null, at).valid).toBe(false)
  })

  it('★在庫・税込／税別・送料込みは、取れなければ unknown にする★', () => {
    const result = validateRakutenItem(
      apiItem({ availability: undefined, taxFlag: undefined, postageFlag: undefined }),
      at,
    )
    expect(result.item?.availability).toBe('unknown')
    expect(result.item?.taxBasis).toBe('unknown')
    expect(result.item?.postageBasis).toBe('unknown')
  })

  it('taxFlag / postageFlag を公式仕様どおりに読む（0=税込 / 0=送料込み）', () => {
    const included = validateRakutenItem(apiItem({ taxFlag: 0, postageFlag: 0 }), at)
    expect(included.item?.taxBasis).toBe('tax-included')
    expect(included.item?.postageBasis).toBe('included')

    const excluded = validateRakutenItem(apiItem({ taxFlag: 1, postageFlag: 1 }), at)
    expect(excluded.item?.taxBasis).toBe('tax-excluded')
    expect(excluded.item?.postageBasis).toBe('excluded')
  })

  it('★JANは常に null（楽天APIが返さない。説明文から拾わない）★', () => {
    const result = validateRakutenItem(
      apiItem({ itemCaption: 'JAN: 4901234567894 の商品です' }),
      at,
    )
    expect(result.item?.janCode).toBeNull()
  })

  it('formatVersion=1（Itemで包まれた形）でも読める', () => {
    const result = validateRakutenResponse({ count: 1, hits: 1, Items: [{ Item: apiItem() }] }, at)
    expect(result.valid).toBe(true)
    expect(result.items).toHaveLength(1)
  })

  it('formatVersion=2（素の配列）でも読める', () => {
    const result = validateRakutenResponse({ count: 1, hits: 1, Items: [apiItem()] }, at)
    expect(result.valid).toBe(true)
    expect(result.items).toHaveLength(1)
  })

  it('★0件はエラーではない（「見つからない」と「取れない」は別物）★', () => {
    const result = validateRakutenResponse({ count: 0, hits: 0, Items: [] }, at)
    expect(result.valid).toBe(true)
    expect(result.items).toHaveLength(0)
  })

  it('壊れた応答を弾く', () => {
    expect(validateRakutenResponse('文字列', at).valid).toBe(false)
    expect(validateRakutenResponse(null, at).valid).toBe(false)
    expect(validateRakutenResponse({ Items: 'not-an-array' }, at).valid).toBe(false)
  })

  it('APIがエラーを返したら、それと分かる形にする', () => {
    const result = validateRakutenResponse(
      { error: 'wrong_parameter', error_description: 'keyword is too short' },
      at,
    )
    expect(result.valid).toBe(false)
    expect(result.errors[0].message).toContain('wrong_parameter')
  })

  it('おかしな1件があっても、他の候補は残す', () => {
    const result = validateRakutenResponse(
      { count: 2, hits: 2, Items: [apiItem(), apiItem({ itemPrice: 0 })] },
      at,
    )
    expect(result.items).toHaveLength(1)
    expect(result.rejectedCount).toBe(1)
  })

  it('トラッキング用のパラメータを落とす', () => {
    const url = normalizeRakutenUrl('https://example.com/item?scid=abc&color=red')
    expect(url).not.toContain('scid')
    expect(url).toContain('color=red')
  })
})

/* ============================================================
 * DomesticOffer への変換
 * ========================================================== */

describe('DomesticOffer への変換', () => {
  it('source が rakuten になる', () => {
    const offer = toDomesticOffer(rawItem(), context())
    expect(offer.source).toBe('rakuten')
  })

  it('送料込みなら総額を出せる', () => {
    const offer = toDomesticOffer(rawItem({ postageBasis: 'included' }), context())
    expect(offer.shippingJpy).toBe(0)
    expect(offer.totalPriceJpy).toBe(8980)
  })

  it('★送料別・送料不明は0円にしない（総額を出さない）★', () => {
    for (const postageBasis of ['excluded', 'unknown'] as const) {
      const offer = toDomesticOffer(rawItem({ postageBasis }), context())
      expect(offer.shippingJpy).toBeNull()
      expect(offer.totalPriceJpy).toBeNull()
      expect(isAdoptableOffer(offer)).toBe(false)
    }
    expect(readRakutenShippingJpy(rawItem({ postageBasis: 'excluded' }))).toBeNull()
  })

  it('★税別価格を税込として比べない（人の確認へ回す）★', () => {
    const offer = toDomesticOffer(rawItem({ taxBasis: 'tax-excluded' }), context())
    expect(offer.reviewReasons.some((reason) => reason.includes('税別'))).toBe(true)
    expect(isAdoptableOffer(offer)).toBe(false)
    expect(describeTaxBasis(rawItem({ taxBasis: 'tax-excluded' }))).toContain('税別')
  })

  it('税込か税別か分からないものも、税込と決めつけない', () => {
    const offer = toDomesticOffer(rawItem({ taxBasis: 'unknown' }), context())
    expect(offer.reviewReasons.length).toBeGreaterThan(0)
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('★通常価格を現在価格で埋めない（存在しない値引きを作らない）★', () => {
    const offer = toDomesticOffer(rawItem(), context())
    expect(offer.regularPriceJpy).toBeNull()
  })

  it('★ポイント還元を価格から差し引かない★', () => {
    const offer = toDomesticOffer(rawItem({ pointRate: 10 }), context())
    expect(offer.priceJpy).toBe(8980)
    expect(offer.totalPriceJpy).toBe(8980)
    // 表示用の覚え書きとしてだけ残る
    expect(offer.rewardNote).toContain('10')
    expect(offer.rewardNote).toContain('含めていません')
  })

  it('ポイント等倍のときは覚え書きを作らない', () => {
    expect(describePointReward(rawItem({ pointRate: 1 }))).toBeNull()
    expect(describePointReward(rawItem({ pointRate: null }))).toBeNull()
  })

  it('★新品と確かめられていないものを自動採用しない★', () => {
    const offer = toDomesticOffer(rawItem(), context())
    // 楽天のAPIには新品／中古の項目そのものが無い
    expect(offer.condition).toBe('unknown')
    expect(offer.conditionEvidence).toBe('title-checked')
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('商品名に中古とあれば、確かめるまでもなく除外する', () => {
    const offer = toDomesticOffer(
      rawItem({ name: '【中古】リバプール 25-26 ホーム 半袖レプリカ adidas JV6423' }),
      context(),
    )
    expect(offer.conditionEvidence).toBe('api-used')
    expect(offer.rejectCodes).toContain('usedCondition')
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('在庫切れを除外する', () => {
    const offer = toDomesticOffer(rawItem({ availability: 'unavailable' }), context())
    expect(offer.rejectReasons).toContain('在庫切れです')
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('同じ商品が複数の検索で出てきても1件にまとめる', () => {
    const offers = toDomesticOffers([rawItem(), rawItem(), rawItem()], context())
    expect(offers).toHaveLength(1)
  })
})

/* ============================================================
 * ★共通の照合エンジンが楽天側でも同じように効くこと★
 * ========================================================== */

describe('共通MatchingEngineの適用', () => {
  function judge(name: string) {
    return toDomesticOffer(rawItem({ name }), context())
  }

  it('袖丈が違えば不採用（sleeveMismatch）', () => {
    const offer = judge('リバプール 25-26 ホーム 長袖レプリカユニフォーム adidas JYF51-JV6456')
    expect(offer.rejectCodes).toContain('sleeveMismatch')
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('選手名入りは無地の候補にしない（personalizationMismatch）', () => {
    const offer = judge(
      'リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー adidas JV6423',
    )
    expect(offer.rejectCodes).toContain('personalizationMismatch')
  })

  it('別クラブを採用しない（wrongClub）', () => {
    const offer = judge('マンチェスターシティ 25/26 ホーム 半袖 レプリカ ユニフォーム adidas')
    expect(offer.rejectCodes).toContain('wrongClub')
  })

  it('別シーズンを採用しない（wrongSeason）', () => {
    const offer = judge('リバプール 24/25 ホーム 半袖 レプリカ ユニフォーム adidas JV6423')
    expect(offer.rejectCodes).toContain('wrongSeason')
  })

  it('アウェイをホームの候補にしない（wrongKitType）', () => {
    const offer = judge('リバプール 25/26 アウェイ 半袖 レプリカ ユニフォーム adidas JV6487')
    expect(offer.rejectCodes).toContain('wrongKitType')
  })

  it('オーセンティックをレプリカの候補にしない（authenticityMismatch）', () => {
    const offer = judge('リバプール 25/26 ホーム 半袖 オーセンティック adidas JV6423')
    expect(offer.rejectCodes).toContain('authenticityMismatch')
  })

  it('子供用を大人用の候補にしない（genderMismatch）', () => {
    const offer = judge('ジュニア リバプール 25-26 ホーム 半袖レプリカ adidas JYF33-JV6436')
    expect(offer.rejectCodes).toContain('genderMismatch')
  })

  it('セット商品を単品の候補にしない（bundleMismatch）', () => {
    const offer = judge('リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423 上下セット')
    expect(offer.rejectCodes).toContain('bundleMismatch')
  })

  it('★品番が一致しても、矛盾があれば採用しない★', () => {
    const offer = judge('リバプール 25/26 ホーム 長袖 レプリカ adidas JV6423')
    expect(offer.rejectCodes).toContain('sleeveMismatch')
    expect(offer.matchConfidence).toBe(0)
  })

  it('★JANが無いことを「一致」と扱わない★', () => {
    const offer = toDomesticOffer(rawItem(), context())
    expect(offer.unknownAttributes).toContain('jan')
    expect(offer.matchLevel).not.toBe('jan')
  })

  it('品番・クラブ・シーズンがそろえばランクB', () => {
    const offer = judge('リバプール 25/26 ホーム 半袖 レプリカ ユニフォーム adidas JV6423 メンズ')
    expect(offer.matchGrade).toBe('B')
    expect(offer.rejectReasons).toHaveLength(0)
  })

  it('根拠を記録している', () => {
    const offer = judge('リバプール 25/26 ホーム 半袖 レプリカ ユニフォーム adidas JV6423 メンズ')
    expect(offer.positiveEvidence.length).toBeGreaterThan(0)
    expect(offer.positiveEvidence.some((text) => text.includes('メーカー品番'))).toBe(true)
  })
})

/* ============================================================
 * 採用の方針
 * ========================================================== */

describe('★新品／中古が取得できない提供元の扱い★', () => {
  const plain = 'リバプール 25/26 ホーム 半袖 レプリカ ユニフォーム adidas JV6423 メンズ'

  it('既定では自動採用しない（決めつけない）', () => {
    const offer = toDomesticOffer(rawItem({ name: plain }), context())
    expect(isAdoptableOffer(offer)).toBe(false)
  })

  it('方針を明示的に緩めたときだけ採用対象になる', () => {
    const offer = toDomesticOffer(rawItem({ name: plain }), context())
    expect(isAdoptableOffer(offer, { acceptTitleCheckedCondition: true })).toBe(true)
  })

  it('★方針を緩めても、中古と書かれたものは採用しない★', () => {
    const offer = toDomesticOffer(
      rawItem({ name: `【中古】${plain}` }),
      context(),
    )
    expect(isAdoptableOffer(offer, { acceptTitleCheckedCondition: true })).toBe(false)
  })

  it('★方針を緩めても、袖丈違いは採用しない★', () => {
    const offer = toDomesticOffer(
      rawItem({ name: 'リバプール 25/26 ホーム 長袖 レプリカ adidas JV6423' }),
      context(),
    )
    expect(isAdoptableOffer(offer, { acceptTitleCheckedCondition: true })).toBe(false)
  })

  it('★方針を緩めても、送料不明なら総額を出せないので採用しない★', () => {
    const offer = toDomesticOffer(
      rawItem({ name: plain, postageBasis: 'excluded' }),
      context(),
    )
    expect(isAdoptableOffer(offer, { acceptTitleCheckedCondition: true })).toBe(false)
  })

  it('方針を変えると何件増えるかを数えられる', () => {
    const offers = toDomesticOffers(
      [
        rawItem({ name: plain, externalId: 'a' }),
        rawItem({ name: `【中古】${plain}`, externalId: 'b' }),
      ],
      context(),
    )
    expect(countWouldBeAdopted(offers, { acceptTitleCheckedCondition: false })).toBe(0)
    expect(countWouldBeAdopted(offers, { acceptTitleCheckedCondition: true })).toBe(1)
  })
})

/* ============================================================
 * サカモノ内部モデルへの変換
 * ========================================================== */

describe('サカモノ内部モデルへの変換', () => {
  it('出店者ごとに Store を作り、モール型として扱う', () => {
    const offers = toDomesticOffers(
      [rawItem({ externalId: 'a' }), rawItem({ externalId: 'b', shopCode: 'other-shop' })],
      context(),
    )
    const models = toSakamonoModels(makeProduct(), offers, new Map())
    expect(models.stores).toHaveLength(2)
    expect(models.stores.every((store) => store.type === 'marketplace')).toBe(true)
    expect(models.stores.every((store) => store.dataOrigin === 'live')).toBe(true)
  })

  it('★送料込みと分かっている店だけ fixed、それ以外は unknown★', () => {
    const offers = toDomesticOffers([rawItem({ externalId: 'a' })], context())
    const included = toSakamonoModels(
      makeProduct(),
      offers,
      new Map([['a', 'included' as const]]),
    )
    expect(included.shippingRules[0].type).toBe('fixed')
    expect(included.shippingRules[0].amount).toBe(0)

    const excluded = toSakamonoModels(
      makeProduct(),
      offers,
      new Map([['a', 'excluded' as const]]),
    )
    expect(excluded.shippingRules[0].type).toBe('unknown')
    expect(excluded.shippingRules[0].amount).toBeUndefined()
  })

  it('照合の根拠と未確認の項目を DomesticMatch へ残す', () => {
    const offers = toDomesticOffers([rawItem({ externalId: 'a' })], context())
    const models = toSakamonoModels(makeProduct(), offers, new Map())
    expect(models.matches[0].sourceLabel).toBe('rakuten')
    expect(models.matches[0].unknownAttributes).toContain('jan')
  })
})

/* ============================================================
 * 認証情報
 * ========================================================== */

describe('認証情報', () => {
  it('両方そろっていなければ使えないものとして扱う', () => {
    expect(readRakutenCredentials({})).toBeNull()
    expect(readRakutenCredentials({ RAKUTEN_APPLICATION_ID: 'x' })).toBeNull()
    expect(readRakutenCredentials({ RAKUTEN_ACCESS_KEY: 'y' })).toBeNull()
    expect(
      readRakutenCredentials({ RAKUTEN_APPLICATION_ID: 'x', RAKUTEN_ACCESS_KEY: 'y' }),
    ).not.toBeNull()
  })

  it('どちらが足りないかを、値を出さずに伝える', () => {
    expect(describeMissingCredentials({ RAKUTEN_APPLICATION_ID: 'x' })).toEqual([
      'RAKUTEN_ACCESS_KEY',
    ])
  })

  it('未設定のときに、直し方が分かるエラーになる', () => {
    const error = missingCredentialsError({})
    expect(error.kind).toBe('auth-missing')
    expect(error.message).toContain('RAKUTEN_APPLICATION_ID')
    expect(error.message).toContain('.env.local')
  })

  it('★エラー文言に混ざった認証情報を伏せ字にする★', () => {
    const text = redactCredentials(
      'https://openapi.rakuten.co.jp/x?applicationId=SECRET1&accessKey=pk_SECRET2&hits=20',
    )
    expect(text).not.toContain('SECRET1')
    expect(text).not.toContain('pk_SECRET2')
    expect(text).toContain('hits=20')
  })
})

/* ============================================================
 * 通信
 * ========================================================== */

describe('通信エラーの扱い', () => {
  function makeClient(fetchImpl: typeof fetch) {
    return new RakutenIchibaClient({
      credentials: { applicationId: 'test-app-id', accessKey: 'pk_test-access-key' },
      noCache: true,
      fetchImpl,
      // テストでは待たない
      sleepImpl: async () => {},
    })
  }

  const plan = {
    level: 'sku' as const,
    description: 'test',
    params: { keyword: 'JV6423', hits: '20' },
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status })
  }

  it('★認証情報をリクエスト記録に残さない★', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ count: 0, hits: 0, Items: [] }))
    const result = await makeClient(fetchImpl as unknown as typeof fetch).search(plan)
    expect(JSON.stringify(result.requestParams)).not.toContain('test-app-id')
    expect(JSON.stringify(result.requestParams)).not.toContain('pk_test-access-key')
    expect(result.requestParams.keyword).toBe('JV6423')
  })

  it('accessKey をヘッダーで送る（URLに秘密を置かない）', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ count: 0, hits: 0, Items: [] }))
    await makeClient(fetchImpl as unknown as typeof fetch).search(plan)

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).not.toContain('pk_test-access-key')
    expect((init.headers as Record<string, string>).accessKey).toBe('pk_test-access-key')
  })

  it('★429は間隔を空けて数回だけ再試行する（連打しない）★', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 429))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    // 初回 + 再試行2回
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('タイムアウトは再試行する', async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) {
        const error = new Error('aborted')
        error.name = 'AbortError'
        throw error
      }
      return jsonResponse({ count: 0, hits: 0, Items: [] })
    })
    const result = await makeClient(fetchImpl as unknown as typeof fetch).search(plan)
    expect(result.items).toHaveLength(0)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('★400は再試行しない（何度送っても同じ）★', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 400))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('認証エラー（401/403）は再試行せず、止めるべきものとして扱う', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 403))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('5xxは再試行する', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 503))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('JSONとして読めない応答をエラーにする', async () => {
    const fetchImpl = vi.fn(async () => new Response('<html>error</html>', { status: 200 }))
    await expect(makeClient(fetchImpl as unknown as typeof fetch).search(plan)).rejects.toThrow()
  })
})

/* ============================================================
 * 取り込み全体（サンプル応答）
 * ========================================================== */

describe('取り込み全体（サンプル応答）', () => {
  it('★サンプルの「採用してはいけないもの」をすべて除外する★', async () => {
    const result = await runRakutenSearch(new SampleRakutenExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
      referencePriceJpy: 15_830,
    })

    const rejected = result.offers.filter((offer) => offer.rejectReasons.length > 0)
    const codes = rejected.flatMap((offer) => offer.rejectCodes)

    expect(codes).toContain('sleeveMismatch')
    expect(codes).toContain('personalizationMismatch')
    expect(codes).toContain('genderMismatch')
    expect(codes).toContain('wrongClub')
    expect(codes).toContain('usedCondition')
  })

  it('★既定では1件も自動採用しない（新品と確かめられないため）★', async () => {
    const result = await runRakutenSearch(new SampleRakutenExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
    })
    expect(result.offers.filter((offer) => isAdoptableOffer(offer))).toHaveLength(0)
  })

  it('方針を緩めても、税別・送料別は採用対象にならない', async () => {
    const result = await runRakutenSearch(new SampleRakutenExecutor(), {
      product: makeProduct(),
      clubSlug: 'liverpool',
      clubName: 'Liverpool FC',
    })

    const adopted = result.offers.filter((offer) =>
      isAdoptableOffer(offer, { acceptTitleCheckedCondition: true }),
    )
    // サンプルの9件のうち、税別1件・送料別1件は外れ、無地の2件だけが残る
    expect(adopted).toHaveLength(2)
    expect(adopted.every((offer) => offer.totalPriceJpy !== null)).toBe(true)
  })
})

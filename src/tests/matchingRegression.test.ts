/**
 * 誤一致（False Positive）を防ぐための回帰テスト。
 *
 * ══════════════════════════════════════════════════════════
 * ★このテストが守っているもの★
 *
 *   「別の商品を、同じ商品として価格比較に使ってしまうこと」を防ぐ。
 *
 *   サカモノの価格比較は「日本到着推定額」と「国内価格」を並べます。
 *   片方が別商品だと、そこに出る差額は嘘になります。
 *   取りこぼし（見つけられなかった）は、あとから直せます。
 *   誤一致は、利用者に嘘の数字を見せたあとでしか気付けません。
 *
 *   ★だからここでは、取りこぼしよりも誤一致を厳しく見ます。★
 * ══════════════════════════════════════════════════════════
 *
 * 商品名は実在の出品から引用しているものがあります。
 * 照合の正しさを確かめる目的にのみ使い、価格・出品者名は含めません。
 */

import { describe, expect, it } from 'vitest'
import type { Personalization, Product, SleeveLength } from '@/domain/types'
import {
  evaluateMatch,
  isAutoAdoptable,
  type MatchCandidate,
  type MatchContext,
} from '@/lib/matching/engine'
import { classifyPersonalization, detectSleeve } from '@/lib/matching/aliases'
import { normalizeLight, padded } from '@/lib/matching/textNormalize'

/* ------------------------------------------------------------
 * 共通のデータ
 * ---------------------------------------------------------- */

/** リヴァプール 2025/26 ホーム 半袖 レプリカ（無地・大人用）。 */
function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-lfc-2526-home-replica',
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

function contextFor(product: Product, overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    product,
    clubSlug: 'liverpool',
    referencePriceJpy: 15_830,
    ...overrides,
  }
}

function candidateFor(title: string, overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    title,
    jan: null,
    brandName: 'adidas',
    condition: 'new',
    priceJpy: 9_240,
    ...overrides,
  }
}

/** 既定の商品（半袖・無地）に対して1件を判定する。 */
function judge(title: string, overrides: Partial<MatchCandidate> = {}) {
  return evaluateMatch(contextFor(baseProduct()), candidateFor(title, overrides))
}

/* ============================================================
 * 16. 袖丈（半袖 / 長袖 / ノースリーブ）
 * ========================================================== */

describe('★袖丈が違うものを採用しない★', () => {
  /**
   * 半袖 JV6423 と 長袖 JV6456 は別品番・別価格の商品です。
   * どの書き方で来ても、絶対に採用してはいけません。
   */
  const longSleeveTitles = [
    'リバプール 25-26 ホーム 長袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf51-jv6456',
    'アディダス リバプールFC 25/26 ホーム ロングスリーブ レプリカ ユニフォーム adidas',
    'adidas リバプール 25/26 home replica long sleeve メンズ',
    'リバプールFC 25/26 ホーム レプリカ L/S アディダス メンズ',
  ]

  for (const title of longSleeveTitles) {
    it(`長袖を半袖の候補にしない: ${title.slice(0, 28)}…`, () => {
      const result = judge(title)

      expect(result.hardReject).toBe(true)
      expect(result.hardRejectCodes).toContain('sleeveMismatch')
      expect(result.confidence).toBe(0)
      expect(isAutoAdoptable(result)).toBe(false)
    })
  }

  it('ノースリーブを半袖の候補にしない', () => {
    const result = judge('アディダス リバプールFC 25/26 ホーム ノースリーブ レプリカ メンズ')

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('sleeveMismatch')
  })

  it('半袖を長袖の候補にしない（逆向きも同じ）', () => {
    const result = evaluateMatch(
      contextFor(baseProduct({ sleeve: 'long', manufacturerSku: 'JV6456' })),
      candidateFor(
        'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      ),
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('sleeveMismatch')
  })

  it('半袖どうしは採用してよい', () => {
    const result = judge(
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      { priceJpy: 7_920 },
    )

    expect(result.hardReject).toBe(false)
    expect(isAutoAdoptable(result)).toBe(true)
  })

  it('★袖丈が書かれていないものを「一致」にしない★', () => {
    const result = judge(
      'アディダス サッカー ライセンスシャツ リバプールFC 25/26 ホームジャージー JV6423 レプリカユニフォーム : レッド adidas',
    )

    expect(result.hardReject).toBe(false)
    // 「書かれていない」は未確認であって、一致ではない
    expect(result.unknownAttributes).toContain('sleeve')
    expect(result.positiveEvidence.some((text) => text.includes('袖丈'))).toBe(false)
  })

  it('★サイズ表記「XL/S」を長袖と読み違えない★', () => {
    // 単純な部分一致だと "L/S" を拾ってしまう
    expect(detectSleeve(padded('リバプール ユニフォーム XL/S'), normalizeLight('リバプール ユニフォーム XL/S'))).toBe(
      null,
    )
  })

  it('半袖と長袖が両方書かれていたら、どちらとも決めない', () => {
    const title = 'リバプール 25/26 ホーム レプリカ 半袖・長袖 取扱い adidas'
    expect(detectSleeve(padded(title), normalizeLight(title))).toBe(null)
  })

  it('略記 S/S は半袖として読む', () => {
    const title = 'リバプールFC 25/26 ホーム レプリカ S/S アディダス'
    expect(detectSleeve(padded(title), normalizeLight(title))).toBe('short')
  })
})

/* ============================================================
 * 17. マーキング（無地 / 選手名入り / 名入れ）
 * ========================================================== */

describe('★無地と選手名入りを混ぜない★', () => {
  /**
   * 実データでは、同じ品番のまま「No.11 モハメド・サラー」と付くだけで
   * 7,920円 → 14,410円 になりました。同じ商品として比べられません。
   */
  const markedTitles = [
    '●リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー【adidas/アディダス】(JV6423/11M_WH)',
    'リバプール 25-26 ホーム 半袖レプリカユニフォーム　7.フロリアン・ヴィルツ　【adidas|アディダス】クラブチームレプリカウェアーjyf22',
    '【スピード出荷】アディダス 25-26 リバプールFC #7 ヴィルツ ホームレプリカユニフォーム 大人用 サッカー レプリカシャツ 半袖 adidas JYF22-JV6423',
    'リバプール 25/26 ホーム 半袖 レプリカ 背番号入り マーキング入り adidas メンズ',
  ]

  for (const title of markedTitles) {
    it(`選手名入りを無地の候補にしない: ${title.slice(0, 26)}…`, () => {
      const result = judge(title, { priceJpy: 14_410 })

      expect(result.hardReject).toBe(true)
      expect(result.hardRejectCodes).toContain('personalizationMismatch')
      expect(isAutoAdoptable(result)).toBe(false)
    })
  }

  it('名入れ（購入者が指定）も無地の候補にしない', () => {
    const result = judge('リバプール 25/26 ホーム 半袖 レプリカ 名入れ adidas メンズ')

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
  })

  it('★無地の商品を誤って選手名入りと判定しない★', () => {
    const plainTitles = [
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      'アディダス adidas  リバプールFC 25/26 ホームジャージー  サッカー レプリカウェア  25AW(JYF22-JV6423)',
      'ウエア サッカー アディダス リバプール リヴァプールFC 25/26 レプリカ ホーム ユニフォーム LIVERPOOL JYF22-JV6423 adidas',
      'リバプール LFC 2025-26 レプリカ ホーム ユニフォーム JYF22-JV6423 サッカー 半袖 ストロベリーレッド アディダス adidas',
    ]

    for (const title of plainTitles) {
      const result = judge(title)
      expect(classifyPersonalization(padded(title), normalizeLight(title))).toBe('plain')
      expect(result.hardReject).toBe(false)
      expect(isAutoAdoptable(result)).toBe(true)
    }
  })

  it('同じ選手のマーキングどうしは一致してよい', () => {
    const product = baseProduct({
      player: 'モハメド・サラー',
      personalization: 'player-marked',
    })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor(
        '●リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー【adidas/アディダス】(JV6423/11M_WH)',
        { priceJpy: 14_410 },
      ),
    )

    expect(result.hardReject).toBe(false)
    expect(result.positiveEvidence.some((text) => text.includes('サラー'))).toBe(true)
    expect(isAutoAdoptable(result)).toBe(true)
  })

  it('★違う選手のマーキングを自動採用しない★', () => {
    const product = baseProduct({
      player: 'モハメド・サラー',
      personalization: 'player-marked',
    })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor(
        '【スピード出荷】アディダス 25-26 リバプールFC #7 ヴィルツ ホームレプリカユニフォーム 大人用 サッカー レプリカシャツ 半袖 adidas JYF22-JV6423',
        { priceJpy: 16_280 },
      ),
    )

    // 選手名を確かめられないので、採用しない
    expect(result.unknownAttributes).toContain('marking')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('選手名入りの商品に対して、無地の出品を採用しない', () => {
    const product = baseProduct({
      player: 'モハメド・サラー',
      personalization: 'player-marked',
    })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor(
        'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
        { priceJpy: 7_920 },
      ),
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
  })

  it('★「マーキング対応」「別売」は入っているとは限らないので、決めつけない★', () => {
    const undecidable = [
      'リバプール 25/26 ホーム 半袖 レプリカ adidas マーキング対応',
      'リバプール 25/26 ホーム 半袖 レプリカ adidas マーキング別売',
      'リバプール 25/26 ホーム 半袖 レプリカ adidas ネーム別売',
    ]

    for (const title of undecidable) {
      const result = judge(title)
      expect(classifyPersonalization(padded(title), normalizeLight(title))).toBe('unknown')
      // 落としも採用もせず、人の確認へ回す
      expect(result.hardReject).toBe(false)
      expect(result.requiresReview).toBe(true)
      expect(isAutoAdoptable(result)).toBe(false)
    }
  })

  it('★メーカー品番の数字を背番号と読み違えない★', () => {
    const titles = [
      'アディダス リバプールFC 25/26 ホームジャージー JV6423 JYF22 レプリカ 半袖',
      'リバプール 25/26 ホーム レプリカ 半袖 adidas JYF22-JV6423 サイズ 25.5',
    ]
    for (const title of titles) {
      expect(classifyPersonalization(padded(title), normalizeLight(title))).toBe('plain')
    }
  })
})

/* ============================================================
 * 18. メーカー品番（SKU）
 * ========================================================== */

describe('★メーカー品番が一致しても、矛盾があれば採用しない★', () => {
  /**
   * 品番は商品説明の中にたまたま混ざることがあります
   * （「※JV6423とは別商品です」「関連商品: JV6423」など）。
   * 品番が見つかったことを、他の食い違いより優先してはいけません。
   */
  const cases: { label: string; title: string; code: string }[] = [
    {
      label: '別クラブ',
      title: 'マンチェスターシティ 25/26 ホーム 半袖 レプリカ adidas JV6423',
      code: 'wrongClub',
    },
    {
      label: '別シーズン',
      title: 'リバプール 24/25 ホーム 半袖 レプリカ adidas JV6423',
      code: 'wrongSeason',
    },
    {
      label: '別の種類（アウェイ）',
      title: 'リバプール 25/26 アウェイ 半袖 レプリカ adidas JV6423',
      code: 'wrongKitType',
    },
    {
      label: '別の袖丈（長袖）',
      title: 'リバプール 25/26 ホーム 長袖 レプリカ adidas JV6423',
      code: 'sleeveMismatch',
    },
    {
      label: '選手名入り',
      title: 'リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423 No.11 サラー',
      code: 'personalizationMismatch',
    },
    {
      label: 'オーセンティック',
      title: 'リバプール 25/26 ホーム 半袖 オーセンティック adidas JV6423',
      code: 'authenticityMismatch',
    },
    {
      label: 'ジュニア用',
      title: 'ジュニア リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423',
      code: 'genderMismatch',
    },
  ]

  for (const testCase of cases) {
    it(`品番一致 + ${testCase.label} → 不採用（${testCase.code}）`, () => {
      const result = judge(testCase.title)

      expect(result.hardReject).toBe(true)
      expect(result.hardRejectCodes).toContain(testCase.code)
      expect(result.confidence).toBe(0)
      expect(isAutoAdoptable(result)).toBe(false)
    })
  }

  it('★品番だけではランクBにしない（クラブ・シーズン・種類が読めないとき）★', () => {
    // 品番以外に手掛かりが無い商品名
    const result = judge('サッカー レプリカシャツ JV6423 メンズ 半袖')

    expect(result.hardReject).toBe(false)
    expect(result.matchLevel).toBe('attributes')
    expect(result.grade).not.toBe('A')
    expect(result.grade).not.toBe('B')
    expect(result.requiresReview).toBe(true)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('品番 + クラブ + シーズンがそろえばランクB', () => {
    const result = judge('リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423 メンズ')

    expect(result.matchLevel).toBe('sku')
    expect(result.grade).toBe('B')
    expect(isAutoAdoptable(result)).toBe(true)
  })
})

/* ============================================================
 * 19. JANコード
 * ========================================================== */

describe('JANコードの扱い（一致 / 食い違い / 照合不能）', () => {
  it('JANが一致すればランクA', () => {
    const product = baseProduct({ jan: '4068809542110' })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor('リバプール 25/26 ホーム 半袖 レプリカ adidas メンズ', { jan: '4068809542110' }),
    )

    expect(result.janEvidence).toBe('exact')
    expect(result.matchLevel).toBe('jan')
    expect(result.grade).toBe('A')
  })

  it('★サイズごとのJANでも一致として扱う★', () => {
    // 国内ECのJANはサイズ単位で付くことが多い
    const product = baseProduct({ jan: '4068809542110' })
    const result = evaluateMatch(
      contextFor(product, { variantJans: ['4068809542127', '4068809542134'] }),
      candidateFor('リバプール 25/26 ホーム 半袖 レプリカ adidas メンズ', { jan: '4068809542127' }),
    )

    expect(result.janEvidence).toBe('exact')
    expect(result.grade).toBe('A')
  })

  it('JANが取れなければ「照合できなかった」として扱う（一致にしない）', () => {
    const result = judge('リバプール 25/26 ホーム 半袖 レプリカ adidas メンズ')

    expect(result.janEvidence).toBe('missing')
    expect(result.unknownAttributes).toContain('jan')
    expect(result.matchLevel).not.toBe('jan')
  })

  it('★JANが食い違っても、それだけでは不採用にしない★', () => {
    const product = baseProduct({ jan: '4068809542110' })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor('リバプール 25/26 ホーム 半袖 レプリカ adidas JV6423 メンズ', {
        jan: '4068809999999',
      }),
    )

    expect(result.janEvidence).toBe('conflicting')
    expect(result.hardReject).toBe(false)
    expect(result.hardRejectReasons).not.toContain('jan')
    // 食い違いは記録に残す
    expect(result.negativeEvidence.some((text) => text.includes('JAN'))).toBe(true)
  })

  it('★JANが一致していても、属性が食い違えば不採用★', () => {
    // 出品者が別商品へ同じJANを付けてしまうことがある。
    // 陽性の根拠に矛盾を上書きさせない。
    const product = baseProduct({ jan: '4068809542110' })
    const result = evaluateMatch(
      contextFor(product),
      candidateFor('リバプール 25/26 ホーム 長袖 レプリカ adidas メンズ', { jan: '4068809542110' }),
    )

    expect(result.janEvidence).toBe('exact')
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('sleeveMismatch')
    expect(result.confidence).toBe(0)
    expect(isAutoAdoptable(result)).toBe(false)
  })
})

/* ============================================================
 * 型が想定どおりに使えること
 * ========================================================== */

describe('データモデル', () => {
  it('袖丈は ノースリーブ も表せる', () => {
    const values: SleeveLength[] = ['short', 'long', 'sleeveless', null]
    expect(values).toHaveLength(4)
  })

  it('マーキングは4つの状態を表せる', () => {
    const values: Personalization[] = ['plain', 'player-marked', 'personalized', 'unknown']
    expect(values).toHaveLength(4)
  })

  it('personalization が未設定でも、選手名の有無から判断する', () => {
    // 無地として扱われる
    const plain = evaluateMatch(
      contextFor(baseProduct({ personalization: undefined })),
      candidateFor('リバプール 25/26 ホーム 半袖 レプリカ adidas No.11 サラー'),
    )
    expect(plain.hardRejectCodes).toContain('personalizationMismatch')

    // 選手名入りとして扱われる
    const marked = evaluateMatch(
      contextFor(baseProduct({ personalization: undefined, player: 'モハメド・サラー' })),
      candidateFor('リバプール 25/26 ホーム 半袖 レプリカ adidas No.11 モハメド・サラー'),
    )
    expect(marked.hardReject).toBe(false)
  })
})

/* ============================================================
 * セット商品（第4.6段階の実データ検証で見つけた誤一致）
 * ========================================================== */

describe('★セット商品を単品の候補にしない★', () => {
  /**
   * 実データで実際に採用されてしまっていた出品です。
   * クラブ・シーズン・種類・品番がすべて一致するため、
   * 属性だけでは単品のシャツと区別できませんでした。
   */
  it('シャツ＋ショーツの上下セットを、シャツ単体の候補にしない', () => {
    const result = evaluateMatch(
      contextFor(baseProduct({ gender: 'kids', manufacturerSku: 'JV6436' })),
      candidateFor(
        'adidas アディダス キッズ 25/26 LFC リバプールFC ホーム レプリカシャツ＆ショーツ JYF33/JV6436 JYF36/JV6441 上下セット セットアップ 赤 特価',
        { priceJpy: 10_780 },
      ),
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('bundleMismatch')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('福袋・2点セットも単品の候補にしない', () => {
    for (const title of [
      'リバプール 25/26 ホーム 半袖 レプリカ adidas 福袋',
      'リバプール 25/26 ホーム 半袖 レプリカ adidas 2点セット',
    ]) {
      const result = judge(title)
      expect(result.hardRejectCodes).toContain('bundleMismatch')
    }
  })

  it('★単品の出品をセットと読み違えない★', () => {
    // 「セット」という語を含まない普通の出品
    const result = judge(
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      { priceJpy: 7_920 },
    )

    expect(result.hardReject).toBe(false)
    expect(isAutoAdoptable(result)).toBe(true)
  })
})

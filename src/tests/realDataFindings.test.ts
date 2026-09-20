/**
 * 実データ（Yahoo!ショッピング）の検証で見つかった問題のテスト。
 *
 * 第4.5段階で、実際のAPIから取得した商品名を照合エンジンへかけたところ、
 * サンプルデータでは気付けなかった取り違えが見つかりました。
 * 同じ問題が再発しないよう、実際の商品名をそのままテストにしています。
 *
 * ★商品名は実在の出品から引用しています（価格・出品者名は含みません）。★
 *   照合の正しさを確かめる目的にのみ使い、再配布はしません。
 */

import { describe, expect, it } from 'vitest'
import type { Product } from '@/domain/types'
import { evaluateMatch, isAutoAdoptable, type MatchContext } from '@/lib/matching/engine'
import { hasMarkingIndicator } from '@/lib/matching/aliases'
import { normalizeLight } from '@/lib/matching/textNormalize'

/** 実データ検証で使った商品（リヴァプール 2025/26 ホーム 半袖 レプリカ）。 */
function liverpoolHome(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-lfc-2526-home-replica',
    clubId: 'club-liverpool',
    slug: 'liverpool-2025-26-home-replica',
    name: 'Liverpool FC 2025/26 Home Replica Shirt',
    nameJa: 'リヴァプール 2025/26 ホーム レプリカ ユニフォーム',
    season: '2025/26',
    // 2025/26 のサプライヤーは adidas（Nikeは2024/25まで）
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
    image: { src: '/x.svg', alt: 'x', width: 800, height: 800, source: 'placeholder' },
    active: true,
    ...overrides,
  }
}

const context: MatchContext = {
  product: liverpoolHome(),
  clubSlug: 'liverpool',
  referencePriceJpy: 15_830,
}

function judge(title: string, priceJpy = 9_240) {
  return evaluateMatch(context, {
    title,
    jan: null,
    brandName: 'adidas',
    condition: 'new',
    priceJpy,
  })
}

/* ============================================================
 * 発見1: 長袖と半袖を区別していなかった
 * ========================================================== */

describe('★発見1: 袖丈の取り違え★', () => {
  it('長袖（JV6456）を半袖（JV6423）の候補にしない', () => {
    const result = judge(
      'リバプール 25-26 ホーム 長袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf51-jv6456',
      10_010,
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('sleeve')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('半袖どうしは一致する', () => {
    const result = judge(
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      7_920,
    )

    expect(result.hardReject).toBe(false)
    expect(result.grade).toBe('B')
    expect(isAutoAdoptable(result)).toBe(true)
  })

  it('袖丈が書かれていなければ、食い違いとして扱わない', () => {
    const result = judge(
      'アディダス サッカー ライセンスシャツ リバプールFC 25/26 ホームジャージー JV6423 レプリカユニフォーム : レッド adidas',
      8_499,
    )

    expect(result.hardReject).toBe(false)
    expect(isAutoAdoptable(result)).toBe(true)
  })
})

/* ============================================================
 * 発見2: 「No.11 選手名」形式の背番号を検出できなかった
 * ========================================================== */

describe('★発見2: 背番号マーキングの見落とし★', () => {
  it('「No.11 選手名」を検出する', () => {
    const result = judge(
      '●リバプール 25-26 ホーム 半袖 ユニフォーム No.11 モハメド・サラー【adidas/アディダス】(JV6423/11M_WH)',
      14_410,
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('「7.選手名」形式も検出する', () => {
    // 「マーキング」「背番号」という語を一切使わない書き方
    const result = judge(
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　7.フロリアン・ヴィルツ　【adidas|アディダス】クラブチームレプリカウェアーjyf22',
      11_396,
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('「#7 選手名」形式も検出する', () => {
    const result = judge(
      '【スピード出荷】アディダス 25-26 リバプールFC #7 ヴィルツ ホームレプリカユニフォーム 大人用 サッカー レプリカシャツ 半袖 adidas JYF22-JV6423',
      16_280,
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('★無地の商品を誤ってマーキング入りと判定しない★', () => {
    const plainTitles = [
      'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      'アディダス adidas  リバプールFC 25/26 ホームジャージー  サッカー レプリカウェア  25AW(JYF22-JV6423)',
      'ウエア サッカー アディダス リバプール リヴァプールFC 25/26 レプリカ ホーム ユニフォーム LIVERPOOL JYF22-JV6423 adidas',
      'リバプール LFC 2025-26 レプリカ ホーム ユニフォーム JYF22-JV6423 サッカー 半袖 ストロベリーレッド アディダス adidas',
    ]

    for (const title of plainTitles) {
      expect(hasMarkingIndicator(normalizeLight(title))).toBe(false)
      expect(judge(title).requiresReview).toBe(false)
    }
  })

  it('サイズ表記（25.5cm など）をマーキングと誤検出しない', () => {
    expect(hasMarkingIndicator(normalizeLight('スパイク 25.5cm リバプール'))).toBe(false)
  })
})

/* ============================================================
 * 発見3: JANの不一致で同じ商品を取り逃がしていた
 * ========================================================== */

describe('★発見3: JANはサイズ単位で付くことがある★', () => {
  it('JANが違っても、それだけでは不採用にしない', () => {
    // 実データでは同じシャツでもサイズごとに別のJANが付いていた
    //   4068809542110（大人用ホーム） / 4068809503807（ジュニア）など
    const result = evaluateMatch(
      { ...context, product: liverpoolHome({ jan: '4068809542110' }) },
      {
        title:
          'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
        // 別サイズのJAN
        jan: '4068809542127',
        brandName: 'adidas',
        condition: 'new',
        priceJpy: 7_920,
      },
    )

    expect(result.hardReject).toBe(false)
    expect(result.hardRejectReasons).not.toContain('jan')
    // 品番が一致しているのでランクB
    expect(result.grade).toBe('B')
  })
})

/* ============================================================
 * 実データで正しく除外できていること
 * ========================================================== */

describe('実データでの除外（誤一致の防止）', () => {
  it('ジュニア用を大人用の候補にしない', () => {
    const result = judge(
      'ジュニア リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf33-jv6436',
      5_610,
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('gender')
  })

  it('キッズ用を大人用の候補にしない', () => {
    const result = judge(
      'アディダス　adidas tシャツ キッズ リバプールFC 25/26 ホーム レプリカユニフォーム / アディダス adidas キッズ 子供服 男の子 女の子',
      5_610,
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('gender')
  })

  it('アウェイをホームの候補にしない', () => {
    const result = judge(
      'アディダス サッカー ライセンスシャツ リバプールFC 25/26 アウェイ ジャージー JV6487 レプリカユニフォーム : ホワイト adidas',
      13_200,
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('kitType')
  })

  it('★「メンズ ジュニア」と併記された商品を子供用と決めつけない★', () => {
    // 実データにあった書き方。どちらとも取れるので判断を保留し、
    // メーカー品番（大人用 JV6423）で同定する。
    const result = judge(
      'アディダス(adidas) サッカーウェア レプリカシャツ メンズ ジュニア リバプールFC 25/26 ホームジャージー JV6423 JYF22',
      9_240,
    )

    expect(result.hardReject).toBe(false)
    const gender = result.signals.find((signal) => signal.dimension === 'gender')
    expect(gender?.verdict).toBe('unknown')
  })
})

/* ============================================================
 * 発見4: メーカーが違うと1件も見つからない
 * ========================================================== */

describe('★発見4: メーカーの誤りは照合を全滅させる★', () => {
  it('メーカーが違う商品はすべて不採用になる', () => {
    // 2025/26 のリヴァプールは adidas。Nike としていると実データと全く合わない。
    const wrongManufacturer: MatchContext = {
      ...context,
      product: liverpoolHome({ manufacturer: 'Nike' }),
    }

    const result = evaluateMatch(wrongManufacturer, {
      title:
        'リバプール 25-26 ホーム 半袖レプリカユニフォーム　【adidas|アディダス】クラブチームレプリカウェアーjyf22-jv6423',
      jan: null,
      brandName: 'adidas',
      condition: 'new',
      priceJpy: 7_920,
    })

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('manufacturer')
  })
})

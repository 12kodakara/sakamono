/**
 * fixture を通した価格計算の総合テスト。
 *
 * 個々の計算は各サービスのテストで確かめているので、
 * ここでは「データを入れると設計どおりの結果になるか」を確かめる。
 *
 * 第2段階の指示書にある6つのケースをすべて含む。
 *
 *   ケースA … 海外購入がかなり安い
 *   ケースB … 国内購入の方が安い
 *   ケースC … 送料不明
 *   ケースD … 国内商品の confidence 不足
 *   ケースE … セールなし
 *   ケースF … Authentic / Replica 違いで比較対象外
 */

import { describe, expect, it } from 'vitest'
import {
  getPriceHistory,
  getProductViewBySlug,
  listPriceGapRanking,
  listProductViews,
  listSaleProductViews,
} from '@/data/repository'
import type { ProductView } from '@/data/viewModels'

async function view(slug: string): Promise<ProductView> {
  const result = await getProductViewBySlug(slug)
  if (!result) throw new Error(`商品が見つかりません: ${slug}`)
  return result
}

/* ============================================================
 * ケースA: 海外購入がかなり安い
 * ========================================================== */

describe('ケースA: 海外購入がかなり安い', () => {
  it('日本到着推定額が国内価格を大きく下回る', async () => {
    const v = await view('liverpool-2024-25-home-replica')

    expect(v.overseas?.landedCost.status).toBe('estimated')
    expect(v.overseas?.landedCost.totalJpy).toBe(12_066)
    expect(v.comparison.domesticPrice.referencePriceJpy).toBe(17_800)
    expect(v.comparison.comparisonStatus).toBe('valid')
    expect(v.comparison.advantage).toBe('overseas')
    expect(v.comparison.priceDifferenceJpy).toBe(5_734)
    expect(v.comparison.savingRate).toBeGreaterThan(30)
  })

  it('大きく値下げされているのでセール扱いになる', async () => {
    const v = await view('liverpool-2024-25-home-replica')
    expect(v.overseas?.discount.isSale).toBe(true)
    expect(v.overseas?.discount.percent).toBe(53)
  })
})

/* ============================================================
 * ケースB: 国内購入の方が安い
 * ========================================================== */

describe('ケースB: 国内購入の方が安い', () => {
  it('価格差がマイナスになり、国内が安いと判定される', async () => {
    const v = await view('liverpool-2025-26-away-authentic')

    expect(v.comparison.comparisonStatus).toBe('valid')
    expect(v.comparison.priceDifferenceJpy).toBe(-2_121)
    expect(v.comparison.advantage).toBe('domestic')
  })

  it('価格差ランキングには載らない', async () => {
    const ranking = await listPriceGapRanking()
    expect(ranking.map((v) => v.product.slug)).not.toContain(
      'liverpool-2025-26-away-authentic',
    )
  })
})

/* ============================================================
 * ケースC: 送料不明
 * ========================================================== */

describe('ケースC: 送料不明', () => {
  it('★日本到着推定額を算出しない（0円で埋めない）★', async () => {
    const v = await view('tottenham-2025-26-away-replica')
    const landed = v.overseas?.landedCost

    expect(landed?.shippingJpy).toBeNull()
    expect(landed?.totalJpy).toBeNull()
    expect(landed?.status).toBe('incomplete')
    expect(landed?.missing).toEqual(['shipping'])
  })

  it('送料を除く参考額は出せる', async () => {
    const v = await view('tottenham-2025-26-away-replica')
    expect(v.overseas?.landedCost.partialTotalJpy).toBe(13_143)
  })

  it('価格差は出さず、ランキングにも載らない', async () => {
    const v = await view('tottenham-2025-26-away-replica')
    expect(v.comparison.priceDifferenceJpy).toBeNull()
    expect(v.comparison.comparisonStatus).toBe('insufficient-data')

    const ranking = await listPriceGapRanking()
    expect(ranking.map((x) => x.product.slug)).not.toContain('tottenham-2025-26-away-replica')
  })

  it('★送料不明で商品代が安い掲載より、総額を出せる掲載を優先する★', async () => {
    // FCバルセロナのホームは、公式（総額を出せる）と
    // 海外セレクトショップC（商品代は安いが送料不明）の2つに掲載がある
    const v = await view('fc-barcelona-2025-26-home-replica')

    expect(v.overseasOffers).toHaveLength(2)
    expect(v.overseas?.store.id).toBe('store-fcb-official')
    expect(v.overseas?.landedCost.totalJpy).toBe(23_409)

    const cheaperItem = v.overseasOffers.find((o) => o.store.id === 'store-select-c')
    expect(cheaperItem?.landedCost.productPriceJpy).toBeLessThan(
      v.overseas?.landedCost.productPriceJpy ?? 0,
    )
    expect(cheaperItem?.landedCost.totalJpy).toBeNull()
  })
})

/* ============================================================
 * ケースD: 国内商品の confidence 不足
 * ========================================================== */

describe('ケースD: 国内商品の confidence 不足', () => {
  it('国内掲載はあるが、比較対象として採用しない', async () => {
    const v = await view('tottenham-2025-26-scarf')

    expect(v.comparison.domesticPrice.examinedCount).toBe(1)
    expect(v.comparison.domesticPrice.offerCount).toBe(0)
    expect(v.comparison.domesticPrice.referencePriceJpy).toBeNull()
    expect(v.comparison.comparisonStatus).toBe('low-confidence')
    expect(v.comparison.priceDifferenceJpy).toBeNull()
  })

  it('除外理由に信頼度不足が含まれる', async () => {
    const v = await view('tottenham-2025-26-scarf')
    const reasons = v.comparison.domesticPrice.excluded.flatMap((e) => e.reasons)
    expect(reasons).toContain('low-confidence')
  })
})

/* ============================================================
 * ケースE: セールなし
 * ========================================================== */

describe('ケースE: セールなし', () => {
  it('通常価格と同額なのでセール扱いにしない', async () => {
    const v = await view('real-madrid-2025-26-home-replica')

    expect(v.overseas?.listing.currentPrice).toBe(v.overseas?.listing.regularPrice)
    expect(v.overseas?.discount.isSale).toBe(false)
    expect(v.overseas?.discount.status).toBe('no-discount')
    expect(v.overseas?.discount.rate).toBe(0)
  })

  it('セール一覧に載らない', async () => {
    const sale = await listSaleProductViews()
    expect(sale.map((v) => v.product.slug)).not.toContain('real-madrid-2025-26-home-replica')
  })

  it('セールでなくても価格差の比較はできる', async () => {
    const v = await view('real-madrid-2025-26-home-replica')
    expect(v.comparison.comparisonStatus).toBe('valid')
    expect(v.comparison.priceDifferenceJpy).toBe(1_231)
  })
})

/* ============================================================
 * ケースF: Authentic / Replica 違いで比較対象外
 * ========================================================== */

describe('ケースF: Authentic / Replica 違い', () => {
  it('★レプリカの国内掲載をオーセンティックの比較に使わない★', async () => {
    const v = await view('real-madrid-2025-26-home-authentic')
    const excluded = v.comparison.domesticPrice.excluded

    expect(excluded).toHaveLength(1)
    expect(excluded[0].reasons).toContain('variant-mismatch')
    expect(excluded[0].variantMismatches).toContain('authenticity')
    // 信頼度そのものはランクBで足りている（属性の食い違いで外している）
    expect(excluded[0].candidate.grade).toBe('B')
  })

  it('正しい国内掲載だけを使って比較する', async () => {
    const v = await view('real-madrid-2025-26-home-authentic')

    expect(v.comparison.domesticPrice.examinedCount).toBe(2)
    expect(v.comparison.domesticPrice.offerCount).toBe(1)
    expect(v.comparison.domesticPrice.referencePriceJpy).toBe(35_350)
    expect(v.comparison.priceDifferenceJpy).toBe(1_963)
  })

  it('取り違えていたら出ていたはずの誤った差額にならない', async () => {
    const v = await view('real-madrid-2025-26-home-authentic')
    // レプリカの掲載（20,900円）を使っていれば -12,487円 になっていた
    expect(v.comparison.priceDifferenceJpy).not.toBe(20_900 - 33_387)
    expect(v.comparison.advantage).toBe('overseas')
  })
})

/* ============================================================
 * 国内価格の選択（最安値をそのまま使わない）
 * ========================================================== */

describe('国内価格の選択', () => {
  /*
   * ★「極端に安いフリマ出品を採用しない」の確認は、ここには置いていません。★
   *   使っていたサンプル掲載は、公式確認済みの商品（JV6423）から
   *   開発用のダミーを取り除いたときに削除しました。
   *   同じ規則は src/tests/domesticPrice.test.ts が単体で確かめています
   *   （モール型＋人の確認なし → 'untrusted-store' で除外）。
   *   取得から表示までの通し確認は、下の在庫切れの例が受け持ちます。
   */

  it('在庫切れの国内掲載を採用しない', async () => {
    const v = await view('fc-barcelona-2025-26-home-replica')
    const reasons = v.comparison.domesticPrice.excluded.flatMap((e) => e.reasons)

    expect(reasons).toContain('out-of-stock')
    expect(v.comparison.domesticPrice.referencePriceJpy).toBe(24_800)
  })
})

/* ============================================================
 * 一覧・ランキング・履歴
 * ========================================================== */

describe('一覧とランキング', () => {
  it('価格差ランキングは、比較できて海外が安いものだけを差額の大きい順に並べる', async () => {
    const ranking = await listPriceGapRanking()

    for (const v of ranking) {
      expect(v.comparison.comparisonStatus).toBe('valid')
      expect(v.comparison.advantage).toBe('overseas')
      expect(v.comparison.priceDifferenceJpy).toBeGreaterThan(0)
    }

    const diffs = ranking.map((v) => v.comparison.priceDifferenceJpy ?? 0)
    expect([...diffs].sort((a, b) => b - a)).toEqual(diffs)
    expect(ranking[0].product.slug).toBe('liverpool-2024-25-home-replica')
  })

  it('セール一覧は値下げ中のものだけを割引率の高い順に並べる', async () => {
    const sale = await listSaleProductViews()

    for (const v of sale) {
      expect(v.overseas?.discount.isSale).toBe(true)
    }

    const rates = sale.map((v) => v.overseas?.discount.rate ?? 0)
    expect([...rates].sort((a, b) => b - a)).toEqual(rates)
  })

  it('すべての商品で、合計を出せない場合は必ず totalJpy が null になる', async () => {
    const views = await listProductViews()

    for (const v of views) {
      const landed = v.overseas?.landedCost
      if (!landed) continue
      if (landed.missing.length > 0) {
        expect(landed.totalJpy).toBeNull()
      } else {
        expect(landed.totalJpy).not.toBeNull()
      }
    }
  })

  it('価格差を表示している商品は、必ず国内比較価格を持っている', async () => {
    const views = await listProductViews()

    for (const v of views) {
      if (v.comparison.priceDifferenceJpy === null) continue
      expect(v.comparison.domesticPrice.referencePriceJpy).not.toBeNull()
      expect(v.comparison.landedCost?.totalJpy).not.toBeNull()
      expect(v.comparison.domesticConfidence).not.toBeNull()
    }
  })

  it('価格履歴のまとめを取得できる', async () => {
    const v = await view('liverpool-2024-25-home-replica')
    const history = await getPriceHistory(v)

    expect(history.overseas.summary.pointCount).toBe(6)
    expect(history.overseas.summary.currentPrice?.amount).toBe(44.95)
    expect(history.overseas.summary.lowestPrice?.amount).toBe(44.95)
    expect(history.overseas.summary.highestPrice?.amount).toBe(94.95)
    expect(history.overseas.summary.isAtLowest).toBe(true)
    expect(history.overseas.summary.latestChange?.trend).toBe('down')
  })

  it('価格の鮮度を持っている（古い価格を将来警告できるように）', async () => {
    const views = await listProductViews()

    for (const v of views) {
      if (!v.overseas) continue
      expect(v.overseas.freshness.ageDays).not.toBeNull()
      expect(['fresh', 'aging', 'stale']).toContain(v.overseas.freshness.level)
      expect(v.saleSignals.freshness).toBe(v.overseas.freshness.level)
    }
  })
})

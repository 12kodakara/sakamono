/**
 * 商品照合エンジンのテスト。
 *
 * ★このテストの主眼は「一致を見つけること」ではなく、
 *   「別商品を同じ商品と判定しないこと」★
 *
 * レプリカ／オーセンティック、ホーム／アウェイ、子供用／大人用、
 * 別クラブ、別シーズン、別メーカーの取り違えは、
 * そのまま誤った価格比較になります。
 */

import { describe, expect, it } from 'vitest'
import type { Product } from '@/domain/types'
import {
  ATTRIBUTE_ONLY_MAX_CONFIDENCE,
  evaluateMatch,
  isAutoAdoptable,
  type MatchCandidate,
  type MatchContext,
} from '@/lib/matching/engine'
import {
  containsTerm,
  extractSeasons,
  isEanUsableAsJan,
  normalizeCode,
  normalizeSeason,
  normalizeText,
  padded,
} from '@/lib/matching/textNormalize'
import { CLUB_ALIASES, manufacturerAliases } from '@/lib/matching/aliases'

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

function context(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    product: makeProduct(),
    clubSlug: 'liverpool',
    referencePriceJpy: 20000,
    ...overrides,
  }
}

function candidate(overrides: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    title: 'リバプール 25/26 ホーム レプリカ ユニフォーム ナイキ メンズ',
    jan: '4999999999999',
    brandName: 'ナイキ',
    condition: 'new',
    priceJpy: 21800,
    ...overrides,
  }
}

/* ============================================================
 * 文字列の正規化
 * ========================================================== */

describe('商品名の正規化', () => {
  it('全角・半角と大文字・小文字をそろえる', () => {
    expect(normalizeText('ＬＩＶＥＲＰＯＯＬ')).toBe('liverpool')
    expect(normalizeText('ﾅｲｷ')).toBe('ナイキ')
    expect(normalizeText('  Nike   Air  ')).toBe('nike air')
  })

  it('ハイフンに見える記号をそろえる（長音符は変えない）', () => {
    expect(normalizeText('25–26')).toBe('25-26')
    expect(normalizeText('25−26')).toBe('25-26')
    // ★「アウェー」の長音符をハイフンにしてしまわないこと★
    expect(normalizeText('アウェー')).toBe('アウェー')
  })

  it('記号を空白へ置き換える', () => {
    expect(normalizeText('リバプール【正規品】')).toBe('リバプール 正規品')
  })

  it('英語の語は区切りで探す（別の語に埋もれない）', () => {
    expect(containsTerm(padded('nike air max'), 'nike')).toBe(true)
    // 'men' が 'women' の一部として誤検出されないこと
    expect(containsTerm(padded('womens shirt'), 'men')).toBe(false)
  })
})

describe('シーズンの正規化', () => {
  it('いろいろな書き方を同じ形にする', () => {
    expect(normalizeSeason('25/26')).toBe('2025/26')
    expect(normalizeSeason('2025/26')).toBe('2025/26')
    expect(normalizeSeason('2025-26')).toBe('2025/26')
    expect(normalizeSeason('25-26')).toBe('2025/26')
  })

  it('★24/25 と 25/26 を同じにしない★', () => {
    expect(normalizeSeason('24/25')).toBe('2024/25')
    expect(normalizeSeason('24/25')).not.toBe(normalizeSeason('25/26'))
  })

  it('連続しない年の組み合わせは採用しない', () => {
    expect(normalizeSeason('2025/28')).toBeNull()
    expect(normalizeSeason('10/40')).toBeNull()
  })

  it('商品名から複数のシーズンを拾える', () => {
    expect(extractSeasons('リバプール 25/26 ホーム').sort()).toEqual(['2025/26'])
    expect(extractSeasons('24/25 と 25/26 対応').sort()).toEqual(['2024/25', '2025/26'])
    expect(extractSeasons('リバプール ホーム')).toEqual([])
  })
})

describe('商品コード', () => {
  it('記号や大文字小文字の違いを吸収する', () => {
    expect(normalizeCode('jv-6423')).toBe('JV6423')
    expect(normalizeCode('JV 6423')).toBe('JV6423')
  })

  it('★EANだからといって自動的にJAN扱いしない★', () => {
    // 日本の国コード（45 / 49）で始まるものだけ国内JANとして使える
    expect(isEanUsableAsJan('4901234567894')).toBe(true)
    expect(isEanUsableAsJan('4512345678901')).toBe(true)
    // 英国で採番されたEAN
    expect(isEanUsableAsJan('5012345678900')).toBe(false)
    // 店舗内管理用の予約番号
    expect(isEanUsableAsJan('2000000000017')).toBe(false)
    expect(isEanUsableAsJan(null)).toBe(false)
  })
})

describe('言い換え辞書', () => {
  it('クラブ名の言い換えを持っている', () => {
    expect(CLUB_ALIASES.liverpool).toContain('リバプール')
    expect(CLUB_ALIASES.liverpool).toContain('リヴァプール')
  })

  it('メーカー名の言い換えを持っている', () => {
    expect(manufacturerAliases('Nike')).toContain('ナイキ')
    expect(manufacturerAliases('adidas')).toContain('アディダス')
  })
})

/* ============================================================
 * 一致の判定
 * ========================================================== */

describe('一致（採用されるべきもの）', () => {
  it('JANが一致し、属性も食い違わなければランクA', () => {
    const result = evaluateMatch(context(), candidate())

    expect(result.hardReject).toBe(false)
    expect(result.requiresReview).toBe(false)
    expect(result.grade).toBe('A')
    expect(result.matchLevel).toBe('jan')
    expect(result.verification).toBe('automated')
    expect(isAutoAdoptable(result)).toBe(true)
  })

  it('日本語のクラブ名・メーカー名でも一致する', () => {
    const result = evaluateMatch(
      context(),
      candidate({ title: 'リヴァプール 2025-26 ホーム レプリカ ナイキ メンズ' }),
    )
    expect(result.hardReject).toBe(false)
    expect(result.grade).toBe('A')
  })

  it('メーカー品番が商品名に入っていればランクB（JANなし）', () => {
    const result = evaluateMatch(
      context({ product: makeProduct({ jan: null }) }),
      candidate({
        jan: null,
        title: 'リバプール 25/26 ホーム レプリカ JV6423 ナイキ メンズ',
      }),
    )

    expect(result.matchLevel).toBe('sku')
    expect(result.grade).toBe('B')
    expect(result.verification).toBe('automated')
  })
})

describe('★hardReject（別商品として扱うもの）★', () => {
  const noJan = context({ product: makeProduct({ jan: null }) })

  it('別クラブ', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, title: 'マンチェスターユナイテッド 25/26 ホーム レプリカ ナイキ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('club')
    expect(result.confidence).toBe(0)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('別シーズン', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, title: 'リバプール 24/25 ホーム レプリカ ナイキ メンズ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('season')
  })

  it('レプリカ と オーセンティック', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, title: 'リバプール 25/26 ホーム オーセンティック ナイキ メンズ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('authenticity')
  })

  it('ホーム と アウェイ', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, title: 'リバプール 25/26 アウェイ レプリカ ナイキ メンズ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('kitType')
  })

  it('大人用 と 子供用', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, title: 'リバプール 25/26 ホーム レプリカ ジュニア キッズ ナイキ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('gender')
  })

  it('別メーカー（adidas に Nike を一致させない）', () => {
    const result = evaluateMatch(
      noJan,
      candidate({
        jan: null,
        brandName: 'アディダス',
        title: 'リバプール 25/26 ホーム レプリカ アディダス メンズ',
      }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('manufacturer')
  })

  it('中古品', () => {
    const result = evaluateMatch(noJan, candidate({ jan: null, condition: 'used' }))
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('condition')
  })

  it('商品名に「中古」と書かれている場合も同じ', () => {
    const result = evaluateMatch(
      noJan,
      candidate({ jan: null, condition: 'new', title: 'リバプール 25/26 ホーム レプリカ 中古' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('condition')
  })

  it('★JANの不一致は不採用理由にしない（サイズ違いで別JANになるため）★', () => {
    // 実データ検証で判明: 国内ECのJANはサイズ単位で付いていることが多く、
    // 同じシャツでもサイズごとに別のJANになる。
    // 「JANが違う＝別商品」とすると同じ商品を大量に取り逃がす。
    const result = evaluateMatch(context(), candidate({ jan: '4068809542110' }))

    expect(result.hardReject).toBe(false)
    expect(result.hardRejectReasons).not.toContain('jan')

    // 一致していないので、JANを根拠にランクAへは上げない
    expect(result.matchLevel).not.toBe('jan')
  })

  it('JANが一致すれば強い根拠として使う', () => {
    const result = evaluateMatch(context(), candidate())
    expect(result.matchLevel).toBe('jan')
    expect(result.grade).toBe('A')
  })
})

describe('★要確認（自動採用しないが捨てない）★', () => {
  it('★JANが一致していても、属性が食い違えば不採用★', () => {
    // モール型では出品者が別商品へ同じJANを付けてしまうことがある。
    // 第4.6段階で方針を変えたところ:
    //   以前は「JANが一致しているのだから」と要確認へ回していたが、
    //   陽性の根拠（JAN・品番）に矛盾を上書きさせると、そこから誤一致が入る。
    //   レプリカとオーセンティックは1万円以上違う別商品なので、不採用にする。
    const result = evaluateMatch(
      context(),
      candidate({ title: 'リバプール 25/26 ホーム オーセンティック ナイキ メンズ' }),
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('authenticity')
    expect(result.hardRejectCodes).toContain('authenticityMismatch')
    expect(result.confidence).toBe(0)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('★相場より極端に安い出品は、安さを理由に採用しない★', () => {
    const result = evaluateMatch(context({ referencePriceJpy: 20000 }), candidate({ priceJpy: 1980 }))

    expect(result.requiresReview).toBe(true)
    expect(result.reviewReasons.some((reason) => reason.includes('安すぎ'))).toBe(true)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('マーキングの有無が読み取れないものは自動採用しない', () => {
    // 「マーキング対応」「別売」は、商品そのものに入っているとは限らない。
    // 断定して落とすと無地の商品まで取り逃がすので、人の確認へ回す。
    const result = evaluateMatch(
      context(),
      candidate({ title: 'リバプール 25/26 ホーム レプリカ ナイキ マーキング対応' }),
    )

    expect(result.hardReject).toBe(false)
    expect(result.requiresReview).toBe(true)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('★選手名入りは無地と同じ価格で比べない（不採用）★', () => {
    const result = evaluateMatch(
      context(),
      candidate({ title: 'リバプール 25/26 ホーム レプリカ 背番号 マーキング入り ナイキ' }),
    )

    expect(result.hardReject).toBe(true)
    expect(result.hardRejectCodes).toContain('personalizationMismatch')
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('★新品かどうか分からないものを新品として採用しない★', () => {
    const result = evaluateMatch(context(), candidate({ condition: 'unknown' }))

    expect(result.requiresReview).toBe(true)
    expect(result.verification).toBe('none')
    expect(isAutoAdoptable(result)).toBe(false)
  })
})

describe('★属性一致だけでは自動採用しない（Level 4 は候補発見用）★', () => {
  it('すべての属性が一致してもランクCどまり', () => {
    const result = evaluateMatch(
      context({ product: makeProduct({ jan: null, manufacturerSku: null }) }),
      candidate({ jan: null }),
    )

    expect(result.matchLevel).toBe('attributes')
    expect(result.confidence).toBeLessThanOrEqual(ATTRIBUTE_ONLY_MAX_CONFIDENCE)
    expect(result.grade).toBe('C')
    expect(isAutoAdoptable(result)).toBe(false)
  })
})

describe('判断できない項目の扱い', () => {
  it('★書かれていないものを「一致」にしない★', () => {
    const result = evaluateMatch(
      context({ product: makeProduct({ jan: null, manufacturerSku: null }) }),
      candidate({ jan: null, brandName: null, title: 'リバプール ユニフォーム' }),
    )

    const verdict = (dimension: string) =>
      result.signals.find((signal) => signal.dimension === dimension)?.verdict

    expect(verdict('season')).toBe('unknown')
    expect(verdict('kitType')).toBe('unknown')
    expect(verdict('authenticity')).toBe('unknown')
    expect(result.hardReject).toBe(false)
    expect(isAutoAdoptable(result)).toBe(false)
  })

  it('レプリカ／オーセンティックの区別が無い商品では該当なしにする', () => {
    const result = evaluateMatch(
      context({ product: makeProduct({ authenticity: null, kitType: null, category: 'scarves' }) }),
      candidate({ title: 'リバプール マフラー' }),
    )
    const authenticity = result.signals.find((signal) => signal.dimension === 'authenticity')
    expect(authenticity?.verdict).toBe('not-applicable')
  })

  it('自社側の対象が未確認でも、相手が子供用なら食い違いとして扱う', () => {
    const result = evaluateMatch(
      context({ product: makeProduct({ jan: null, gender: 'unknown' }) }),
      candidate({ jan: null, title: 'リバプール 25/26 ホーム レプリカ キッズ ナイキ' }),
    )
    expect(result.hardReject).toBe(true)
    expect(result.hardRejectReasons).toContain('gender')
  })
})

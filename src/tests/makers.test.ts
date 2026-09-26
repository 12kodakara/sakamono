/**
 * メーカー表示の組み立て（src/lib/makers.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・品番を確認できた商品からだけ拾う（'確認中' やクラブ名を持ち込まない）
 *   ・2つ以上あるときはシーズンを添える（前のシーズンの商品を買う事故を防ぐ）
 *   ・1つだけのときは余計な情報を足さない
 *   ・新しいシーズンのメーカーを先に出す
 *
 * クラブページ・リーグページの両方がこの関数を使います。
 */

import { describe, expect, it } from 'vitest'
import { formatMakers, summarizeConfirmedMakers } from '@/lib/makers'
import type { ProductView } from '@/data/viewModels'

/** 必要な項目だけ持つ、テスト用の最小の ProductView。 */
function view(manufacturer: string, season: string | null, manufacturerSku: string | null) {
  return {
    product: { manufacturer, season, manufacturerSku },
  } as unknown as ProductView
}

describe('メーカーの集計', () => {
  it('品番の無い商品は数えない', () => {
    const summaries = summarizeConfirmedMakers([
      view('adidas', '2025/26', 'JV6423'),
      view('確認中', '2025/26', null),
      view('Tottenham Hotspur', '2025/26', null),
    ])
    expect(summaries.map((entry) => entry.maker)).toEqual(['adidas'])
  })

  it('確認できた商品が無ければ空', () => {
    expect(summarizeConfirmedMakers([view('確認中', '2025/26', null)])).toEqual([])
    expect(summarizeConfirmedMakers([])).toEqual([])
  })

  it('同じメーカーのシーズンをまとめ、新しい順に並べる', () => {
    const summaries = summarizeConfirmedMakers([
      view('Nike', '2024/25', 'FN8798-688'),
      view('Nike', '2025/26', 'HJ4598-101'),
    ])
    expect(summaries).toEqual([{ maker: 'Nike', seasons: ['2025/26', '2024/25'] }])
  })

  it('新しいシーズンを持つメーカーを先に出す', () => {
    const summaries = summarizeConfirmedMakers([
      view('Nike', '2024/25', 'FN8798-688'),
      view('adidas', '2025/26', 'JV6423'),
    ])
    expect(summaries.map((entry) => entry.maker)).toEqual(['adidas', 'Nike'])
  })

  it('シーズン未設定の商品も、メーカーだけは数える', () => {
    const summaries = summarizeConfirmedMakers([view('PUMA', null, '779962_01')])
    expect(summaries).toEqual([{ maker: 'PUMA', seasons: [] }])
  })
})

describe('メーカーの表示文', () => {
  it('無ければ null', () => {
    expect(formatMakers([])).toBeNull()
  })

  it('1つだけならメーカー名だけ（シーズンを添えない）', () => {
    expect(formatMakers([{ maker: 'PUMA', seasons: ['2025/26'] }])).toBe('PUMA')
  })

  it('★2つ以上ならシーズンを添える★', () => {
    // サプライヤーはシーズンで変わるので、どちらのシーズンのものか分かるようにする
    expect(
      formatMakers([
        { maker: 'adidas', seasons: ['2025/26'] },
        { maker: 'Nike', seasons: ['2024/25'] },
      ]),
    ).toBe('adidas（2025/26）・Nike（2024/25）')
  })

  it('1メーカーが複数シーズンを持つ場合も並べる', () => {
    expect(
      formatMakers([
        { maker: 'adidas', seasons: ['2025/26'] },
        { maker: 'Nike', seasons: ['2025/26', '2024/25'] },
      ]),
    ).toBe('adidas（2025/26）・Nike（2025/26・2024/25）')
  })

  it('シーズンが分からないメーカーは名前だけにする', () => {
    expect(
      formatMakers([
        { maker: 'adidas', seasons: ['2025/26'] },
        { maker: 'PUMA', seasons: [] },
      ]),
    ).toBe('adidas（2025/26）・PUMA')
  })
})

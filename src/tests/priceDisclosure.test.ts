/**
 * 出典を確認できていない価格の公開可否（src/lib/priceDisclosure.ts）のテスト。
 *
 * ★守りたいこと★
 *   ・サンプル価格を、公開する画面へ出さない
 *   ・手元の確認（開発・テスト）では今まで通り価格が出る
 *   ・実データに入れ替われば、価格表示が自動で戻る
 */

import { describe, expect, it } from 'vitest'
import { canPublishPrices, priceWithholdReason } from '@/lib/priceDisclosure'

describe('価格を公開してよいかの判定', () => {
  it('★公開ビルド × サンプルデータ → 出さない★', () => {
    // 売っていない値段を売値のように見せないため
    expect(priceWithholdReason({ isSampleData: true, isPublicBuild: true })).toBe(
      'unverified-sample',
    )
    expect(canPublishPrices({ isSampleData: true, isPublicBuild: true })).toBe(false)
  })

  it('公開ビルド × 実データ → 出す', () => {
    expect(priceWithholdReason({ isSampleData: false, isPublicBuild: true })).toBeNull()
    expect(canPublishPrices({ isSampleData: false, isPublicBuild: true })).toBe(true)
  })

  it('★手元の確認（公開ビルドでない）では、サンプルでも価格を出す★', () => {
    // 数字が見えないと、計算が合っているかを目で確かめられないため
    expect(priceWithholdReason({ isSampleData: true, isPublicBuild: false })).toBeNull()
    expect(canPublishPrices({ isSampleData: true, isPublicBuild: false })).toBe(true)
  })

  it('手元 × 実データ → 出す', () => {
    expect(canPublishPrices({ isSampleData: false, isPublicBuild: false })).toBe(true)
  })

  it('公開ビルドかどうかを省略したときは、site.ts の設定に従う', () => {
    // テスト実行時は NEXT_PUBLIC_SITE_PREVIEW を渡していないので「公開ではない」側。
    // つまり価格は出る＝これまでのテストの前提が変わらない。
    expect(canPublishPrices({ isSampleData: true })).toBe(true)
  })
})

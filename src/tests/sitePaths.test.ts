/**
 * 置き場所（basePath）まわりのテスト。
 *
 * ★ここが壊れると、画像だけが静かに404になります。★
 *   ページは表示されるので気付きにくく、
 *   「なんとなく崩れている」状態のまま公開されがちです。
 *
 * GitHub Pages の project site では /sakamono/ 配下に置かれます。
 * 将来 独自ドメインへ移せば / 直下に戻ります。
 * どちらでも同じコードで動くことを確かめます。
 */

import { describe, expect, it } from 'vitest'
import { assetPath, BASE_PATH } from '@/lib/site'

describe('assetPath（静的ファイルのURL）', () => {
  it('置き場所が / 直下なら、そのまま返す', () => {
    // テスト実行時は NEXT_PUBLIC_BASE_PATH 未設定＝ローカル開発と同じ状態
    expect(BASE_PATH).toBe('')
    expect(assetPath('/images/placeholder-kit-home.svg')).toBe(
      '/images/placeholder-kit-home.svg',
    )
  })

  it('★外部URLやデータURIは書き換えない★', () => {
    // 将来ここへ外部の画像URLが入っても壊れないこと
    expect(assetPath('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(assetPath('data:image/svg+xml;base64,AAAA')).toBe('data:image/svg+xml;base64,AAAA')
    expect(assetPath('images/relative.svg')).toBe('images/relative.svg')
  })
})

describe('★データ側に置き場所を混ぜない★', () => {
  it('fixtureの画像パスは / 始まりのまま持つ', async () => {
    // 置き場所は表示のときに決まるもの。
    // fixtureへ '/sakamono/' が混ざると、独自ドメインへ移すときに
    // データを作り直すことになる。
    const { productFixtures } = await import('@/data/fixtures/products')

    for (const product of productFixtures) {
      expect(product.image.src.startsWith('/images/')).toBe(true)
      expect(product.image.src).not.toContain('sakamono')
      expect(product.image.src).not.toContain('github.io')
    }
  })
})

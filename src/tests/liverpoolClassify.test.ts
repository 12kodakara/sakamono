/**
 * 商品分類のテスト。
 *
 * ★このテストの主眼は「正しく分類できること」ではなく、
 *   「分からないものを分かったことにしていないこと」★
 *
 * レプリカ／オーセンティック、シーズン、対象の取り違えは、
 * そのまま誤った価格比較につながる。
 */

import { describe, expect, it } from 'vitest'
import {
  classifyAuthenticity,
  classifyCategory,
  classifyFromTitle,
  classifyGender,
  classifyKitType,
  classifySeason,
  classifySleeve,
  normalizeProductUrl,
} from '@/data/external/liverpool/classify'

describe('カテゴリ', () => {
  it('ユニフォームを見分ける', () => {
    expect(classifyCategory('LFC 25/26 Home Replica Shirt')).toBe('kits')
    expect(classifyCategory('LFC Away Jersey 25/26')).toBe('kits')
    expect(classifyCategory('LFC Goalkeeper Shirt')).toBe('kits')
  })

  it('トレーニングウェアを見分ける', () => {
    expect(classifyCategory('LFC 25/26 Training Top')).toBe('training')
  })

  it('ジャケットを見分ける', () => {
    expect(classifyCategory('LFC Rain Jacket')).toBe('jackets')
    expect(classifyCategory('LFC Winter Coat')).toBe('jackets')
  })

  it('★分からないものは other にする（当てずっぽうで分類しない）★', () => {
    expect(classifyCategory('LFC Enamel Pin Badge')).toBe('other')
    expect(classifyCategory('LFC Mug')).toBe('other')
    // 'shirt' が入っていても、ユニフォームだと分かる語が無ければ other
    expect(classifyCategory('LFC Casual Shirt')).toBe('other')
  })
})

describe('ユニフォームの種類', () => {
  it('ホーム／アウェイ／サードを見分ける', () => {
    expect(classifyKitType('LFC Home Replica Shirt', 'kits')).toBe('home')
    expect(classifyKitType('LFC Away Replica Shirt', 'kits')).toBe('away')
    expect(classifyKitType('LFC Third Replica Shirt', 'kits')).toBe('third')
    expect(classifyKitType('LFC Goalkeeper Shirt', 'kits')).toBe('goalkeeper')
  })

  it('★ユニフォームだが種類が分からなければ unknown★', () => {
    expect(classifyKitType('LFC 25/26 Replica Shirt', 'kits')).toBe('unknown')
  })

  it('ユニフォーム以外には種類を付けない', () => {
    expect(classifyKitType('LFC Home Mug', 'other')).toBeNull()
    expect(classifyKitType('LFC Training Top', 'training')).toBeNull()
  })
})

describe('レプリカ / オーセンティック', () => {
  it('はっきり書かれていれば読み取る', () => {
    expect(classifyAuthenticity('LFC 25/26 Home Replica Shirt', 'kits')).toBe('replica')
    expect(classifyAuthenticity('LFC 25/26 Home Authentic Shirt', 'kits')).toBe('authentic')
    expect(classifyAuthenticity('LFC 25/26 Home Stadium Shirt', 'kits')).toBe('replica')
  })

  it('★書かれていなければ unknown。勝手に replica にしない★', () => {
    expect(classifyAuthenticity('LFC 25/26 Home Shirt', 'kits')).toBe('unknown')
    expect(classifyAuthenticity('LFC Home Jersey', 'kits')).toBe('unknown')
  })

  it('★両方の語が入っていたら判断しない★', () => {
    expect(classifyAuthenticity('LFC Replica and Authentic Shirt Bundle', 'kits')).toBe('unknown')
  })

  it('ユニフォーム以外は該当しない（null）', () => {
    expect(classifyAuthenticity('LFC Authentic Mug', 'other')).toBeNull()
  })
})

describe('シーズン', () => {
  it('4桁始まりを読み取る', () => {
    expect(classifySeason('LFC 2025/26 Home Shirt')).toBe('2025/26')
    expect(classifySeason('LFC 2025-26 Home Shirt')).toBe('2025/26')
  })

  it('2桁始まりを読み取る', () => {
    expect(classifySeason('LFC 25/26 Home Shirt')).toBe('2025/26')
    expect(classifySeason('LFC 24-25 Home Shirt')).toBe('2024/25')
  })

  it('★書かれていなければ null（今シーズンで埋めない）★', () => {
    expect(classifySeason('LFC Home Replica Shirt')).toBeNull()
    expect(classifySeason('LFC Mug')).toBeNull()
  })

  it('連続しない年の組み合わせは採用しない', () => {
    expect(classifySeason('LFC 2025/28 Shirt')).toBeNull()
    expect(classifySeason('Sizes 10/40')).toBeNull()
  })

  it('世紀をまたぐ表記も扱える', () => {
    expect(classifySeason('LFC 99/00 Retro Shirt')).toBe('2099/00')
  })
})

describe('対象（メンズ／ウィメンズ／キッズ）', () => {
  it('はっきり書かれていれば読み取る', () => {
    expect(classifyGender('LFC Home Shirt - Mens')).toBe('men')
    expect(classifyGender('LFC Home Shirt - Womens')).toBe('women')
    expect(classifyGender('LFC Home Shirt - Junior')).toBe('kids')
    expect(classifyGender('LFC Scarf - Unisex')).toBe('unisex')
  })

  it('★書かれていなければ unknown（unisex で埋めない）★', () => {
    // メンズとウィメンズはサイズも価格も違う別商品なので、
    // 分からないまま unisex にすると比較が壊れる
    expect(classifyGender('LFC 25/26 Home Replica Shirt')).toBe('unknown')
  })
})

describe('袖丈', () => {
  it('はっきり書かれていれば読み取る', () => {
    expect(classifySleeve('LFC Home Shirt Long Sleeve')).toBe('long')
    expect(classifySleeve('LFC Home Shirt Short Sleeve')).toBe('short')
  })

  it('書かれていなければ null', () => {
    expect(classifySleeve('LFC Home Shirt')).toBeNull()
  })
})

describe('選手名', () => {
  it('★商品名からは推測しない（常に null）★', () => {
    // 'NIKE' や 'LFC' を選手名と誤認しないため、専用項目ができるまで取らない
    expect(classifyFromTitle('LFC 25/26 Home Shirt SALAH 11').player).toBeNull()
  })
})

describe('商品URLの整形', () => {
  it('トラッキングパラメータを取り除く', () => {
    const url = normalizeProductUrl(
      'https://example.com/product/abc?utm_source=news&gclid=xyz&size=M',
    )
    expect(url).toBe('https://example.com/product/abc?size=M')
  })

  it('絞り込み・並び替えのパラメータも取り除く', () => {
    const url = normalizeProductUrl('https://example.com/product/abc?f_size=M&sort=price&queryID=1')
    expect(url).toBe('https://example.com/product/abc')
  })

  it('ページ内リンクと末尾スラッシュをそろえる', () => {
    expect(normalizeProductUrl('https://example.com/product/abc/#reviews')).toBe(
      'https://example.com/product/abc',
    )
  })

  it('判断できないパラメータは残す（商品ページが開けなくなる方が困る）', () => {
    expect(normalizeProductUrl('https://example.com/p?colour=red')).toBe(
      'https://example.com/p?colour=red',
    )
  })

  it('https でないURLや壊れたURLは null', () => {
    expect(normalizeProductUrl('http://example.com/p')).toBeNull()
    expect(normalizeProductUrl('not a url')).toBeNull()
  })
})

describe('まとめて読み取る', () => {
  it('分かる項目だけを埋め、分からない項目は unknown / null にする', () => {
    const result = classifyFromTitle('Sample LFC 25/26 Home Replica Shirt - Mens Short Sleeve')

    expect(result).toEqual({
      category: 'kits',
      kitType: 'home',
      authenticity: 'replica',
      season: '2025/26',
      gender: 'men',
      sleeve: 'short',
      player: null,
    })
  })

  it('情報が少ない商品名では、埋めずに不明のままにする', () => {
    const result = classifyFromTitle('Sample LFC Pin Badge')

    expect(result.category).toBe('other')
    expect(result.kitType).toBeNull()
    expect(result.authenticity).toBeNull()
    expect(result.season).toBeNull()
    expect(result.gender).toBe('unknown')
    expect(result.sleeve).toBeNull()
  })
})

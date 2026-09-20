/**
 * 商品バリエーションの突き合わせ。
 *
 * 「同じクラブの同じシーズンのユニフォーム」でも、
 *   レプリカ と オーセンティック
 *   メンズ と ウィメンズ
 *   半袖 と 長袖
 *   選手名入り と 無地
 * は別の商品で、値段も違う。
 *
 * これらを取り違えたまま価格を比べると、
 * 「国内より1万円安い」のような誤った差額を出してしまう。
 *
 * そこで、照合の confidence がどれだけ高くても、
 * バリエーションが食い違っていたら比較対象から外す。
 * confidence は「同じ商品らしさ」の目安でしかなく、
 * 属性の食い違いはそれより強い否定材料だからである。
 */

import type { Product } from '@/domain/types'

export type VariantMismatchReason =
  | 'club'
  | 'season'
  | 'category'
  | 'kitType'
  | 'authenticity'
  | 'sleeve'
  | 'gender'
  | 'player'

export const VARIANT_MISMATCH_LABEL_JA: Record<VariantMismatchReason, string> = {
  club: 'クラブ',
  season: 'シーズン',
  category: 'カテゴリ',
  kitType: 'ユニフォームの種類',
  authenticity: 'レプリカ／オーセンティック',
  sleeve: '袖丈',
  gender: '対象',
  player: '選手名',
}

export interface VariantCompatibility {
  /** 比較してよい組み合わせか。 */
  compatible: boolean
  /** 食い違っていた項目。 */
  mismatches: VariantMismatchReason[]
}

/**
 * 「分かっている情報どうしが食い違っているか」だけを見る。
 *
 * 片方が null（未記録）の場合は、食い違いを証明できないので
 * 原則として食い違い扱いにしない。
 * ただし選手名だけは例外で、「選手名入り」と「無地」は明確に別商品・別価格のため、
 * 片方だけ入っていても食い違いとして扱う。
 */
function differs<T>(a: T | null, b: T | null): boolean {
  if (a === null || b === null) return false
  return a !== b
}

export function checkVariantCompatibility(a: Product, b: Product): VariantCompatibility {
  // 同じ商品レコードならそもそも比べる必要がない
  if (a.id === b.id) {
    return { compatible: true, mismatches: [] }
  }

  const mismatches: VariantMismatchReason[] = []

  if (a.clubId !== b.clubId) mismatches.push('club')
  if (a.season !== b.season) mismatches.push('season')
  if (a.category !== b.category) mismatches.push('category')
  if (a.gender !== b.gender) mismatches.push('gender')

  if (differs(a.kitType, b.kitType)) mismatches.push('kitType')
  if (differs(a.authenticity, b.authenticity)) mismatches.push('authenticity')
  if (differs(a.sleeve, b.sleeve)) mismatches.push('sleeve')

  // 選手名は片方だけ入っていても別商品として扱う
  if ((a.player ?? null) !== (b.player ?? null)) mismatches.push('player')

  return { compatible: mismatches.length === 0, mismatches }
}

/** 食い違いの理由を日本語の一文にする。 */
export function describeVariantMismatch(mismatches: VariantMismatchReason[]): string {
  if (mismatches.length === 0) return ''
  const labels = mismatches.map((reason) => VARIANT_MISMATCH_LABEL_JA[reason]).join('・')
  return `${labels}が異なるため、比較対象から外しています。`
}

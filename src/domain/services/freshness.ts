/**
 * 価格データの鮮度。
 *
 * 価格は日々変わるので、「いつ確認した価格か」は必ず持つ（StoreListing.lastCheckedAt）。
 * ここでは、その日時から「どのくらい古いか」を判定する。
 *
 * 第2段階では画面に警告までは出さないが、
 * 判定の仕組みだけ用意しておき、第3段階で
 * 「この価格は2週間前の情報です」といった注意書きを出せるようにする。
 *
 * ★「今」は引数で受け取る。★
 *   new Date() を関数の中で呼ぶと、ビルドのたびに結果が変わってしまい、
 *   静的サイトの出力が安定しない。テストも書きにくくなる。
 */

import type { IsoDateTime } from '@/domain/types'

export type FreshnessLevel =
  /** 十分新しい */
  | 'fresh'
  /** 少し古い */
  | 'aging'
  /** 古い。表示に注意書きを付けたい */
  | 'stale'
  /** 判定できない */
  | 'unknown'

/** 判定のしきい値（日数）。 */
export const FRESHNESS_THRESHOLD_DAYS = {
  fresh: 3,
  aging: 14,
} as const

export interface Freshness {
  level: FreshnessLevel
  /** 経過日数。判定できない場合は null。 */
  ageDays: number | null
  checkedAt: IsoDateTime | null
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * 鮮度を判定する。
 *
 * @param checkedAt 価格を確認した日時
 * @param now       基準にする「今」。静的サイトではデータの生成日時を渡す
 */
export function evaluateFreshness(
  checkedAt: IsoDateTime | null | undefined,
  now: IsoDateTime,
): Freshness {
  if (!checkedAt) {
    return { level: 'unknown', ageDays: null, checkedAt: null }
  }

  const checked = new Date(checkedAt).getTime()
  const current = new Date(now).getTime()

  if (Number.isNaN(checked) || Number.isNaN(current)) {
    return { level: 'unknown', ageDays: null, checkedAt: checkedAt ?? null }
  }

  const ageDays = Math.max(0, Math.floor((current - checked) / MS_PER_DAY))

  const level: FreshnessLevel =
    ageDays <= FRESHNESS_THRESHOLD_DAYS.fresh
      ? 'fresh'
      : ageDays <= FRESHNESS_THRESHOLD_DAYS.aging
        ? 'aging'
        : 'stale'

  return { level, ageDays, checkedAt }
}

export const FRESHNESS_LABEL_JA: Record<FreshnessLevel, string> = {
  fresh: '最近確認',
  aging: 'やや前の情報',
  stale: '古い情報',
  unknown: '確認日時不明',
}

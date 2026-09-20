/**
 * URL用 slug の生成と検証。
 *
 * slug はページのURLそのものになるため、後から変えるとリンクが切れる。
 * 形式を1か所で固定しておく。
 */

/** 許可する形式: 小文字英数字とハイフン。先頭・末尾はハイフン以外。連続ハイフン禁止。 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** 文字列が正しい slug 形式かどうか。 */
export function isValidSlug(value: string): boolean {
  if (typeof value !== 'string') return false
  if (value.length === 0 || value.length > 120) return false
  return SLUG_PATTERN.test(value)
}

/**
 * 任意の文字列から slug を作る。
 *
 * 日本語などの非ASCII文字は取り除かれるため、
 * 日本語名しか無い場合は英語名やIDから作ること。
 */
export function toSlug(input: string): string {
  return input
    .normalize('NFKD')
    // 発音記号を除去（例: Atlético -> Atletico）
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // 英数字以外をハイフンへ
    .replace(/[^a-z0-9]+/g, '-')
    // 連続ハイフンをまとめる
    .replace(/-{2,}/g, '-')
    // 先頭・末尾のハイフンを除去
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/g, '')
}

/** 商品 slug を組み立てる。例: ('liverpool', '2025/26', 'home replica') -> 'liverpool-2025-26-home-replica' */
export function buildProductSlug(clubSlug: string, season: string, variant: string): string {
  return toSlug([clubSlug, season, variant].join(' '))
}

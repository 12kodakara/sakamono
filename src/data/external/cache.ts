/**
 * 開発用キャッシュ。
 *
 * 目的は「同じデータを取りに行く回数を減らすこと」。
 * 第3段階の取得元はローカルファイルなので効果は小さいが、
 * 第4段階でフィードをダウンロードするようになったときに、
 * 開発中に何度も相手のサーバーへ取りに行かないようにするための土台。
 *
 * 置き場所: .cache/<提供元>/（.gitignore 済み）
 *
 * ★TTL（有効期限）を必ず持たせる。★
 *   古いキャッシュを気付かずに使い続けると、
 *   実際には値上がりしているのに古い価格を表示してしまう。
 */

import { IngestionError } from './ingestionErrors'

/** 既定の有効期限（6時間）。 */
export const DEFAULT_CACHE_TTL_MS = 6 * 60 * 60 * 1000

export interface CacheEntry<T> {
  /** 保存した日時（ISO 8601）。 */
  storedAt: string
  /** 有効期限（ミリ秒）。 */
  ttlMs: number
  /** 何のキャッシュか（人が見て分かるように）。 */
  note: string
  payload: T
}

export interface CacheOptions {
  /** キャッシュを置くフォルダ。 */
  directory: string
  /** 有効期限（ミリ秒）。 */
  ttlMs?: number
  /** true のときキャッシュを読まない（必ず取り直す）。 */
  disabled?: boolean
  /** 期限判定の基準時刻。テストで固定できるように引数にしている。 */
  now?: Date
}

function cacheFilePath(directory: string, key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._-]+/g, '_')
  return `${directory.replace(/\/+$/, '')}/${safeKey}.json`
}

/** キャッシュが期限内かどうか。 */
export function isFresh(entry: CacheEntry<unknown>, now: Date = new Date()): boolean {
  const storedAt = new Date(entry.storedAt).getTime()
  if (Number.isNaN(storedAt)) return false
  if (!Number.isFinite(entry.ttlMs) || entry.ttlMs <= 0) return false
  return now.getTime() - storedAt < entry.ttlMs
}

/**
 * キャッシュを読む。
 * 無い・壊れている・期限切れのいずれでも null を返す（例外にしない）。
 */
export async function readCache<T>(key: string, options: CacheOptions): Promise<T | null> {
  if (options.disabled) return null

  const { readFile } = await import('node:fs/promises')
  const path = cacheFilePath(options.directory, key)

  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return null
  }

  try {
    const entry = JSON.parse(text) as CacheEntry<T>
    if (!isFresh(entry, options.now ?? new Date())) return null
    return entry.payload
  } catch {
    // 壊れたキャッシュは無かったものとして扱う
    return null
  }
}

/** キャッシュを書く。 */
export async function writeCache<T>(
  key: string,
  payload: T,
  note: string,
  options: CacheOptions,
): Promise<void> {
  if (options.disabled) return

  const { mkdir, writeFile } = await import('node:fs/promises')
  const path = cacheFilePath(options.directory, key)

  const entry: CacheEntry<T> = {
    storedAt: (options.now ?? new Date()).toISOString(),
    ttlMs: options.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    note,
    payload,
  }

  try {
    await mkdir(options.directory, { recursive: true })
    await writeFile(path, `${JSON.stringify(entry, null, 2)}\n`, 'utf8')
  } catch (error) {
    throw new IngestionError('unknown', `キャッシュを書き込めませんでした: ${path}（${String(error)}）`)
  }
}

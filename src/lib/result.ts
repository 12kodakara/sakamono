/**
 * Result 型。
 *
 * 「失敗するかもしれない計算」の結果を、例外ではなく戻り値で表す。
 *
 * なぜ例外ではなく Result なのか:
 *   価格計算では「未対応の通貨だった」「レートが無かった」といった失敗が
 *   ふつうに起こる。例外にすると呼び出し側が try/catch を書き忘れたときに
 *   ページ全体が落ちるが、Result なら「失敗したこと」を型が強制するので
 *   処理し忘れをコンパイル時に気付ける。
 *
 * 使い方:
 *   const result = convertMoneyToJpy(price, rates)
 *   if (!result.ok) {
 *     // result.error に理由が入っている
 *     return null
 *   }
 *   // ここでは result.value が使える
 */

export interface Ok<T> {
  ok: true
  value: T
}

export interface Err<E> {
  ok: false
  error: E
}

export type Result<T, E> = Ok<T> | Err<E>

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

/** 成功なら値を、失敗なら fallback を返す。 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback
}

/** 成功なら値を、失敗なら null を返す。 */
export function toNullable<T, E>(result: Result<T, E>): T | null {
  return result.ok ? result.value : null
}

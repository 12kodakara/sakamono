/**
 * 表示用の整形。
 *
 * 金額や日時の書式をここへ集約し、画面ごとに表記がばらつかないようにする。
 */

import type { CurrencyCode } from '@/domain/types'

const CURRENCY_SYMBOL: Record<CurrencyCode, string> = {
  JPY: '¥',
  GBP: '£',
  EUR: '€',
  USD: '$',
}

/** 円建て金額。例: 18500 -> '18,500円' */
export function formatJpy(amount: number): string {
  return `${Math.round(amount).toLocaleString('ja-JP')}円`
}

/** 外貨建て金額。例: (94.99, 'GBP') -> '£94.99' */
export function formatCurrency(amount: number, currency: CurrencyCode): string {
  if (currency === 'JPY') return formatJpy(amount)
  const symbol = CURRENCY_SYMBOL[currency] ?? ''
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/** 割引率。例: 0.25 -> '25%OFF' */
export function formatDiscount(discountRate: number): string {
  return `${Math.round(discountRate * 100)}%OFF`
}

/**
 * 日時。例: '2026-09-18T09:00:00.000Z' -> '2026年9月18日'
 *
 * サーバーとブラウザで結果がずれないよう、タイムゾーンを固定して手組みする。
 */
export function formatDateJa(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const parts = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('year')}年${get('month')}月${get('day')}日`
}

/** 日時（分まで）。例: '2026年9月18日 18:00' */
export function formatDateTimeJa(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const time = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  return `${formatDateJa(iso)} ${time}`
}

/** <time> 要素の datetime 属性用に日付部分だけ取り出す。 */
export function toDateAttribute(iso: string): string {
  return iso.slice(0, 10)
}

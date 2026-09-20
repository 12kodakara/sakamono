/**
 * SEO用メタデータの組み立て。
 *
 * title / description / canonical / OGP を1か所で作り、
 * ページごとに書き方がばらつかないようにする。
 */

import type { Metadata } from 'next'
import { IS_PREVIEW, SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from './site'

export interface PageMetaInput {
  /** ページ固有のタイトル。省略するとサイト名だけになる。 */
  title?: string
  description?: string
  /** サイトルートからのパス。例: '/clubs/liverpool/' */
  path: string
  /** 検索エンジンに登録させたくないページは true。 */
  noindex?: boolean
}

export function buildPageMetadata(input: PageMetaInput): Metadata {
  const { title, description = SITE_DESCRIPTION, path, noindex = false } = input

  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - ${SITE_TAGLINE}`
  const canonical = `${SITE_URL}${normalizePath(path)}`

  return {
    // absolute を使う理由:
    // layout.tsx の title.template（'%s | サカモノ'）がここで組み立てた
    // タイトルへさらに適用されると「… | サカモノ | サカモノ」と二重になるため、
    // 「このタイトルをそのまま使う」と明示している。
    title: { absolute: fullTitle },
    description,
    alternates: { canonical },
    // ★開発版のあいだはサイト全体を noindex にする。★
    //   ページ個別の noindex 指定（検索結果ページなど）とは別に、
    //   site.ts の IS_PREVIEW でまとめて切り替えます。
    //   本番公開時は NEXT_PUBLIC_SITE_PREVIEW=false の1行で外れます。
    robots:
      noindex || IS_PREVIEW ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: fullTitle,
      description,
      url: canonical,
      locale: 'ja_JP',
    },
    twitter: {
      card: 'summary',
      title: fullTitle,
      description,
    },
  }
}

/** 先頭スラッシュあり・末尾スラッシュありへ整える（trailingSlash: true に合わせる）。 */
export function normalizePath(path: string): string {
  if (path === '/' || path === '') return '/'
  const withLeading = path.startsWith('/') ? path : `/${path}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

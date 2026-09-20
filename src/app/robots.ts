/**
 * robots.txt の生成。
 *
 * ビルド時に out/robots.txt として書き出される。
 * 検索結果ページは内容が検索語で変わるため、クロール対象から外している。
 */

import type { MetadataRoute } from 'next'
import { IS_PREVIEW, SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  // ★開発版のあいだはクロールを断る。★
  //   ただし robots.txt だけに頼りません。各ページの <meta name="robots">
  //   にも noindex を入れています（src/lib/seo.ts）。
  //   robots.txt は「読みに来ないで」の依頼で、
  //   noindex は「登録しないで」の指示です。役割が違います。
  if (IS_PREVIEW) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/search/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

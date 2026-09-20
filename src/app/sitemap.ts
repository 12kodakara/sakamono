/**
 * sitemap.xml の生成。
 *
 * ビルド時に out/sitemap.xml として書き出される。
 * クラブ・リーグ・商品が増えれば自動で項目も増えるので、手で足す必要はない。
 *
 * 検索結果ページ（/search/）は内容が検索語で変わるため含めない。
 */

import type { MetadataRoute } from 'next'
import { listClubSummaries, listLeagues, listProductViews } from '@/data/repository'
import { SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [leagues, clubs, products] = await Promise.all([
    listLeagues(),
    listClubSummaries(),
    listProductViews(),
  ])

  const staticPaths = ['/', '/clubs/', '/leagues/', '/sale/', '/rankings/', '/about/']

  return [
    ...staticPaths.map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'daily' as const,
      priority: path === '/' ? 1 : 0.7,
    })),
    ...leagues.map((league) => ({
      url: `${SITE_URL}/leagues/${league.slug}/`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
    ...clubs.map((summary) => ({
      url: `${SITE_URL}/clubs/${summary.club.slug}/`,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...products.map((view) => ({
      url: `${SITE_URL}${view.href}`,
      changeFrequency: 'daily' as const,
      priority: 0.9,
    })),
  ]
}

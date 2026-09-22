/**
 * sitemap.xml の生成。
 *
 * ビルド時に out/sitemap.xml として書き出される。
 * クラブ・リーグ・商品が増えれば自動で項目も増えるので、手で足す必要はない。
 *
 * ★どのページを載せるかは src/lib/sitemap.ts で決めています。★
 *   ここはデータを集めて渡すだけです。
 *   中身の無いページ（準備中のリーグ、価格が1つも無い商品）は載せません。
 *   検索結果ページ（/search/）も、内容が検索語で変わるため含めません。
 *
 * ★lastModified は付けていません。★
 *   ビルドのたびに「今」を入れると、何も変わっていないページまで
 *   毎回更新されたと申告することになり、かえって信用されなくなります。
 *   ページごとの本当の更新日時を持てるようになったら付けます。
 */

import type { MetadataRoute } from 'next'
import {
  listClubSummaries,
  listLeagueSummaries,
  listPriceGapRanking,
  listProductViews,
  listSaleProductViews,
} from '@/data/repository'
import { SITE_URL } from '@/lib/site'
import { buildKitsIndex } from '@/lib/kits'
import { buildSitemapEntries } from '@/lib/sitemap'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [leagues, clubs, products, sale, ranking] = await Promise.all([
    listLeagueSummaries(),
    listClubSummaries(),
    listProductViews(),
    listSaleProductViews(),
    listPriceGapRanking(),
  ])
  const kits = buildKitsIndex(products)

  const entries = buildSitemapEntries({
    siteUrl: SITE_URL,
    leagues: leagues.map((summary) => ({
      slug: summary.league.slug,
      clubCount: summary.clubCount,
      productCount: summary.productCount,
    })),
    clubs: clubs.map((summary) => ({
      slug: summary.club.slug,
      productCount: summary.productCount,
    })),
    products: products.map((view) => ({
      href: view.href,
      hasOverseasPrice: view.overseas !== null,
      hasDomesticPrice: view.comparison.domesticPrice.reference !== null,
    })),
    saleCount: sale.length,
    rankingCount: ranking.length,
    kits: { kitCount: kits.kits.length, clubCount: kits.clubs.length },
  })

  return entries.map(({ url, changeFrequency, priority }) => ({ url, changeFrequency, priority }))
}

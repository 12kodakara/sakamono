/**
 * robots.txt の生成。
 *
 * ビルド時に out/robots.txt として書き出される。
 *
 * ══════════════════════════════════════════════════════════
 * ★robots.txt と robots meta は役割が違います。混同しないこと。★
 *
 *   robots.txt                …「このURLを読みに来ないで」というクロールの依頼
 *   <meta name="robots">      …「このページを検索結果に載せないで」という指示
 *
 *   検索結果に出したくないページ（検索結果ページ・中身の無いページ）は、
 *   robots.txt で塞がず、各ページの noindex で止めています（src/lib/seo.ts）。
 *   robots.txt で塞ぐと、Googleがページを読めないので noindex も読めず、
 *   外部からのリンクだけでURLが検索結果に出てしまうことがあるためです。
 * ══════════════════════════════════════════════════════════
 *
 * ★置き場所についての制約（GitHub Pages の project site）★
 *   このファイルは https://12kodakara.github.io/sakamono/robots.txt に置かれます。
 *   検索エンジンが読むのはドメイン直下の /robots.txt だけなので、
 *   このリポジトリからは「ドメイン直下」に置けません。
 *   独自ドメインへ移すか、sitemap を Search Console で送信するまでの間、
 *   ここに書いた Sitemap の案内は検索エンジンへ届きません。
 */

import type { MetadataRoute } from 'next'
import { IS_PREVIEW, SITE_URL } from '@/lib/site'

export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  // ★開発版（ローカルのビルドなど）はクロールを断る。★
  //   本番はデプロイ時に NEXT_PUBLIC_SITE_PREVIEW=false を渡すので、この分岐に入りません。
  //   各ページの <meta name="robots"> にも noindex が入ります（二重の安全策）。
  if (IS_PREVIEW) {
    return {
      rules: { userAgent: '*', disallow: '/' },
    }
  }

  return {
    // ★全ページのクロールを許可する。★
    //   以前は /search/ を Disallow していましたが外しました。
    //   /search/ はページ側で noindex にしており、
    //   Googleがそれを読めるようにしておく方が確実に検索結果から外れます。
    //   /_next/ のCSS・JSも、ページの表示確認に使われるので塞ぎません。
    rules: {
      userAgent: '*',
      allow: '/',
    },
    // sitemap.ts と同じ SITE_URL から組み立てる（URLを2か所に書かない）。
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}

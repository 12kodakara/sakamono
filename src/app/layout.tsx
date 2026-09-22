/**
 * 全ページ共通の骨組み。
 *
 * ここで決めているもの:
 *  - <html lang="ja">（読み上げソフトと検索エンジンへ日本語のページだと伝える）
 *  - 共通のCSS
 *  - サンプルデータの帯・ヘッダー・フッター
 *  - 「本文へ移動」リンク（キーボード操作でヘッダーを読み飛ばせるように）
 *  - metadataBase（各ページの canonical / OGP のURLの土台）
 */

import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SampleDataBanner } from '@/components/layout/SampleDataBanner'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, SITE_URL } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} - ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, address: false, email: false },
  // Google Search Console の所有権確認（HTMLタグ方式）。
  // Next.js がすべてのページの <head> に
  // <meta name="google-site-verification" content="…"> を1つ出力する。
  // この値は公開されるもので、秘密情報ではない。
  verification: {
    google: 'yDFHG0ITbtE49G9YeIbR_G2sAtCCqhRgSwbYPh8kp3I',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <div className="page">
          <a className="skip-link" href="#main">
            本文へ移動
          </a>

          <SampleDataBanner />
          <SiteHeader />

          <main id="main" className="page-main" tabIndex={-1}>
            {children}
          </main>

          <SiteFooter />
        </div>
      </body>
    </html>
  )
}

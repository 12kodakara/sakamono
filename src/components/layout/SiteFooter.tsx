/**
 * サイト共通フッター。
 *
 * 免責（価格は推定であること・商標について）をここに常設する。
 */

import Link from 'next/link'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/site'

const FOOTER_LINKS = [
  {
    heading: '探す',
    items: [
      { href: '/clubs/', label: 'クラブから探す' },
      { href: '/leagues/', label: 'リーグから探す' },
      { href: '/search/', label: '商品を検索する' },
    ],
  },
  {
    heading: '価格をくらべる',
    items: [
      { href: '/sale/', label: 'セール情報' },
      { href: '/rankings/', label: '価格差ランキング' },
    ],
  },
  {
    heading: 'サカモノについて',
    items: [
      { href: '/about/', label: 'このサイトについて' },
      { href: '/about/#landed-cost', label: '日本到着推定額について' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__columns">
          <div>
            <p className="site-footer__heading">{SITE_NAME}</p>
            <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>
              {SITE_TAGLINE}
            </p>
          </div>

          {FOOTER_LINKS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <p className="site-footer__heading">{column.heading}</p>
              <ul className="site-footer__list">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="site-footer__note">
          <p>
            日本到着推定額は、商品価格の円換算に国際送料・輸入コスト・決済関連コストの目安を加えた
            <strong>推定値</strong>です。確定額ではありません。実際の請求額は、為替・配送方法・
            税関の判断・購入点数などにより変わります。
          </p>
          <p>
            クラブ名・リーグ名・メーカー名は各権利者の商標です。サカモノは各クラブ・リーグ・
            メーカーとは提携していません。
          </p>
          <p>© {new Date().getFullYear()} サカモノ</p>
        </div>
      </div>
    </footer>
  )
}

/**
 * サイト共通ヘッダー。
 *
 * - 左: サイト名とサブコピー
 * - 右: ナビゲーション＋検索欄（PC）／ハンバーガーメニュー（スマートフォン）
 *
 * スマートフォン用メニューは <details>/<summary> で開閉している。
 * JavaScriptを足さずに済み、キーボード操作と読み上げソフトには
 * ブラウザ標準の動作がそのまま効く。
 */

import Link from 'next/link'
import { NAV_ITEMS, SITE_NAME, SITE_TAGLINE } from '@/lib/site'

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="site-logo">
          <span className="site-logo__name">{SITE_NAME}</span>
          <span className="site-logo__tagline">{SITE_TAGLINE}</span>
        </Link>

        {/* --- PC向けナビゲーション --- */}
        <nav className="site-nav" aria-label="メインメニュー">
          <ul className="site-nav__list">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="site-nav__link">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* --- PC向け検索 --- */}
        <form className="header-search" action="/search/" method="get" role="search">
          <label htmlFor="header-search-input" className="visually-hidden">
            サイト内検索
          </label>
          <input
            id="header-search-input"
            className="header-search__input"
            type="search"
            name="q"
            placeholder="商品・クラブ・選手名"
          />
          <button type="submit" className="header-search__button">
            検索
          </button>
        </form>

        {/* --- スマートフォン向けメニュー --- */}
        <details className="mobile-menu">
          <summary className="mobile-menu__toggle" aria-label="メニューを開く">
            <span className="mobile-menu__bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            メニュー
          </summary>

          <div className="mobile-menu__panel">
            <nav aria-label="メインメニュー（モバイル）">
              <ul className="mobile-menu__list">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>

            <form className="mobile-menu__search" action="/search/" method="get" role="search">
              <label htmlFor="mobile-search-input" className="visually-hidden">
                サイト内検索
              </label>
              <input
                id="mobile-search-input"
                type="search"
                name="q"
                placeholder="商品・クラブ・選手名"
              />
              <button type="submit">検索</button>
            </form>
          </div>
        </details>
      </div>
    </header>
  )
}

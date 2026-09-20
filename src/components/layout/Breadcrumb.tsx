/**
 * パンくずリスト。
 *
 * 現在位置を示すだけでなく、検索エンジンにページの階層を伝える役割もある。
 * 最後の項目は現在のページなのでリンクにしない（aria-current で示す）。
 */

import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  /** 省略すると現在のページ扱い（リンクにしない）。 */
  href?: string
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="breadcrumb" aria-label="現在位置">
      <ol>
        <li>
          <Link href="/">ホーム</Link>
        </li>
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

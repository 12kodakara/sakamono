/**
 * ページが見つからないときの表示（404）。
 */

import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="container page-body">
      <div className="prose">
        <h1 className="page-title">ページが見つかりません</h1>
        <p>
          お探しのページは、移動または削除された可能性があります。
          URLに誤りがないかご確認ください。
        </p>
        <p style={{ marginTop: 'var(--space-5)' }}>
          <Link href="/" className="button button--primary">
            トップページへ戻る
          </Link>
        </p>
      </div>
    </div>
  )
}

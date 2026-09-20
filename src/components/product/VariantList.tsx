/**
 * サイズごとの在庫表示。
 *
 * ★「在庫あり」と書かれているだけで全サイズ買えるとは限らない。★
 *   サイズ単位の情報が取れているなら、そちらを見せる方が正確。
 *
 * ★取れていない項目を空欄でごまかさない。★
 *   在庫が分からないサイズは「不明」とはっきり書く。
 */

import type { ProductVariant } from '@/domain/types'
import { STOCK_STATUS_LABEL_JA } from '@/lib/labels'

export function VariantList({ variants }: { variants: ProductVariant[] }) {
  if (variants.length === 0) {
    return (
      <p className="empty-state">
        サイズごとの在庫情報を取得できていません。購入前に販売元のページでご確認ください。
      </p>
    )
  }

  const availableCount = variants.filter((v) => v.availability === 'available').length
  const unknownCount = variants.filter((v) => v.availability === 'unknown').length

  return (
    <div>
      <table className="breakdown">
        <caption>サイズごとの在庫</caption>
        <thead>
          <tr>
            <th scope="col">サイズ</th>
            <th scope="col">在庫</th>
            <th scope="col">SKU</th>
          </tr>
        </thead>
        <tbody>
          {variants.map((variant) => (
            <tr key={variant.id}>
              <th scope="row">{variant.size ?? '（サイズ表記なし）'}</th>
              <td
                className={
                  variant.availability === 'unknown' ? 'breakdown__unknown' : 'breakdown__text'
                }
              >
                {STOCK_STATUS_LABEL_JA[variant.availability]}
              </td>
              <td className="breakdown__text">{variant.sku ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="breakdown__note">
        {variants.length}サイズ中 {availableCount}サイズが在庫ありです。
        {unknownCount > 0 ? `（${unknownCount}サイズは在庫を確認できていません）` : ''}
        <br />
        在庫は変動します。購入前に販売元のページでご確認ください。
      </p>
    </div>
  )
}

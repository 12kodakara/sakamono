/**
 * 日本到着推定額の内訳表。
 *
 * ★「推定」であることが必ず伝わる作りにする。★
 *  - 推定の項目には「推定」と付ける
 *  - かからない項目は「かからない」と書く（0円と不明を混同させない）
 *  - 分からない項目は金額を出さず「不明」と書く
 *  - 合計が出せないときは「算出できません」と明示し、参考額であることを言う
 *
 * 各項目の状態（確定／推定／かからない／不明）はサービス層が決めている。
 * このコンポーネントはそれを日本語にするだけで、判定は一切しない。
 */

import type { OverseasOffer } from '@/data/viewModels'
import { describeLandedCost } from '@/domain/services/landedCost'
import type { ImportCostEstimate } from '@/domain/services/importCost'
import type { PaymentCostEstimate } from '@/domain/services/paymentCost'
import type { ShippingResolution } from '@/domain/services/shipping'
import { formatCurrency, formatDateJa, formatJpy } from '@/lib/format'

/** 金額の欄。分からない項目は金額を出さない。 */
function AmountCell({ amountJpy }: { amountJpy: number | null }) {
  if (amountJpy === null) {
    return <td className="breakdown__unknown">不明</td>
  }
  return <td>{formatJpy(amountJpy)}</td>
}

function shippingMark(shipping: ShippingResolution) {
  if (shipping.status === 'unknown') return <span className="unknown-mark">不明</span>
  if (shipping.status === 'free') return <span className="estimate-mark">無料</span>
  if (shipping.isEstimate) return <span className="estimate-mark">推定</span>
  return <span className="fixed-mark">確定</span>
}

function costMark(status: ImportCostEstimate['status'] | PaymentCostEstimate['status']) {
  if (status === 'unknown') return <span className="unknown-mark">不明</span>
  if (status === 'not_applicable') return <span className="fixed-mark">かからない</span>
  return <span className="estimate-mark">推定</span>
}

export function LandedCostTable({ offer }: { offer: OverseasOffer }) {
  const { listing, store, landedCost } = offer
  const { shipping, importCost, paymentCost } = landedCost.components
  const landed = describeLandedCost(landedCost)

  return (
    <div>
      <table className="breakdown">
        <caption>日本到着推定額の内訳</caption>
        <tbody>
          <tr>
            <th scope="row">
              商品価格
              <br />
              <small className="breakdown__sub">
                {formatCurrency(listing.currentPrice, listing.currency)} を円換算
              </small>
            </th>
            <td>{formatJpy(landedCost.productPriceJpy)}</td>
          </tr>

          <tr>
            <th scope="row">
              国際送料 {shippingMark(shipping)}
              <br />
              <small className="breakdown__sub">{shipping.note}</small>
            </th>
            <AmountCell amountJpy={landedCost.shippingJpy} />
          </tr>

          <tr>
            <th scope="row">
              輸入コスト {costMark(importCost.status)}
              <br />
              <small className="breakdown__sub">
                {importCost.note ?? '関税・消費税・通関手数料'}
              </small>
            </th>
            <AmountCell amountJpy={landedCost.importCostJpy} />
          </tr>

          <tr>
            <th scope="row">
              決済・為替関連コスト {costMark(paymentCost.status)}
              <br />
              <small className="breakdown__sub">{paymentCost.note ?? '海外事務手数料など'}</small>
            </th>
            <AmountCell amountJpy={landedCost.paymentCostJpy} />
          </tr>

          <tr className="breakdown__total">
            <th scope="row">
              {landed.label} <span className="estimate-mark">推定</span>
            </th>
            <td>{formatJpy(landed.displayAmountJpy)}</td>
          </tr>
        </tbody>
      </table>

      {landed.hasTotal ? null : (
        <p className="alert-note" role="note">
          {landed.note}
        </p>
      )}

      <div className="breakdown__note">
        {landedCost.exchangeRate ? (
          <p>
            為替レートは 1{landedCost.exchangeRate.baseCurrency} ={' '}
            {landedCost.exchangeRate.rate}円 で計算しています
            {landedCost.exchangeRate.kind === 'development-fixture' ? (
              <>（{formatDateJa(landedCost.exchangeRate.fetchedAt)}時点の開発用の想定値です。
              実勢レートではありません）</>
            ) : (
              <>（{formatDateJa(landedCost.exchangeRate.fetchedAt)}時点）</>
            )}
            。
          </p>
        ) : null}
        <p>
          {store.name}から日本へ届ける場合の試算です。購入点数は1点として計算しています。
          まとめ買いの場合は1点あたりの送料が下がります。
        </p>
        <p>
          実際の請求額は、為替・配送方法・税関の判断・キャンペーンなどで変わります。
          この金額は支払いを保証するものではありません。
        </p>
      </div>
    </div>
  )
}

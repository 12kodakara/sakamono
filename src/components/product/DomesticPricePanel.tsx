/**
 * 商品詳細ページの「日本国内」欄。
 *
 * 出すもの:
 *   国内最安（送料込み）／比較対象の店舗数／商品一致の信頼度／価格確認日時
 *   取得元（Yahoo!ショッピングなど）と、そのデータの素性
 *
 * ★除外した掲載も理由つきで示す。★
 *   「国内にもっと安い出品があるのに、なぜこの価格で比べているのか」を
 *   ユーザーが確認できるようにするため。
 *   黙って安い出品を無視すると、かえって不信感につながる。
 *
 * ★実データと開発用データを同じものとして見せない。★
 *   第4段階では、海外価格が開発用・国内価格が取得データという
 *   混ざった状態が起こり得るため、欄ごとに素性を表示する。
 */

import type { ProductView } from '@/data/viewModels'
import { DOMESTIC_EXCLUSION_LABEL_JA } from '@/domain/services/domesticPrice'
import { CONFIDENCE_GRADE_LABEL_JA } from '@/lib/matching/confidence'
import { MATCH_DIMENSION_LABEL_JA, type MatchDimension } from '@/lib/matching/engine'
import { formatDateTimeJa, formatJpy } from '@/lib/format'
import { STORE_TYPE_LABEL, describeDataOrigin, describeDomesticSource } from '@/lib/labels'

export function DomesticPricePanel({ view }: { view: ProductView }) {
  const summary = view.comparison.domesticPrice
  const { reference } = summary

  if (!reference) {
    return (
      <div>
        <p className="empty-state">
          {summary.examinedCount === 0
            ? '国内価格を確認できませんでした。'
            : view.comparison.statusNote}
        </p>
        {summary.excluded.length > 0 ? <ExcludedList view={view} /> : null}
      </div>
    )
  }

  const origin = describeDataOrigin(reference.store)
  const sourceName = describeDomesticSource(reference.match.sourceLabel)

  return (
    <div>
      <table className="breakdown">
        <caption>日本国内の価格</caption>
        <tbody>
          <tr>
            <th scope="row">
              国内最安 <span className="fixed-mark">送料込み</span>
              <br />
              <small className="breakdown__sub">
                {sourceName ? `${sourceName} / ` : ''}
                {reference.store.name}（{STORE_TYPE_LABEL[reference.store.type]}）
              </small>
            </th>
            <td>{formatJpy(reference.totalPriceJpy)}</td>
          </tr>
          <tr>
            <th scope="row">
              内訳
              <br />
              <small className="breakdown__sub">商品価格／国内送料</small>
            </th>
            <td>
              {formatJpy(reference.itemPriceJpy)}
              {' ／ '}
              {reference.shippingJpy === 0 ? '無料' : formatJpy(reference.shippingJpy)}
            </td>
          </tr>
          <tr>
            <th scope="row">比較対象の店舗数</th>
            <td>
              {summary.offerCount}店舗
              {summary.examinedCount > summary.offerCount
                ? `（確認 ${summary.examinedCount}件中）`
                : ''}
            </td>
          </tr>
          {summary.medianPriceJpy !== null && summary.offerCount > 1 ? (
            <tr>
              <th scope="row">中央値</th>
              <td>{formatJpy(summary.medianPriceJpy)}</td>
            </tr>
          ) : null}
          <tr>
            <th scope="row">商品一致の信頼度</th>
            <td className="breakdown__text">
              {summary.confidence ? CONFIDENCE_GRADE_LABEL_JA[summary.confidence] : '—'}
            </td>
          </tr>
          <tr>
            <th scope="row">価格確認</th>
            <td className="breakdown__text">
              <time dateTime={reference.listing.lastCheckedAt}>
                {formatDateTimeJa(reference.listing.lastCheckedAt)}
              </time>
            </td>
          </tr>
          <tr>
            <th scope="row">データの素性</th>
            <td className="breakdown__text">
              <span className={origin.isLive ? 'badge badge--live' : 'badge badge--unknown'}>
                {origin.label}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <SourcePriceList view={view} />
      <MatchEvidenceForDevelopers view={view} />
      <ExcludedList view={view} />
    </div>
  )
}

/**
 * 提供元ごとの最安（Yahoo!ショッピング / 楽天市場）。
 *
 * ★情報を増やしすぎないこと。★
 *   一覧カードには「国内最安」だけを出し、
 *   どこがいくらだったのかは、この商品詳細でだけ見せます。
 *   提供元ごとの内訳は、利用者が「本当に最安か」を確かめる手掛かりです。
 *
 * 提供元が1つしか無いときは出しません（同じ数字が2度並ぶだけのため）。
 */
function SourcePriceList({ view }: { view: ProductView }) {
  const { eligible } = view.comparison.domesticPrice

  // 提供元ごとに、いちばん安い掲載を1つずつ
  const cheapestBySource = new Map<string, number>()
  for (const offer of eligible) {
    const source = offer.match.sourceLabel
    if (!source) continue
    const current = cheapestBySource.get(source)
    if (current === undefined || offer.totalPriceJpy < current) {
      cheapestBySource.set(source, offer.totalPriceJpy)
    }
  }

  if (cheapestBySource.size < 2) return null

  return (
    <dl className="source-prices">
      {[...cheapestBySource.entries()]
        .sort(([, a], [, b]) => a - b)
        .map(([source, priceJpy]) => (
          <div className="source-prices__row" key={source}>
            <dt className="source-prices__name">{describeDomesticSource(source) ?? source}</dt>
            <dd className="source-prices__value">{formatJpy(priceJpy)}</dd>
          </div>
        ))}
      <p className="breakdown__note">
        いずれも送料込みの総額です。ポイント還元やクーポンは含めていません。
      </p>
    </dl>
  )
}

/**
 * 採用した国内候補の「一致の根拠」と「未確認の項目」。
 *
 * ★開発中だけ表示します。★
 *   公開画面へ出すものではありません。
 *   利用者にとっては細かすぎますが、照合の誤りを見つけるには
 *   「何を根拠に同じ商品だと判断したのか」が見えている必要があります。
 *
 * ★未確認の項目を必ず併記します。★
 *   根拠だけ並べると「全部確認済み」に見えてしまいます。
 *   袖丈が商品名に書かれていなければ、それは一致ではなく未確認です。
 */
function MatchEvidenceForDevelopers({ view }: { view: ProductView }) {
  if (process.env.NODE_ENV === 'production') return null

  const reference = view.comparison.domesticPrice.reference
  if (!reference) return null

  const { matchNote, unknownAttributes } = reference.match
  if (!matchNote && (unknownAttributes ?? []).length === 0) return null

  return (
    <details className="dev-note">
      <summary>開発用: 商品一致の根拠</summary>
      {matchNote ? (
        <p>
          <strong>一致の根拠:</strong> {matchNote}
        </p>
      ) : null}
      {(unknownAttributes ?? []).length > 0 ? (
        <p>
          <strong>未確認（一致とみなしていない項目）:</strong>{' '}
          {unknownAttributes!
            .map((dimension) => MATCH_DIMENSION_LABEL_JA[dimension as MatchDimension] ?? dimension)
            .join('・')}
        </p>
      ) : null}
      <p>この欄は開発中のみ表示されます。</p>
    </details>
  )
}

/** 比較対象から外した国内掲載の一覧。 */
function ExcludedList({ view }: { view: ProductView }) {
  const excluded = view.comparison.domesticPrice.excluded
  if (excluded.length === 0) return null

  return (
    <div className="breakdown__note">
      <p style={{ fontWeight: 700 }}>比較対象から外した国内の掲載</p>
      <ul className="reason-list">
        {excluded.map((entry) => (
          <li key={entry.candidate.match.id}>
            {entry.candidate.store.name}
            {' ／ '}
            {formatJpy(entry.candidate.itemPriceJpy)}
            {' … '}
            {/* 照合エンジンが具体的な理由を持っていればそちらを見せる */}
            {entry.candidate.match.matchNote ??
              entry.reasons.map((reason) => DOMESTIC_EXCLUSION_LABEL_JA[reason]).join('・')}
          </li>
        ))}
      </ul>
      <p>
        これらは価格差の計算に使っていません。
        別の仕様の商品や、販売元・在庫・送料条件を確認できない掲載を混ぜると、
        比較そのものが正しくなくなるためです。
      </p>
    </div>
  )
}

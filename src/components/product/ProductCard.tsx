/**
 * 商品カード。
 *
 * 一覧に出す最小限の情報だけを載せる。
 * 詳しい内訳（送料・関税・最終確認日時など）は商品詳細ページへ送る。
 *
 * 画像は next/image ではなく通常の <img> を使っている。
 *  - 静的サイトとして書き出すため画像最適化サーバーが使えない
 *  - width / height と aspect-ratio を指定して、読み込み時のガタつきを防いでいる
 *  - loading="lazy" で、画面外の画像は後から読み込む
 */

import Link from 'next/link'
import type { ProductView } from '@/data/viewModels'
import { AUTHENTICITY_LABEL, buildProductMetaLine, resolveStockStatus } from '@/lib/labels'
import { PriceSummary } from './PriceSummary'

export interface ProductCardProps {
  view: ProductView
  /**
   * 商品名に使う見出しレベル。
   * ページの見出し構造が飛ばないよう、置く場所に合わせて指定する。
   */
  headingLevel?: 'h2' | 'h3' | 'h4'
  /** 画像を先に読み込むか（画面上部の数件だけ true にする）。 */
  priority?: boolean
}

export function ProductCard({ view, headingLevel: Heading = 'h3', priority = false }: ProductCardProps) {
  const { product, club, overseas } = view

  // 割引の判定は evaluateDiscount()（サービス層）が済ませている。ここでは表示するだけ。
  const discountPercent = overseas?.discount.isSale ? overseas.discount.percent : 0
  // ★「在庫切れ」と「在庫が分からない」を区別する。★
  const stockStatus = overseas ? resolveStockStatus(overseas.listing) : null

  return (
    <article className="product-card">
      <figure className="product-card__figure">
        <img
          className="product-card__image"
          src={product.image.src}
          alt={product.image.alt}
          width={product.image.width}
          height={product.image.height}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
        />
        <div className="product-card__figure-badges">
          {discountPercent > 0 ? <span className="badge badge--sale">{discountPercent}%OFF</span> : null}
          {stockStatus === 'unavailable' ? (
            <span className="badge badge--out-of-stock">在庫切れ</span>
          ) : null}
          {stockStatus === 'unknown' ? (
            <span className="badge badge--unknown">在庫未確認</span>
          ) : null}
        </div>
      </figure>

      <div className="product-card__body">
        <p className="product-card__club">{club.nameJa}</p>

        <Heading className="product-card__name">
          <Link href={view.href}>{product.nameJa}</Link>
        </Heading>

        <p className="product-card__meta">
          {buildProductMetaLine({
            season: product.season,
            kitType: product.kitType,
            authenticity: product.authenticity,
            category: product.category,
          })}
        </p>

        {product.authenticity === 'authentic' ? (
          <p className="badge-list">
            <span className="badge badge--authentic">
              {AUTHENTICITY_LABEL.authentic}（選手仕様）
            </span>
          </p>
        ) : null}

        <PriceSummary view={view} />

        <div className="product-card__footer">
          <Link href={view.href} className="button button--outline button--block">
            商品を見る
            <span className="visually-hidden">（{product.nameJa}の詳細ページ）</span>
          </Link>
        </div>
      </div>
    </article>
  )
}

/**
 * 商品詳細ページ（/products/liverpool-2025-26-home-replica/ など）。
 *
 * 価格まわりの構成（第2段階）:
 *
 *   比較結果      … 日本到着推定額 と 国内比較価格、どちらがいくら安いか
 *   海外公式      … 商品価格・円換算・送料・輸入コスト・決済 → 日本到着推定
 *   日本国内      … 国内最安（送料込み）・比較対象の店舗数・商品一致の信頼度
 *
 * ★このファイルは計算をしない。★
 *   すべて repository（→ src/domain/services/）が計算済みの値を渡してくる。
 *
 * 構造化データ（JSON-LD）について:
 *   サンプルデータを表示している間は出力しない。
 *   ダミーの価格を本物の価格として検索エンジンへ送らないため。
 */

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ComparisonResult } from '@/components/product/ComparisonResult'
import { DomesticPricePanel } from '@/components/product/DomesticPricePanel'
import { LandedCostTable } from '@/components/product/LandedCostTable'
import { PriceHistoryChart } from '@/components/product/PriceHistoryChart'
import { VariantList } from '@/components/product/VariantList'
import { SectionHeader } from '@/components/ui/SectionHeader'
import {
  getDataSourceMeta,
  getPriceHistory,
  getProductViewBySlug,
  listProductViews,
} from '@/data/repository'
import { FRESHNESS_LABEL_JA } from '@/domain/services/freshness'
import { formatCurrency, formatDateTimeJa, formatJpy } from '@/lib/format'
import {
  AUTHENTICITY_LABEL,
  CATEGORY_LABEL,
  GENDER_LABEL,
  KIT_TYPE_LABEL,
  SHIPPING_TYPE_LABEL,
  STOCK_STATUS_LABEL_JA,
  STORE_TYPE_LABEL,
  resolveStockStatus,
} from '@/lib/labels'
import { buildPageMetadata } from '@/lib/seo'
import { isProductListable } from '@/lib/sitemap'
import { SITE_URL, assetPath } from '@/lib/site'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  const views = await listProductViews()
  return views.map((view) => ({ slug: view.product.slug }))
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const view = await getProductViewBySlug(slug)
  if (!view) {
    return buildPageMetadata({
      title: '商品が見つかりません',
      path: `/products/${slug}/`,
      noindex: true,
    })
  }

  const { product, club, overseas } = view
  const landedNote =
    overseas && overseas.landedCost.totalJpy !== null
      ? `日本到着推定額は${formatJpy(overseas.landedCost.totalJpy)}。`
      : ''

  return buildPageMetadata({
    title: `${product.nameJa}の価格比較`,
    description: `${club.nameJa}の${product.nameJa}（${product.season ?? 'シーズン未確認'}）を、海外公式ストアの価格と日本到着推定額で比較。${landedNote}国内価格との差も確認できます。`,
    path: `/products/${product.slug}/`,
    // ★検索に出す条件は sitemap と同じ判定を使う（ずれないように1か所にまとめてある）。★
    //   価格が1つも無いページと、どの実在商品か分かっていないページは出しません。
    noindex: !isProductListable({
      href: view.href,
      hasOverseasPrice: overseas !== null,
      hasDomesticPrice: view.comparison.domesticPrice.reference !== null,
      hasProductCode: product.manufacturerSku !== null,
    }),
  })
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params
  const view = await getProductViewBySlug(slug)
  if (!view) notFound()

  const { product, club, league, overseas, comparison } = view
  const [history, meta] = await Promise.all([getPriceHistory(view), getDataSourceMeta()])

  const discountPercent = overseas?.discount.isSale ? overseas.discount.percent : 0
  const domesticReference = comparison.domesticPrice.reference
  // ★「在庫切れ」と「在庫が分からない」を区別する。★
  const stockStatus = overseas ? resolveStockStatus(overseas.listing) : null

  return (
    <>
      <div className="container">
        <Breadcrumb
          items={[
            { label: 'クラブから探す', href: '/clubs/' },
            { label: club.nameJa, href: `/clubs/${club.slug}/` },
            { label: product.nameJa },
          ]}
        />
      </div>

      <div className="container page-body stack--lg">
        <div className="product-detail">
          {/* ----- 画像 ----- */}
          <figure className="product-detail__figure">
            <img
              className="product-detail__image"
              src={assetPath(product.image.src)}
              alt={product.image.alt}
              width={product.image.width}
              height={product.image.height}
              decoding="async"
            />
          </figure>

          {/* ----- 概要と比較結果 ----- */}
          <div className="stack">
            <div>
              <p className="product-detail__club">
                <Link href={`/clubs/${club.slug}/`}>{club.nameJa}</Link>
                {' ／ '}
                <Link href={`/leagues/${league.slug}/`}>{league.nameJa}</Link>
              </p>
              <h1 className="product-detail__title">{product.nameJa}</h1>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {product.name}
              </p>
            </div>

            <p className="badge-list">
              {product.season ? <span className="badge">{product.season}</span> : null}
              {product.kitType ? (
                <span className="badge">{KIT_TYPE_LABEL[product.kitType]}</span>
              ) : null}
              <span className="badge">{CATEGORY_LABEL[product.category]}</span>
              {product.authenticity ? (
                <span
                  className={
                    product.authenticity === 'authentic' ? 'badge badge--authentic' : 'badge'
                  }
                >
                  {AUTHENTICITY_LABEL[product.authenticity]}
                </span>
              ) : null}
              <span className="badge">{GENDER_LABEL[product.gender]}</span>
              {discountPercent > 0 ? (
                <span className="badge badge--sale">{discountPercent}%OFF</span>
              ) : null}
              {stockStatus === 'unavailable' ? (
                <span className="badge badge--out-of-stock">在庫切れ</span>
              ) : null}
              {stockStatus === 'unknown' ? (
                <span className="badge badge--unknown">在庫未確認</span>
              ) : null}
            </p>

            {overseas ? (
              <>
                <ComparisonResult view={view} />

                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                  在庫状況: {stockStatus ? STOCK_STATUS_LABEL_JA[stockStatus] : '—'}
                  <br />
                  価格確認:{' '}
                  <time dateTime={overseas.listing.lastCheckedAt}>
                    {formatDateTimeJa(overseas.listing.lastCheckedAt)}
                  </time>
                  {overseas.freshness.ageDays !== null ? (
                    <>
                      （{FRESHNESS_LABEL_JA[overseas.freshness.level]}・
                      {overseas.freshness.ageDays}日前）
                    </>
                  ) : null}
                </p>

                <div>
                  <a
                    className="button button--primary"
                    href={overseas.listing.externalUrl}
                    target="_blank"
                    rel="noopener nofollow"
                  >
                    {overseas.store.name}で見る
                    <span className="visually-hidden">（新しいタブで開きます）</span>
                  </a>
                  {meta.isSampleData ? (
                    <p
                      style={{
                        marginTop: 'var(--space-2)',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-caution)',
                      }}
                    >
                      ※ 現在はサンプル表示のため、このリンク先はサンプル用のURLです。
                    </p>
                  ) : null}
                </div>
              </>
            ) : (
              <p className="empty-state">この商品の海外ストアでの取り扱いを確認できていません。</p>
            )}
          </div>
        </div>

        {/* ===== 価格の内訳（海外公式 / 日本国内） ===== */}
        <section className="section" aria-labelledby="price-detail-title">
          <SectionHeader
            id="price-detail-title"
            title="価格の内訳"
            description="海外から取り寄せた場合と、日本国内で買った場合を並べて確認できます。"
          />
          <div className="price-panels">
            <div className="price-panel">
              <h3 className="price-panel__title">
                海外公式
                {overseas ? (
                  <span
                    className={
                      overseas.store.dataOrigin === 'live'
                        ? 'badge badge--live'
                        : 'badge badge--unknown'
                    }
                    style={{ marginLeft: 'var(--space-2)', fontWeight: 400 }}
                  >
                    {overseas.store.dataOrigin === 'live' ? '取得データ' : '開発用データ'}
                  </span>
                ) : null}
              </h3>
              {overseas ? (
                <LandedCostTable offer={overseas} />
              ) : (
                <p className="empty-state">海外ストアでの取り扱いを確認できていません。</p>
              )}
            </div>

            <div className="price-panel">
              <h3 className="price-panel__title">日本国内</h3>
              <DomesticPricePanel view={view} />
            </div>
          </div>
        </section>

        {/* ===== サイズと在庫 ===== */}
        {overseas ? (
          <section className="section" aria-labelledby="variant-title">
            <SectionHeader
              id="variant-title"
              title="サイズと在庫"
              description="サイズごとの在庫が取得できている場合に表示します。"
            />
            <VariantList variants={overseas.variants} />
          </section>
        ) : null}

        {/* ===== 商品情報 ===== */}
        <section className="section" aria-labelledby="spec-title">
          <SectionHeader id="spec-title" title="商品情報" />
          <dl className="spec-list">
            <dt>クラブ</dt>
            <dd>
              {club.nameJa}（{club.name}）
            </dd>

            <dt>リーグ</dt>
            <dd>{league.nameJa}</dd>

            <dt>シーズン</dt>
            <dd>{product.season ?? '確認中'}</dd>

            <dt>カテゴリ</dt>
            <dd>{CATEGORY_LABEL[product.category]}</dd>

            <dt>メーカー</dt>
            <dd>{product.manufacturer}</dd>

            <dt>メーカー品番</dt>
            <dd>{product.manufacturerSku ?? '確認中'}</dd>

            <dt>仕様</dt>
            <dd>
              {product.authenticity ? AUTHENTICITY_LABEL[product.authenticity] : '—'}
              {product.sleeve ? `／${product.sleeve === 'long' ? '長袖' : '半袖'}` : ''}
            </dd>

            <dt>対象</dt>
            <dd>{GENDER_LABEL[product.gender]}</dd>

            {product.player ? (
              <>
                <dt>選手名</dt>
                <dd>{product.player}</dd>
              </>
            ) : null}

            {overseas ? (
              <>
                <dt>海外の販売元</dt>
                <dd>
                  {overseas.store.name}（{STORE_TYPE_LABEL[overseas.store.type]}・
                  {SHIPPING_TYPE_LABEL[overseas.store.shippingType]}）
                </dd>
                <dt>海外公式価格</dt>
                <dd>
                  {formatCurrency(overseas.listing.currentPrice, overseas.listing.currency)}
                  {discountPercent > 0 ? (
                    <>
                      {' '}
                      <span className="price-row__value--struck">
                        {formatCurrency(overseas.listing.regularPrice, overseas.listing.currency)}
                      </span>
                    </>
                  ) : null}
                </dd>
              </>
            ) : null}

            {domesticReference ? (
              <>
                <dt>国内の比較対象</dt>
                <dd>
                  {domesticReference.store.name}（
                  {STORE_TYPE_LABEL[domesticReference.store.type]}）
                </dd>
              </>
            ) : null}
          </dl>
        </section>

        {/* ===== 日本到着推定額について ===== */}
        <section className="section" aria-labelledby="landed-title">
          <SectionHeader id="landed-title" title="日本到着推定額について" />
          <div className="notice">
            <p>
              日本到着推定額とは、海外ストアの商品価格を円換算したものに、
              国際送料・輸入コスト・決済関連コストの目安を加えた金額です。
            </p>
            <ul style={{ marginTop: 'var(--space-2)' }}>
              <li>為替レートは一定の想定値を使っています。実際のレートは日々変わります。</li>
              <li>
                国際送料は1点購入時の目安です。まとめ買いをすると1点あたりの負担は下がります。
              </li>
              <li>
                関税・消費税は、個人輸入の簡易計算（海外小売価格の60%を課税価格とする方法）で
                試算しています。課税価格が1万円以下の場合は非課税として計算しています。
              </li>
              <li>
                <strong>費用が1つでも分からない場合は、合計を出しません。</strong>
                分からない費用を0円として足すと、実際より安く見えてしまうためです。
                その場合は「○○を除く参考額」と表示します。
              </li>
              <li>
                税関の判断・配送業者の手数料・キャンペーンにより、実際の負担額は変わります。
              </li>
            </ul>
            <p style={{ marginTop: 'var(--space-2)' }}>
              <strong>この金額は確定額ではありません。</strong>
              購入前に、必ず販売元のページで最終的な支払額をご確認ください。
            </p>
            <p style={{ marginTop: 'var(--space-2)' }}>
              <Link href="/about/#landed-cost" className="text-link">
                計算の考え方をもっと詳しく
              </Link>
            </p>
          </div>
        </section>

        {/* ===== 価格の推移 ===== */}
        <section className="section" aria-labelledby="history-title">
          <SectionHeader
            id="history-title"
            title="価格の推移"
            description="サカモノが価格を確認した記録です。現在価格・過去最安・過去最高・直近の変動を表示しています。"
          />
          <div className="stack">
            <PriceHistoryChart
              series={history.overseas}
              caption={overseas ? `${overseas.store.name}の価格` : '海外ストアの価格'}
            />
            {history.domestic.snapshots.length > 0 && domesticReference ? (
              <PriceHistoryChart
                series={history.domestic}
                caption={`${domesticReference.store.name}の価格`}
              />
            ) : null}
          </div>
        </section>

        {/*
          構造化データ（JSON-LD）。
          サンプルデータのときは出力しない。ダミー価格を検索エンジンへ渡さないため。
        */}
        {!meta.isSampleData && overseas ? (
          <script
            type="application/ld+json"
            // 値は自前のデータから組み立てているため、外部入力の混入はない
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                '@context': 'https://schema.org',
                '@type': 'Product',
                name: product.nameJa,
                sku: product.manufacturerSku ?? undefined,
                gtin13: product.ean ?? undefined,
                brand: { '@type': 'Brand', name: product.manufacturer },
                image: `${SITE_URL}${product.image.src}`,
                offers: {
                  '@type': 'Offer',
                  priceCurrency: overseas.listing.currency,
                  price: overseas.listing.currentPrice,
                  availability: overseas.listing.inStock
                    ? 'https://schema.org/InStock'
                    : 'https://schema.org/OutOfStock',
                  url: overseas.listing.externalUrl,
                },
              }),
            }}
          />
        ) : null}
      </div>
    </>
  )
}

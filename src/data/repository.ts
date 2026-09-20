/**
 * リポジトリ層。
 *
 * ★画面（src/app, src/components）がデータを取るときは必ずここを通します。★
 * fixture を直接 import してはいけません。
 *
 * 役割:
 *   1. データ取得層（adapters）からデータを受け取る
 *   2. 価格計算サービス（src/domain/services/）を呼んで計算を済ませる
 *   3. 画面がそのまま描けるビューモデルへ組み立てる
 *
 * ★このファイル自体は計算式を持ちません。★
 *   足し算・割り算・しきい値の判定はすべてサービス側にあります。
 *   ここは「どのデータをどのサービスへ渡すか」を決める配線係です。
 *
 * 第3段階でデータの出どころが外部APIへ変わっても、
 * 変わるのは adapters の中だけで、このファイルと画面は影響を受けません。
 */

import { getDataSource } from '@/data/adapters'
import type { DataSourceMeta } from '@/data/adapters'
import type {
  ClubSummary,
  LeagueSummary,
  OverseasOffer,
  PriceHistoryView,
  ProductView,
} from '@/data/viewModels'
import type {
  Club,
  DomesticMatch,
  ExchangeRate,
  ImportCostRule,
  League,
  PriceSnapshot,
  Product,
  ProductCategory,
  ProductVariant,
  ShippingRule,
  Store,
  StoreListing,
} from '@/domain/types'
import { rawMoney } from '@/domain/money'
import {
  buildPriceComparison,
  calculateLandedCost,
  convertMoneyToJpy,
  createExchangeRateTable,
  emptyDomesticPriceSummary,
  evaluateDiscount,
  evaluateFreshness,
  findImportCostRule,
  findShippingRule,
  gradeForMatch,
  resolveShipping,
  summarizeDomesticPrice,
  summarizePriceHistory,
  type DomesticOfferCandidate,
  type ExchangeRateTable,
  type SaleSignals,
} from '@/domain/services'
import { FOREIGN_TRANSACTION_FEE_RATE } from '@/lib/pricing/config'

/* ============================================================
 * 読み込みと組み立て（1回だけ実行してキャッシュする）
 * ========================================================== */

interface SiteData {
  meta: DataSourceMeta
  leagues: League[]
  clubs: Club[]
  stores: Store[]
  products: Product[]
  listings: StoreListing[]
  snapshots: PriceSnapshot[]
  matches: DomesticMatch[]
  rates: ExchangeRateTable
  productViews: ProductView[]
}

let cache: Promise<SiteData> | null = null

async function loadSiteData(): Promise<SiteData> {
  const source = getDataSource()

  const [
    leagues,
    clubs,
    stores,
    products,
    listings,
    snapshots,
    matches,
    exchangeRates,
    shippingRules,
    importCostRules,
    variants,
  ] = await Promise.all([
    source.getLeagues(),
    source.getClubs(),
    source.getStores(),
    source.getProducts(),
    source.getListings(),
    source.getPriceSnapshots(),
    source.getDomesticMatches(),
    source.getExchangeRates(),
    source.getShippingRules(),
    source.getImportCostRules(),
    source.getVariants(),
  ])

  const sortedLeagues = [...leagues].sort((a, b) => a.displayOrder - b.displayOrder)
  const sortedClubs = [...clubs].sort((a, b) => a.displayOrder - b.displayOrder)
  const rates = createExchangeRateTable(exchangeRates)

  const productViews = buildProductViews({
    leagues: sortedLeagues,
    clubs: sortedClubs,
    stores,
    products,
    listings,
    matches,
    shippingRules,
    importCostRules,
    variants,
    rates,
    // 鮮度の基準にする「今」。データの生成日時を使うことで、
    // ビルドするたびに結果が変わらないようにしている。
    now: source.meta.generatedAt,
  })

  return {
    meta: source.meta,
    leagues: sortedLeagues,
    clubs: sortedClubs,
    stores,
    products,
    listings,
    snapshots,
    matches,
    rates,
    productViews,
  }
}

function getSiteData(): Promise<SiteData> {
  if (!cache) cache = loadSiteData()
  return cache
}

interface BuildContext {
  leagues: League[]
  clubs: Club[]
  stores: Store[]
  products: Product[]
  listings: StoreListing[]
  matches: DomesticMatch[]
  shippingRules: ShippingRule[]
  importCostRules: ImportCostRule[]
  variants: ProductVariant[]
  rates: ExchangeRateTable
  now: string
}

interface IndexedContext extends BuildContext {
  storeById: Map<string, Store>
  productById: Map<string, Product>
  listingById: Map<string, StoreListing>
}

function buildProductViews(context: BuildContext): ProductView[] {
  const leagueById = new Map(context.leagues.map((x) => [x.id, x]))
  const clubById = new Map(context.clubs.map((x) => [x.id, x]))

  const indexed: IndexedContext = {
    ...context,
    storeById: new Map(context.stores.map((x) => [x.id, x])),
    productById: new Map(context.products.map((x) => [x.id, x])),
    listingById: new Map(context.listings.map((x) => [x.id, x])),
  }

  const views: ProductView[] = []

  for (const product of context.products) {
    const club = clubById.get(product.clubId)
    if (!club) continue
    const league = leagueById.get(club.leagueId)
    if (!league) continue

    const overseasOffers = buildOverseasOffers(product, indexed)
    const overseas = selectOverseasOffer(overseasOffers)

    const domesticCandidates = buildDomesticCandidates(product, indexed)
    const domesticPrice =
      domesticCandidates.length === 0
        ? emptyDomesticPriceSummary()
        : summarizeDomesticPrice(domesticCandidates, product)

    const comparison = buildPriceComparison({
      productId: product.id,
      overseasPriceJpy: overseas?.landedCost.productPriceJpy ?? null,
      landedCost: overseas?.landedCost ?? null,
      domesticPrice,
    })

    const saleSignals: SaleSignals = {
      discountRate: overseas?.discount.rate ?? 0,
      priceDifferenceJpy: comparison.priceDifferenceJpy,
      confidenceGrade: domesticPrice.confidence,
      inStock: overseas?.listing.inStock ?? false,
      freshness: overseas?.freshness.level ?? 'unknown',
      ageDays: overseas?.freshness.ageDays ?? null,
    }

    views.push({
      product,
      club,
      league,
      href: `/products/${product.slug}/`,
      overseas,
      overseasOffers,
      comparison,
      saleSignals,
    })
  }

  return views
}

/* ------------------------------------------------------------
 * 海外側
 * ---------------------------------------------------------- */

function buildOverseasOffers(product: Product, context: IndexedContext): OverseasOffer[] {
  const offers: OverseasOffer[] = []

  for (const listing of context.listings) {
    if (listing.productId !== product.id) continue

    const store = context.storeById.get(listing.storeId)
    if (!store) continue
    // 国内ショップはここでは扱わない（国内価格として別に集計する）
    if (store.shippingType === 'domestic') continue
    if (!store.japanShippingAvailable) continue

    const landedCostResult = calculateLandedCost({
      itemPrice: rawMoney(listing.currentPrice, listing.currency),
      storeCurrency: listing.currency,
      category: product.category,
      shippingRule: findShippingRule(context.shippingRules, store.id),
      importCostRule: findImportCostRule(context.importCostRules, store.id, product.category),
      rates: context.rates,
      foreignTransactionFeeRate: FOREIGN_TRANSACTION_FEE_RATE,
    })

    // 円へ換算できない（未対応通貨・レート無し）掲載は、そもそも比較に使えない
    if (!landedCostResult.ok) continue

    offers.push({
      listing,
      store,
      landedCost: landedCostResult.value,
      discount: evaluateDiscount(listing.regularPrice, listing.currentPrice),
      freshness: evaluateFreshness(listing.lastCheckedAt, context.now),
      variants: context.variants.filter((variant) => variant.storeListingId === listing.id),
    })
  }

  return offers
}

/**
 * 表示に使う海外掲載を1件選ぶ。
 *
 * ★「商品代が安いから」という理由だけで選ばない。★
 *   送料が分からない掲載は日本到着推定額を出せないので、
 *   まず「総額を出せるもの」を優先し、その中で総額が安いものを選ぶ。
 *   総額を出せるものが1つも無いときだけ、参考額が安いものを選ぶ。
 */
function selectOverseasOffer(offers: OverseasOffer[]): OverseasOffer | null {
  if (offers.length === 0) return null

  const withTotal = offers.filter((offer) => offer.landedCost.totalJpy !== null)
  if (withTotal.length > 0) {
    return withTotal.reduce((best, current) =>
      (current.landedCost.totalJpy ?? Number.POSITIVE_INFINITY) <
      (best.landedCost.totalJpy ?? Number.POSITIVE_INFINITY)
        ? current
        : best,
    )
  }

  return offers.reduce((best, current) =>
    current.landedCost.partialTotalJpy < best.landedCost.partialTotalJpy ? current : best,
  )
}

/* ------------------------------------------------------------
 * 国内側
 * ---------------------------------------------------------- */

function buildDomesticCandidates(
  product: Product,
  context: IndexedContext,
): DomesticOfferCandidate[] {
  const candidates: DomesticOfferCandidate[] = []

  for (const match of context.matches) {
    if (match.productId !== product.id) continue

    const listing = context.listingById.get(match.storeListingId)
    if (!listing) continue
    const store = context.storeById.get(listing.storeId)
    if (!store) continue

    const itemPrice = rawMoney(listing.currentPrice, listing.currency)

    const itemPriceResult = convertMoneyToJpy(itemPrice, context.rates)
    if (!itemPriceResult.ok) continue

    const shippingResult = resolveShipping({
      rule: findShippingRule(context.shippingRules, store.id),
      itemPrice,
      rates: context.rates,
    })
    if (!shippingResult.ok) continue

    candidates.push({
      listing,
      store,
      match,
      // その掲載が指している商品。レプリカ／オーセンティックの取り違えを見つけるのに使う。
      product: context.productById.get(listing.productId) ?? null,
      shipping: shippingResult.value,
      itemPriceJpy: itemPriceResult.value.value.amount,
      grade: gradeForMatch(match),
    })
  }

  return candidates
}

/* ============================================================
 * 画面から呼ぶ関数
 * ========================================================== */

/** 現在のデータ取得層の情報（サンプルデータかどうかなど）。 */
export async function getDataSourceMeta(): Promise<DataSourceMeta> {
  return (await getSiteData()).meta
}

/** 使っている為替レートの情報（画面へ「開発用の想定値」と出すために使う）。 */
export async function getExchangeRateInfo(): Promise<{
  rates: ExchangeRate[]
  containsDevelopmentFixture: boolean
  latestFetchedAt: string | null
}> {
  const data = await getSiteData()
  return {
    rates: data.rates.all,
    containsDevelopmentFixture: data.rates.containsDevelopmentFixture,
    latestFetchedAt: data.rates.latestFetchedAt,
  }
}

/* ----- リーグ ---------------------------------------------- */

export async function listLeagues(): Promise<League[]> {
  return (await getSiteData()).leagues
}

export async function listLeagueSummaries(): Promise<LeagueSummary[]> {
  const data = await getSiteData()
  return data.leagues.map((league) => {
    const clubs = data.clubs.filter((club) => club.leagueId === league.id)
    const clubIds = new Set(clubs.map((club) => club.id))
    return {
      league,
      clubCount: clubs.length,
      productCount: data.products.filter((product) => clubIds.has(product.clubId)).length,
      href: `/leagues/${league.slug}/`,
    }
  })
}

export async function getLeagueBySlug(slug: string): Promise<League | null> {
  const data = await getSiteData()
  return data.leagues.find((league) => league.slug === slug) ?? null
}

/* ----- クラブ ---------------------------------------------- */

export async function listClubSummaries(leagueId?: string): Promise<ClubSummary[]> {
  const data = await getSiteData()
  const leagueById = new Map(data.leagues.map((x) => [x.id, x]))

  return data.clubs
    .filter((club) => (leagueId ? club.leagueId === leagueId : true))
    .flatMap((club) => {
      const league = leagueById.get(club.leagueId)
      if (!league) return []
      return [
        {
          club,
          league,
          productCount: data.products.filter((product) => product.clubId === club.id).length,
          href: `/clubs/${club.slug}/`,
        },
      ]
    })
}

export async function getClubBySlug(slug: string): Promise<Club | null> {
  const data = await getSiteData()
  return data.clubs.find((club) => club.slug === slug) ?? null
}

/* ----- 商品 ------------------------------------------------ */

export async function listProductViews(): Promise<ProductView[]> {
  return (await getSiteData()).productViews
}

export async function getProductViewBySlug(slug: string): Promise<ProductView | null> {
  const data = await getSiteData()
  return data.productViews.find((view) => view.product.slug === slug) ?? null
}

export async function listProductViewsByClub(clubId: string): Promise<ProductView[]> {
  const views = await listProductViews()
  return views.filter((view) => view.club.id === clubId)
}

export async function listProductViewsByLeague(leagueId: string): Promise<ProductView[]> {
  const views = await listProductViews()
  return views.filter((view) => view.league.id === leagueId)
}

/**
 * カテゴリごとにまとめる。クラブページのセクション分けに使う。
 * 商品が1件も無いカテゴリは返さない（空セクションを出さないため）。
 */
export async function groupProductViewsByCategory(
  views: ProductView[],
): Promise<Array<{ category: ProductCategory; views: ProductView[] }>> {
  const order: ProductCategory[] = [
    'kits',
    'training',
    'jackets',
    't-shirts',
    'hoodies',
    'scarves',
    'caps',
    'bags',
    'limited',
    'collaboration',
    'other',
  ]

  return order
    .map((category) => ({
      category,
      views: views.filter((view) => view.product.category === category),
    }))
    .filter((group) => group.views.length > 0)
}

/* ----- セール・ランキング ---------------------------------- */

/**
 * セール中（海外側が値下げ中）の商品を、割引率の高い順に返す。
 * 値上げや価格データの不備はセール扱いにしない（evaluateDiscount が判定する）。
 */
export async function listSaleProductViews(limit?: number): Promise<ProductView[]> {
  const views = await listProductViews()
  const sale = views
    .filter((view) => view.overseas?.discount.isSale === true)
    .sort((a, b) => (b.overseas?.discount.rate ?? 0) - (a.overseas?.discount.rate ?? 0))

  return limit ? sale.slice(0, limit) : sale
}

/**
 * 価格差ランキング。
 *
 * 掲載条件（判定はすべて buildPriceComparison / summarizeDomesticPrice 側）:
 *   - 日本到着推定額を算出できている（送料不明のものは入らない）
 *   - 国内の比較対象が、商品同定・販売元・在庫・送料条件の審査を通っている
 *   - 日本到着推定額の方が安い
 */
export async function listPriceGapRanking(limit?: number): Promise<ProductView[]> {
  const views = await listProductViews()
  const ranked = views
    .filter(
      (view) =>
        view.comparison.comparisonStatus === 'valid' && view.comparison.advantage === 'overseas',
    )
    .sort(
      (a, b) => (b.comparison.priceDifferenceJpy ?? 0) - (a.comparison.priceDifferenceJpy ?? 0),
    )

  return limit ? ranked.slice(0, limit) : ranked
}

/* ----- 価格履歴 -------------------------------------------- */

export async function getPriceHistory(view: ProductView): Promise<PriceHistoryView> {
  const data = await getSiteData()

  const pick = (listingId: string | undefined): PriceSnapshot[] =>
    listingId
      ? data.snapshots
          .filter((snapshot) => snapshot.storeListingId === listingId)
          .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      : []

  const overseasSnapshots = pick(view.overseas?.listing.id)
  const domesticSnapshots = pick(view.comparison.domesticPrice.reference?.listing.id)

  return {
    overseas: {
      snapshots: overseasSnapshots,
      summary: summarizePriceHistory(overseasSnapshots),
    },
    domestic: {
      snapshots: domesticSnapshots,
      summary: summarizePriceHistory(domesticSnapshots),
    },
  }
}

/** 鮮度判定の基準にした「今」（データの生成日時）。 */
export async function getDataAsOf(): Promise<string> {
  return (await getSiteData()).meta.generatedAt
}

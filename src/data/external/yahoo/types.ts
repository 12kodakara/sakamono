/**
 * Yahoo!ショッピング 商品検索API（v3）の生データの形。
 *
 * 公式仕様: https://developer.yahoo.co.jp/webapi/shopping/v3/itemsearch.html
 * エンドポイント: https://shopping.yahooapis.jp/ShoppingWebService/V3/itemSearch
 *
 * ★APIのレスポンスを、そのままサカモノの Product へ入れないこと。★
 *   外部の形（先方の都合で変わる）と、サカモノ内部の形（安定させたい）は別物です。
 *   一度この Raw の形で受け止めてから、adapter で内部モデルへ写します。
 *
 * ★どの項目も欠けうる前提で書いています。★
 *   「必ず入っている」と仕様に書かれていても、実際には欠けることがあります。
 */

/* ------------------------------------------------------------
 * APIレスポンスの形（公式仕様のフィールド名をそのまま使う）
 * ---------------------------------------------------------- */

/** 1件分の検索結果（公式仕様の hits[] の要素）。 */
export interface YahooApiHit {
  index?: number
  name?: string
  description?: string
  headLine?: string
  url?: string
  /** 出品者が付けた商品コード（seller_managed_item_id）。 */
  code?: string
  /** 'new' または 'used'。 */
  condition?: string
  inStock?: boolean
  /** 税込価格。 */
  price?: number
  taxExcludePrice?: number
  /**
   * 価格の内訳。
   * defaultPrice が「通常価格」、discountedPrice が「値引き後価格」にあたる。
   */
  priceLabel?: {
    taxable?: boolean
    defaultPrice?: number
    taxExcludeDefaultPrice?: number
    discountedPrice?: number
    taxExcludeDiscountedPrice?: number
    fixedPrice?: number
    periodStart?: number
    periodEnd?: number
  }
  image?: { small?: string; medium?: string }
  exImage?: { url?: string; width?: number; height?: number }
  janCode?: string
  brand?: { id?: number | string; name?: string }
  parentBrands?: Array<{ id?: number | string; name?: string }>
  seller?: {
    sellerId?: string
    name?: string
    url?: string
    isBestSeller?: boolean
    review?: { rate?: number; count?: number }
  }
  genreCategory?: { id?: number | string; name?: string; depth?: number }
  shipping?: { code?: number; name?: string }
  releaseDate?: string
}

/** レスポンス全体（公式仕様のトップレベル）。 */
export interface YahooApiResponse {
  totalResultsAvailable?: number
  totalResultsReturned?: number
  firstResultPosition?: number
  request?: { query?: string }
  hits?: YahooApiHit[]
}

/* ------------------------------------------------------------
 * サカモノ側で受け止める形
 * ---------------------------------------------------------- */

/**
 * 検証を通した1商品分の生データ。
 *
 * 公式仕様の入れ子（seller.name / brand.name / priceLabel.defaultPrice）を
 * ここで平らにしておき、下流が仕様の構造を知らなくてよいようにしています。
 */
export interface YahooRawProduct {
  /** 商品を識別する値。code、無ければURLから作る。 */
  externalId: string
  name: string
  url: string

  /** 税込価格。★null は取り込まない（0円商品を作らないため）。★ */
  price: number | null
  /** 通常価格（priceLabel.defaultPrice）。取れなければ null。 */
  regularPrice: number | null

  janCode: string | null
  brandName: string | null

  sellerId: string | null
  sellerName: string | null

  imageUrl: string | null

  /** 在庫。★取れなければ 'unknown'。available と決めつけない。★ */
  availability: 'available' | 'unavailable' | 'unknown'

  /** 新品／中古。★取れなければ 'unknown'。new と決めつけない。★ */
  condition: 'new' | 'used' | 'unknown'

  /**
   * 送料の表示（shipping.name）。
   * 「送料無料」と明記されている場合だけ総額を確定できる。
   */
  shippingLabel: string | null

  fetchedAt: string
}

/**
 * 1回の検索の結果。
 *
 * どの条件で検索したのかを必ず残します。
 * 「なぜこの候補が出てきたのか」を後から追えるようにするためです。
 */
export interface YahooSearchResult {
  /** 実際に送ったパラメータ（★appid は含めない★）。 */
  requestParams: Record<string, string>
  /** 検索の手掛かりの種類。 */
  level: 'jan' | 'ean-as-jan' | 'sku' | 'attributes'
  /** APIが返した総件数。 */
  totalResultsAvailable: number
  /** 実際に受け取った件数。 */
  totalResultsReturned: number
  products: YahooRawProduct[]
  fetchedAt: string
  /** キャッシュから読んだか。 */
  fromCache: boolean
}

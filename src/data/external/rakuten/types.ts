/**
 * 楽天市場 商品検索API（IchibaItem/Search）の生データの形。
 *
 * 公式仕様: https://webservice.rakuten.co.jp/documentation/ichiba-item-search
 * エンドポイント:
 *   https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701
 *
 * ══════════════════════════════════════════════════════════
 * ★第5段階の着手時に公式仕様を確認して分かった、指示書との違い★
 *
 *   1. エンドポイントが openapi.rakuten.co.jp へ変わっています。
 *      旧 app.rakuten.co.jp は 2026年5月14日に停止しました。
 *
 *   2. 認証が applicationId だけでは通りません。
 *      applicationId と accessKey の両方が必須です。
 *      片方だけだと 400 が返ります。
 *
 *   3. ★JANコードでの検索ができません。★
 *      検索に使える商品の識別子は keyword / itemCode / shopCode / genreId だけで、
 *      isbnjan のようなパラメータはありません。
 *      レスポンスにもJANの項目はありません。
 *      → 指示書10の「1. JANが公式APIで利用可能ならJAN」は実行できません。
 *      → 指示書12のとおり、無理に実装せず、商品説明から拾うこともしません。
 * ══════════════════════════════════════════════════════════
 *
 * ★APIのレスポンスを、そのままサカモノの Product へ入れないこと。★
 *   外部の形（先方の都合で変わる）と、サカモノ内部の形（安定させたい）は別物です。
 *   一度この Raw の形で受け止めてから、adapter で内部モデルへ写します。
 *
 * ★どの項目も欠けうる前提で書いています。★
 */

/* ------------------------------------------------------------
 * APIレスポンスの形（公式仕様のフィールド名をそのまま使う）
 * ---------------------------------------------------------- */

/**
 * 1件分の検索結果。
 *
 * 公式仕様の formatVersion によって包み方が変わります。
 *   formatVersion=1 … Items: [{ Item: {...} }]
 *   formatVersion=2 … Items: [{...}]
 * サカモノは 2 を使いますが、★どちらで返ってきても読めるように★
 * 検証側で両方をほどきます（仕様変更や設定ミスで落ちないように）。
 */
export interface RakutenApiItem {
  itemName?: string
  itemCode?: string
  /** 税込・税別は taxFlag で決まる。★そのまま税込として扱わないこと。★ */
  itemPrice?: number
  itemCaption?: string
  itemUrl?: string
  affiliateUrl?: string

  shopCode?: string
  shopName?: string
  shopUrl?: string

  imageFlag?: number
  smallImageUrls?: unknown
  mediumImageUrls?: unknown

  /** 0=在庫なし / 1=在庫あり */
  availability?: number
  /** ★0=税込 / 1=税別★ */
  taxFlag?: number
  /** ★0=送料込み / 1=送料別★ */
  postageFlag?: number
  creditCardFlag?: number

  /** ポイント倍率。★現金値引きとして価格から引かないこと。★ */
  pointRate?: number
  pointRateStartTime?: string
  pointRateEndTime?: string

  reviewCount?: number
  reviewAverage?: number
  genreId?: number | string
  startTime?: string
  endTime?: string
}

/** レスポンス全体（公式仕様のトップレベル）。 */
export interface RakutenApiResponse {
  count?: number
  page?: number
  first?: number
  last?: number
  hits?: number
  pageCount?: number
  /** formatVersion により { Item: {...} } の配列にも、素の配列にもなる。 */
  Items?: unknown
  /** エラー時 */
  error?: string
  error_description?: string
}

/* ------------------------------------------------------------
 * サカモノ側で受け止める形
 * ---------------------------------------------------------- */

/**
 * 検証を通した1商品分の生データ。
 *
 * ★価格の意味を取り違えないための項目を持たせています。★
 *   楽天の itemPrice は、税別のことも、送料別のこともあります。
 *   「いくら払えば届くのか」は、この2つのフラグを見ないと決まりません。
 */
export interface RakutenRawItem {
  /** 商品を識別する値（itemCode。無ければURLから作る）。 */
  externalId: string
  name: string
  url: string

  /** 掲載価格。★null は取り込まない（0円商品を作らないため）。★ */
  price: number | null

  shopCode: string | null
  shopName: string | null

  /**
   * JANコード。
   * ★楽天の商品検索APIはJANを返しません。常に null です。★
   *   項目だけ残してあるのは、他の提供元と同じ形で扱うためと、
   *   将来JANを返す口ができたときに入れ場所を用意しておくためです。
   *   ★商品説明からJANらしき数字を拾ってはいけません。★
   *   出品者が別商品のJANを書いていることがあり、誤一致の元になります。
   */
  janCode: string | null

  /**
   * メーカー名。
   * ★楽天の商品検索APIはブランド名を単独で返しません。常に null です。★
   *   メーカーの判定は商品名から行います（照合エンジンが担当）。
   */
  manufacturer: string | null

  imageUrl: string | null

  /** 在庫。★取れなければ 'unknown'。available と決めつけない。★ */
  availability: 'available' | 'unavailable' | 'unknown'

  /**
   * 掲載価格が税込か。
   *   'tax-included' … taxFlag = 0
   *   'tax-excluded' … taxFlag = 1（★このままでは他と比べられない★）
   *   'unknown'      … 取れなかった
   */
  taxBasis: 'tax-included' | 'tax-excluded' | 'unknown'

  /**
   * 掲載価格に送料が含まれるか。
   *   'included' … postageFlag = 0（送料込み）
   *   'excluded' … postageFlag = 1（送料別。★いくらかは分からない★）
   *   'unknown'  … 取れなかった
   */
  postageBasis: 'included' | 'excluded' | 'unknown'

  /**
   * ポイント倍率。
   * ★記録するだけ。価格から差し引かないこと。★
   *   ポイントは現金ではなく、付与条件も会員状態で変わります。
   *   差し引いた「実質価格」を比較に使うと、誰にも当てはまらない数字になります。
   */
  pointRate: number | null

  fetchedAt: string
}

/**
 * 1回の検索の結果。
 *
 * どの条件で検索したのかを必ず残します。
 * 「なぜこの候補が出てきたのか」を後から追えるようにするためです。
 */
export interface RakutenSearchResult {
  /** 実際に送ったパラメータ（★applicationId / accessKey は含めない★）。 */
  requestParams: Record<string, string>
  /** 検索の手掛かりの種類。★JANは楽天では使えない★ */
  level: RakutenSearchLevel
  /** APIが返した総件数。 */
  totalResultsAvailable: number
  /** 実際に受け取った件数。 */
  totalResultsReturned: number
  items: RakutenRawItem[]
  fetchedAt: string
  /** キャッシュから読んだか。 */
  fromCache: boolean
}

/**
 * 検索の手掛かりの強さ。
 *
 * ★'jan' がありません。★ 楽天の商品検索APIはJAN検索に対応していないためです。
 */
export type RakutenSearchLevel = 'sku' | 'sku-club' | 'attributes'

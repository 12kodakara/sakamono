/**
 * サカモノ ドメイン型定義
 *
 * ここは「データの形」だけを決める場所。
 * 画面（React）にも、データの取得方法（fixture / API）にも依存しない。
 *
 * 設計の要点:
 *  - Product（商品そのもの）と StoreListing（あるショップでの掲載情報）を必ず分ける。
 *    同じユニフォームでも、公式ストアと国内ショップでは価格も在庫もURLも違うため。
 *  - 価格は「履歴を残す」前提（PriceSnapshot）。
 *  - 海外商品と国内商品の結び付きは DomesticMatch として別に持ち、
 *    信頼度（confidence）を必ず伴う。
 */

/* ============================================================
 * 共通の補助型
 * ========================================================== */

import type { Currency } from './money'

export type { Currency, Money } from './money'

/**
 * ISO 4217 通貨コード。
 *
 * @deprecated 第1段階で付けた名前。中身は `Currency` と同じ。
 *   新しいコードでは `Currency`（または金額とセットの `Money`）を使うこと。
 *   既存コードを一度に書き換えないよう、名前だけ残している。
 */
export type CurrencyCode = Currency

/** ISO 8601 形式の日時文字列（例: '2026-09-18T09:00:00.000Z'）。 */
export type IsoDateTime = string

/** URLで使う識別子。小文字の英数字とハイフンのみ。例: 'liverpool' */
export type Slug = string

/* ============================================================
 * League（リーグ）
 * ========================================================== */

export interface League {
  id: string
  /** URL用。例: 'premier-league' */
  slug: Slug
  /** 英語名。例: 'Premier League' */
  name: string
  /** 日本語表示名。例: 'プレミアリーグ' */
  nameJa: string
  /** 国・地域名（日本語）。例: 'イングランド' */
  country: string
  /** 一覧での並び順。小さいほど先。 */
  displayOrder: number
  /** false のリーグはサイトに一切表示しない。 */
  active: boolean
}

/* ============================================================
 * Club（クラブ）
 * ========================================================== */

export interface Club {
  id: string
  /** 所属リーグの League['id'] */
  leagueId: string
  /** URL用。例: 'liverpool' */
  slug: Slug
  name: string
  nameJa: string
  country: string
  /** 公式ストアのトップURL。 */
  officialStoreUrl: string
  /** 一覧での並び順。小さいほど先。 */
  displayOrder: number
  active: boolean
}

/* ============================================================
 * Store（販売元）
 * ========================================================== */

/**
 * 販売元の種類。
 *  - official   : クラブ / リーグの公式ストア
 *  - authorized : 正規取扱いと確認できた販売店
 *  - marketplace: 出品者が個別に存在するモール型
 *  - affiliate  : アフィリエイト経由の送客先
 */
export type StoreType = 'official' | 'marketplace' | 'authorized' | 'affiliate'

/**
 * 日本への配送形態。
 *  - direct    : ショップが日本へ直接発送する
 *  - forwarder : 転送サービスを挟む必要がある
 *  - domestic  : 国内ショップ（国内配送のみ）
 *  - none      : 日本への配送手段が確認できていない
 */
export type ShippingType = 'direct' | 'forwarder' | 'domestic' | 'none'

export interface Store {
  id: string
  slug: Slug
  name: string
  type: StoreType
  /** そのストアの表示通貨。 */
  currency: CurrencyCode
  /** ストアの所在国（日本語）。 */
  country: string
  /** 日本へ配送できるか。 */
  japanShippingAvailable: boolean
  shippingType: ShippingType
  /** アフィリエイトプログラムが利用可能か（公開ページでは強調しない）。 */
  affiliateAvailable: boolean
  active: boolean
  /**
   * このストアのデータの出どころ（第4段階で追加）。
   *   fixture … 開発用のサンプルデータ
   *   live    … 実際に取得したデータ
   * 開発用と実データが同じ画面に混ざるとき、どちらか分かるようにするため。
   * 省略時は fixture 扱い。
   */
  dataOrigin?: 'fixture' | 'live'
}

/* ============================================================
 * Product（商品そのもの）
 * ========================================================== */

/** 大分類。将来ここへカテゴリを追加していく。 */
export type ProductCategory =
  | 'kits'
  | 'training'
  | 'jackets'
  | 't-shirts'
  | 'hoodies'
  | 'scarves'
  | 'caps'
  | 'bags'
  | 'limited'
  | 'collaboration'
  /**
   * どの分類にも当てはめられなかったもの。
   * ★商品名からの当てずっぽうで分類しないための受け皿。★
   * 第3段階で外部データを取り込む際、確信が持てない商品はここへ入れる。
   */
  | 'other'

/**
 * ユニフォームの種類。
 *   unknown … ユニフォームだが、ホーム／アウェイ等を判別できていない
 *   null    … そもそもユニフォームではない
 * ★判別できないときに home などを当てずっぽうで入れないこと。★
 */
export type KitType = 'home' | 'away' | 'third' | 'goalkeeper' | 'special' | 'unknown' | null

/**
 * レプリカ / オーセンティック。
 *
 *   replica   … レプリカ（一般向け）
 *   authentic … オーセンティック（選手仕様）
 *   unknown   … 該当しうるが、どちらか判別できていない
 *   null      … そもそも該当しない（マフラー・バッグなど）
 *
 * ★判別できないときに勝手に replica を入れないこと。★
 *   レプリカとオーセンティックは価格が大きく違うため、
 *   取り違えると価格比較そのものが壊れる。
 *   unknown のまま扱えば、比較の対象から自動的に外れる（安全側に倒れる）。
 */
export type Authenticity = 'replica' | 'authentic' | 'unknown' | null

/**
 * 袖丈。
 *
 * ★実データ検証で分かったこと★
 *   同じユニフォームでも 半袖(JV6423) と 長袖(JV6456) は別品番・別価格です。
 *   袖丈を見ないと別商品どうしを比べてしまいます。
 *
 *   null は「該当しない、または未確認」。一致の根拠にはしません。
 */
export type SleeveLength = 'short' | 'long' | 'sleeveless' | null

/**
 * マーキング（選手名・背番号）の状態。
 *
 *   plain         … 無地
 *   player-marked … 選手の名前・背番号が入っている（例: No.11 サラー）
 *   personalized  … 購入者が名前・番号を指定するもの（名入れ）
 *   unknown       … 判断できない（例:「マーキング対応」とだけ書かれている）
 *
 * ★無地と選手マーキング入りは、価格が数千円違う別商品です。★
 *   実データでは同じ品番（JV6423）のまま
 *   「No.11 モハメド・サラー」と付くだけで4,000円以上高くなります。
 *   同じ価格として比較してはいけません。
 */
export type Personalization = 'plain' | 'player-marked' | 'personalized' | 'unknown'

/**
 * 対象。
 * unknown は「メンズかウィメンズか確認できていない」状態。
 * ★確認できないものを unisex として扱わないこと（別商品になってしまう）。★
 */
export type GenderTarget = 'men' | 'women' | 'kids' | 'unisex' | 'unknown'

export interface Product {
  id: string
  /** 所属クラブの Club['id'] */
  clubId: string
  /** URL用。例: 'liverpool-2025-26-home-replica' */
  slug: Slug
  name: string
  nameJa: string
  /**
   * シーズン表記。例: '2025/26'
   * 商品情報から明確に確認できない場合は null。★推測で埋めないこと。★
   */
  season: string | null
  /** メーカー名。例: 'Nike' */
  manufacturer: string
  /** メーカー品番。国内商品との照合に使う重要な手掛かり。 */
  manufacturerSku: string | null
  /** JANコード（日本の商品コード）。分かれば最優先で照合に使う。 */
  jan: string | null
  /** EANコード（欧州の商品コード）。 */
  ean: string | null
  category: ProductCategory
  kitType: KitType
  authenticity: Authenticity
  sleeve: SleeveLength
  gender: GenderTarget
  /** 選手名入りの場合のみ。例: 'Salah' */
  player: string | null
  /**
   * マーキングの状態。
   * 省略時は player から導く（player があれば player-marked、無ければ plain）。
   * 「名入れ」など player では表せないものを区別したいときに明示する。
   */
  personalization?: Personalization
  image: ProductImage
  active: boolean
}

export interface ProductImage {
  /** 画像URL。第1段階はリポジトリ内のSVGプレースホルダーを指す。 */
  src: string
  /** 代替テキスト。アクセシビリティ上必須。 */
  alt: string
  width: number
  height: number
  /**
   * 画像の出所。
   *  - placeholder: サカモノが用意したプレースホルダー（権利問題なし）
   *  - licensed   : 利用許諾を確認済み
   *  - remote     : 外部URLを参照（利用条件の確認が必要）
   */
  source: 'placeholder' | 'licensed' | 'remote'
  /**
   * 取得元にあった画像URL。
   * ★利用条件の確認が済むまで表示には使わない。★
   * 記録だけしておき、許諾が取れた時点で src へ移す。
   */
  sourceUrl?: string | null
}

/* ============================================================
 * StoreListing（あるショップでの掲載情報）
 * ========================================================== */

export interface StoreListing {
  id: string
  /** Product['id'] */
  productId: string
  /** Store['id'] */
  storeId: string
  /** そのショップ側の商品ID。 */
  externalId: string
  /** そのショップの商品ページURL。 */
  externalUrl: string
  currency: CurrencyCode
  /** 現在価格（そのショップの通貨建て）。 */
  currentPrice: number
  /** 通常価格。セールでない場合は currentPrice と同値。 */
  regularPrice: number
  /**
   * 割引率（0〜1）。regularPrice と currentPrice から計算した値を保持する。
   * 表示直前に再計算せず、取得時点の値を保存しておく。
   */
  discountRate: number
  /**
   * 買える状態か。stockStatus が unknown のときは false を入れるが、
   * 画面では「在庫切れ」ではなく「確認できていません」と出すこと。
   */
  inStock: boolean
  /**
   * 在庫の確からしさ（第3段階で追加）。
   *   available   … 在庫あり
   *   unavailable … 在庫なし
   *   unknown     … 確認できなかった
   * 省略時は inStock をそのまま信じてよい（第1・2段階のfixtureはこちら）。
   */
  stockStatus?: VariantAvailability
  /** 最終確認日時。ユーザーに「いつ時点の価格か」を示すため必須。 */
  lastCheckedAt: IsoDateTime
}

/* ============================================================
 * PriceSnapshot（価格履歴）
 * ========================================================== */

export interface PriceSnapshot {
  id: string
  /** StoreListing['id'] */
  storeListingId: string
  price: number
  currency: CurrencyCode
  recordedAt: IsoDateTime
}

/* ============================================================
 * DomesticMatch（海外商品 ↔ 国内掲載の照合結果）
 * ========================================================== */

/**
 * どの手掛かりで結び付けたか。
 *  - ean        : EAN完全一致
 *  - jan        : JAN完全一致
 *  - sku        : メーカー品番完全一致（＋クラブ一致）
 *  - attributes : クラブ・シーズン・種別などの属性一致
 *  - manual     : 人が目視で確認して結び付けた
 */
export type MatchMethod = 'ean' | 'jan' | 'sku' | 'attributes' | 'manual'

/** 信頼度の段階。しきい値は lib/matching/confidence.ts で定義する。 */
export type ConfidenceLevel = 'highest' | 'high' | 'medium' | 'review'

/**
 * 商品一致の信頼度ランク（社内外で説明するときの呼び名）。
 *
 *   A : メーカー公式・国内正規専門店での取り扱い、または完全な商品同定
 *   B : JAN / EAN / メーカーSKU などによる高確度の一致
 *   C : 商品属性（クラブ・シーズン・種別など）による一致
 *   D : 曖昧一致
 *
 * 公開している価格比較へ自動で使ってよいのは原則 A / B のみ。
 * C / D は管理者の確認対象とする。
 *
 * ConfidenceLevel（highest/high/medium/review）と1対1で対応する別名で、
 * 対応表としきい値は src/lib/matching/confidence.ts の1か所だけで定義する。
 */
export type ConfidenceGrade = 'A' | 'B' | 'C' | 'D'

export interface DomesticMatch {
  id: string
  /** 海外側の Product['id'] */
  productId: string
  /** 国内側の StoreListing['id'] */
  storeListingId: string
  /** 0〜1。1に近いほど「同じ商品である」確からしさが高い。 */
  confidence: number
  matchMethod: MatchMethod
  /** 人による確認が済んでいるか。 */
  reviewed: boolean
  /**
   * どうやって確からしさを担保したか（第4段階で追加）。
   *
   *   human     … 人が目視で確認した
   *   automated … 照合エンジンの厳格な条件（商品コード一致・属性矛盾なし・
   *               新品・極端に安くない）をすべて通った
   *   none      … 未検証
   *
   * ★モール型（出品者が個別にいるサイト）の掲載は、★
   * ★human か automated のどちらかが無いと価格比較に使わない。★
   * 省略時は none 扱い。
   */
  verification?: 'human' | 'automated' | 'none'
  /** 照合した相手の出どころ（yahoo など）。記録用。 */
  sourceLabel?: string
  /**
   * 照合エンジンが出した理由（第4段階で追加）。
   * 「なぜこの候補を採用しなかったのか」を画面で説明するために使う。
   * 例: 「クラブが一致しません」「中古品です」
   */
  matchNote?: string
  /**
   * 照合できなかった項目（第4.6段階で追加）。
   *
   * ★「書かれていなかった」を「一致した」と読み替えないための記録です。★
   *   例: 袖丈が商品名に書かれていなければ、一致でも不一致でもなく未確認。
   *   開発時の確認表示で使います。
   */
  unknownAttributes?: string[]
  createdAt: IsoDateTime
}

/**
 * 商品の状態（第4段階で追加）。
 *
 * サカモノが比べたいのは新品価格なので、中古を国内最安値に混ぜない。
 * ★取得できなかった場合は unknown。新品と決めつけない。★
 */
export type ProductCondition = 'new' | 'used' | 'unknown'

/* ============================================================
 * ExchangeRate（為替レート）
 *
 * ★第2段階では実APIへ接続しない。すべて開発用の固定値。★
 *   「いま表示しているレートが本物の実勢レートだ」と誤解されないよう、
 *   kind フィールドで開発用かどうかを型として持たせている。
 * ========================================================== */

export interface ExchangeRate {
  /** 換算元の通貨。 */
  baseCurrency: Currency
  /** 換算先。サカモノでは常に円。 */
  quoteCurrency: 'JPY'
  /** 1 baseCurrency = rate 円。 */
  rate: number
  /** このレートを取得した日時（ISO 8601）。 */
  fetchedAt: IsoDateTime
  /** 取得元の説明。開発用fixtureであることが分かる文字列を入れる。 */
  source: string
  /**
   * このレートの素性。
   *  - development-fixture : 開発用の固定値。実勢レートではない
   *  - live                : 外部APIから取得した実レート（第3段階で使用）
   *
   * development-fixture のときは、画面へ「開発用の想定値」と明示すること。
   */
  kind: 'development-fixture' | 'live'
}

/* ============================================================
 * ShippingRule（送料の決まり）
 *
 * 送料は商品価格から完全に分離して持つ。
 * 商品価格に送料を混ぜ込むと、あとで送料だけを差し替えられなくなるため。
 * ========================================================== */

/**
 * 送料の決まり方。
 *
 *  - fixed     : 日本まで固定送料
 *  - threshold : 一定金額以上で送料無料（それ未満は amount）
 *  - estimated : 決済画面でしか確定しないため、運営側が設定した推定値を使う
 *  - unknown   : 送料が分からない
 *
 * ★unknown を 0円として計算してはいけない。★
 *   送料不明のまま合計すると、実際より安い「日本到着推定額」を出してしまう。
 */
export type ShippingRuleType = 'fixed' | 'threshold' | 'estimated' | 'unknown'

export interface ShippingRule {
  id: string
  /** Store['id'] */
  storeId: string
  /** 配送先。第2段階では日本のみ。 */
  destinationCountry: 'JP'
  type: ShippingRuleType
  /** amount / freeShippingThreshold の通貨。 */
  currency: Currency
  /** 送料額。type が fixed / threshold / estimated のとき必要。 */
  amount?: number
  /** この金額以上で送料無料。type が threshold のとき必要。 */
  freeShippingThreshold?: number
  /** この決まりを確認した日時。 */
  updatedAt?: IsoDateTime
  /** 確認元（公式の配送ページなど）。 */
  source?: string
  /** 画面や管理者向けの補足。 */
  note?: string
}

/* ============================================================
 * ImportCostRule（輸入コストの見積り方）
 *
 * ★関税・輸入消費税を「確定税額」として扱わない。★
 *   サカモノは税関ではないため、確定額は出せない。
 *   ここで持つのは「どういう前提で見積もるか」というデータであり、
 *   前提そのものを fixture として差し替えられるようにしている。
 * ========================================================== */

/**
 * 見積り方法。
 *
 *  - simplified-personal-import : 個人輸入の簡易計算（運営側が置いた前提値を使う）
 *  - flat                       : 運営側が決めた定額
 *  - not-applicable             : かからないと判断できる（国内購入など）
 *  - unknown                    : 見積もれない
 */
export type ImportCostMethod =
  | 'simplified-personal-import'
  | 'flat'
  | 'not-applicable'
  | 'unknown'

/** 簡易計算に使う前提値。すべて運営側が置いた推定用の数値。 */
export interface SimplifiedImportParameters {
  /** 課税価格 = 商品代金 × この割合。 */
  taxBaseRate: number
  /** 課税価格がこの額以下なら非課税とみなす。 */
  dutyFreeThresholdJpy: number
  /** 関税率。 */
  dutyRate: number
  /** 消費税率。 */
  consumptionTaxRate: number
  /** 課税された場合の通関・立替手数料。 */
  handlingFeeJpy: number
}

export interface ImportCostRule {
  id: string
  /** 適用するストア。'any' はすべてのストア。 */
  storeId: string | 'any'
  /** 適用するカテゴリ。'any' はすべてのカテゴリ。 */
  category: ProductCategory | 'any'
  destinationCountry: 'JP'
  method: ImportCostMethod
  /** method が 'flat' のときの金額（円）。 */
  flatAmountJpy?: number
  /** method が 'simplified-personal-import' のときの前提値。 */
  parameters?: SimplifiedImportParameters
  note?: string
  updatedAt?: IsoDateTime
  source?: string
}

/* ============================================================
 * ProductVariant（サイズなどのバリエーション）
 *
 * 第3段階で追加。
 *
 * ★在庫は商品単位ではなくバリエーション単位で持つ。★
 *   商品ページに「In Stock」と書いてあっても、
 *   実際にはMサイズだけ売り切れ、ということが普通に起きる。
 *   「1つでも買えるサイズがあるか」と「全サイズ買えるか」は別の話なので、
 *   取れるなら必ずサイズごとに持つ。
 *
 * ★SKUはバリエーション側にも持てるようにする。★
 *   サイズごとにメーカー品番が変わるストアがあるため、
 *   Product.manufacturerSku（商品共通）と混同しないよう分けている。
 * ========================================================== */

/**
 * そのバリエーションを買えるか。
 *  - available   : 在庫あり
 *  - unavailable : 在庫なし
 *  - unknown     : 情報が取れなかった（★在庫ありと決めつけない★）
 */
export type VariantAvailability = 'available' | 'unavailable' | 'unknown'

export interface ProductVariant {
  id: string
  /** どの掲載のバリエーションか。StoreListing['id'] */
  storeListingId: string
  /** サイズ表記。例: 'M' / 'XL' / '2XL'。取れなければ null。 */
  size: string | null
  /** そのバリエーション固有のSKU。商品共通のSKUとは別物。 */
  sku: string | null
  /**
   * そのバリエーション固有のJAN。
   *
   * ★実データ検証で分かったこと★
   *   国内ECのJANはサイズ単位で付いていることが多く、
   *   同じシャツでもS・M・Lで別のJANになります。
   *   商品（Product）単位のJANと混同しないよう、ここに持ちます。
   */
  jan: string | null
  /** そのバリエーション固有のEAN。 */
  ean: string | null
  availability: VariantAvailability
}

/**
 * 画面へ渡すデータの形（ビューモデル）。
 *
 * 画面が「クラブを探して」「送料を足して」「差額を計算して」…と
 * 自分で組み立てなくて済むよう、必要な情報を1つにまとめた形を用意する。
 *
 * ★価格の計算は src/domain/services/ が行う。★
 *   このファイルは形を決めるだけ、repository.ts は組み立てるだけで、
 *   どちらも計算式を持たない。画面（components）はもちろん計算しない。
 */

import type {
  Club,
  League,
  PriceSnapshot,
  Product,
  ProductVariant,
  Store,
  StoreListing,
} from '@/domain/types'
import type { DiscountEvaluation } from '@/domain/services/discount'
import type { Freshness } from '@/domain/services/freshness'
import type { LandedCost } from '@/domain/services/landedCost'
import type { PriceComparison } from '@/domain/services/priceComparison'
import type { PriceHistorySummary } from '@/domain/services/priceHistory'
import type { SaleSignals } from '@/domain/services/saleSignals'

/** 海外ストアでの掲載と、その日本到着推定額。 */
export interface OverseasOffer {
  listing: StoreListing
  store: Store
  /** 日本到着推定額の内訳。送料不明なら totalJpy は null。 */
  landedCost: LandedCost
  /** 割引（セール）の評価。 */
  discount: DiscountEvaluation
  /** 価格データの鮮度。 */
  freshness: Freshness
  /**
   * サイズなどのバリエーション（第3段階で追加）。
   * 取れていないデータソースでは空配列。
   * ★空配列を「全サイズ在庫あり」と読み替えないこと。★
   */
  variants: ProductVariant[]
}

/**
 * 商品1件分の表示用データ。
 * 商品カードも商品詳細ページも、この型だけを見れば描画できる。
 */
export interface ProductView {
  product: Product
  club: Club
  league: League
  /** 商品詳細ページへのパス。 */
  href: string
  /**
   * 比較に採用した海外ストアの掲載。
   * 「日本到着推定額を出せるもののうち最安」を選ぶ。
   * 取り扱いが無ければ null。
   */
  overseas: OverseasOffer | null
  /** 見つかった海外掲載すべて（採用しなかったものを含む）。 */
  overseasOffers: OverseasOffer[]
  /**
   * 価格比較の結果。
   * 国内価格のまとめ（除外した掲載とその理由を含む）もこの中にある。
   */
  comparison: PriceComparison
  /** 注目セール判定に使う材料。 */
  saleSignals: SaleSignals
}

/** クラブ一覧に出す1件分。 */
export interface ClubSummary {
  club: Club
  league: League
  /** そのクラブの掲載商品数。 */
  productCount: number
  href: string
}

/** リーグ一覧に出す1件分。 */
export interface LeagueSummary {
  league: League
  clubCount: number
  productCount: number
  href: string
}

/** 価格履歴（記録そのものと、そこから求めたまとめ）。 */
export interface PriceHistorySeries {
  snapshots: PriceSnapshot[]
  summary: PriceHistorySummary
}

/** 商品詳細ページで使う価格推移。 */
export interface PriceHistoryView {
  /** 海外ストア側。 */
  overseas: PriceHistorySeries
  /** 国内ストア側。 */
  domestic: PriceHistorySeries
}

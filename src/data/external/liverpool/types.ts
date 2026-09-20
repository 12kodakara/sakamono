/**
 * Liverpool FC 公式ストアの「生データ」の形。
 *
 * ★外部データをいきなり Product へ変換しない。★
 *   外部の形（いつ変わるか分からない）と、サカモノ内部の形（安定させたい）は別物。
 *   一度この Raw の形で受け止めてから、adapter で内部モデルへ写す。
 *   こうしておけば、取得元が変わってもここから先は無傷で済む。
 *
 * ★どの項目も欠けうる前提で設計している。★
 *   取得元が何を返すかは、フィードを入手するまで確定していない
 *   （docs/data-sources/liverpool.md の第7章）。
 *   「取れなかった」を null で表し、推測で埋めない。
 */

/** サイズなどのバリエーション1件分。 */
export interface LiverpoolRawVariant {
  /** ストア側のバリエーションID。 */
  externalId: string | null
  /** サイズ表記。例: 'M' / 'XL'。 */
  size: string | null
  /** そのバリエーション固有のSKU。商品共通のSKUとは別物。 */
  sku: string | null
  /** そのバリエーション固有のEAN。 */
  ean: string | null
  /**
   * 在庫。
   * ★取れなかった場合は null。true（在庫あり）にしないこと。★
   */
  available: boolean | null
}

/** 商品1件分の生データ。 */
export interface LiverpoolRawProduct {
  /** ストア側の商品ID。 */
  externalId: string | null
  /** 商品名（原文のまま。翻訳も整形もしない）。 */
  title: string
  /** 商品ページURL。 */
  url: string

  /** 取得元が返した通貨コード。GBP か JPY かは取得元しだい。 */
  currency: string | null

  /** 現在価格。 */
  currentPrice: number | null
  /**
   * 通常価格。
   * 取得元が持っていない場合は null。
   * ★null を currentPrice で埋めないこと。★「セールかどうか不明」と「セールでない」は違う。
   */
  regularPrice: number | null

  /** 商品共通のSKU。 */
  sku: string | null
  /** 商品共通のEAN。 */
  ean: string | null

  /** 画像URL。★この段階ではダウンロードしない（利用条件が未確認）。★ */
  imageUrl: string | null

  /** サイズなどのバリエーション。取れなければ空配列。 */
  variants: LiverpoolRawVariant[]

  /** この生データを取得した日時（ISO 8601）。 */
  fetchedAt: string
}

/**
 * 生データのファイル1本分。
 *
 * どの経路で手に入れたのかを必ず記録する。
 * 「これはどこから来たデータなのか」が後から分からなくなるのを防ぐため。
 */
export interface LiverpoolRawFeed {
  /**
   * 取得経路。
   *  - affiliate-feed : Webgains 公式商品フィード（正規の経路）
   *  - manual         : 人が手で書き写したもの（少量の検証用）
   *  - sample         : サカモノが作った架空のサンプル（実在データではない）
   */
  origin: 'affiliate-feed' | 'manual' | 'sample'
  /** 取得元の説明。URLやフィード名など。 */
  sourceNote: string
  /** このファイルを作った日時（ISO 8601）。 */
  fetchedAt: string
  products: LiverpoolRawProduct[]
}

/** 生データがサンプル（実在データではない）かどうか。 */
export function isSampleFeed(feed: Pick<LiverpoolRawFeed, 'origin'>): boolean {
  return feed.origin === 'sample'
}
